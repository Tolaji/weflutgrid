#!/usr/bin/env node

/**
 * ETL Script for GitHub Actions
 * Processes UK Land Registry data and loads into database
 * Optimized for 2000 minute/month free tier
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Client } = require('pg');
const h3 = require('h3-js');

// Configuration
const H3_LEVEL = 10; // Street level for UK
const BATCH_SIZE = 1000;
const MAX_ROWS = process.env.ETL_MAX_ROWS ? parseInt(process.env.ETL_MAX_ROWS) : 100000;

class PostcodeLookup {
  constructor() {
    this.cache = new Map();
  }

  async load(csvPath) {
    console.log('📍 Loading postcode lookup...');
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const postcode = row.postcode.replace(/\s/g, '').toUpperCase();
          this.cache.set(postcode, {
            lat: parseFloat(row.latitude),
            lng: parseFloat(row.longitude)
          });
        })
        .on('end', () => {
          console.log(`✅ Loaded ${this.cache.size} postcodes`);
          resolve();
        })
        .on('error', reject);
    });
  }

  lookup(postcode) {
    const normalized = postcode.replace(/\s/g, '').toUpperCase();
    return this.cache.get(normalized);
  }
}

class UKLandRegistryETL {
  constructor(dbUrl) {
    this.dbUrl = dbUrl;
    this.postcodeLookup = new PostcodeLookup();
    this.stats = {
      processed: 0,
      skipped: 0,
      inserted: 0,
      updated: 0,
      errors: 0
    };
  }

  async run() {
    const startTime = Date.now();
    console.log('🚀 Starting UK Land Registry ETL');
    console.log(`   Max rows: ${MAX_ROWS.toLocaleString()}`);
    console.log('');

    // Connect to database
    const client = new Client({ connectionString: this.dbUrl });
    await client.connect();
    console.log('✅ Database connected');

    try {
      // Record ETL start
      const etlRunResult = await client.query(`
        INSERT INTO etl_runs (source_name, status, started_at)
        VALUES ('uk_land_registry', 'running', NOW())
        RETURNING id
      `);
      const etlRunId = etlRunResult.rows[0].id;

      // Load postcode lookup
      const postcodePath = path.join(__dirname, '..', 'data', 'postcodes', 'postcodes.csv');
      await this.postcodeLookup.load(postcodePath);

      // Process property data
      const csvPath = path.join(__dirname, '..', 'data', 'uk_ppd_trimmed.csv');
      
      if (!fs.existsSync(csvPath)) {
        throw new Error('Property data file not found. Run download step first.');
      }

      const h3Groups = await this.processPropertyData(csvPath);
      
      // Batch insert to database
      await this.upsertToDatabase(client, h3Groups);

      // Refresh aggregated view
      console.log('🔄 Refreshing aggregated view...');
      await client.query('REFRESH MATERIALIZED VIEW heatmap_aggregated');

      // Compute percentiles
      console.log('📊 Computing percentiles...');
      await client.query("SELECT compute_percentiles('GB')");

      // Update ETL run record
      await client.query(`
        UPDATE etl_runs 
        SET status = 'success',
            rows_processed = $1,
            rows_inserted = $2,
            rows_updated = $3,
            completed_at = NOW()
        WHERE id = $4
      `, [this.stats.processed, this.stats.inserted, this.stats.updated, etlRunId]);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('');
      console.log('🎉 ETL Complete!');
      console.log(`   Duration: ${duration}s`);
      console.log(`   Processed: ${this.stats.processed.toLocaleString()} transactions`);
      console.log(`   H3 Cells: ${h3Groups.size.toLocaleString()}`);
      console.log(`   Inserted: ${this.stats.inserted}`);
      console.log(`   Updated: ${this.stats.updated}`);
      console.log(`   Errors: ${this.stats.errors}`);

    } catch (error) {
      console.error('❌ ETL failed:', error);
      
      // Record failure
      await client.query(`
        INSERT INTO etl_runs (source_name, status, error_message, started_at, completed_at)
        VALUES ('uk_land_registry', 'failed', $1, NOW(), NOW())
      `, [error.message]);
      
      throw error;
      
    } finally {
      await client.end();
    }
  }

  async processPropertyData(csvPath) {
    console.log('🏠 Processing property transactions...');
    
    const h3Groups = new Map();
    
    return new Promise((resolve, reject) => {
      let rowCount = 0;
      
      fs.createReadStream(csvPath)
        .pipe(csv({
          headers: ['tx_id', 'price', 'date', 'postcode', 'type', 'new', 
                   'duration', 'paon', 'saon', 'street', 'locality', 
                   'city', 'district', 'county', 'ppd_cat', 'record_status']
        }))
        .on('data', (row) => {
          rowCount++;
          
          // Stop at max rows
          if (rowCount > MAX_ROWS) {
            this.destroy();
            return;
          }

          try {
            // Validate price
            const price = parseFloat(row.price);
            if (!price || price < 10000 || price > 10000000) {
              this.stats.skipped++;
              return;
            }

            // Geocode postcode
            const coords = this.postcodeLookup.lookup(row.postcode);
            if (!coords) {
              this.stats.skipped++;
              return;
            }

            // Convert to H3
            const h3Index = h3.latLngToCell(coords.lat, coords.lng, H3_LEVEL);

            // Group by H3
            if (!h3Groups.has(h3Index)) {
              h3Groups.set(h3Index, {
                prices: [],
                dates: [],
                count: 0
              });
            }

            const group = h3Groups.get(h3Index);
            group.prices.push(price);
            group.dates.push(new Date(row.date));
            group.count++;

            this.stats.processed++;

            if (this.stats.processed % 10000 === 0) {
              process.stdout.write(`\r   Processed ${this.stats.processed.toLocaleString()} transactions...`);
            }

          } catch (error) {
            this.stats.errors++;
          }
        })
        .on('end', () => {
          console.log(`\n✅ Processing complete`);
          resolve(h3Groups);
        })
        .on('error', reject);
    });
  }

  async upsertToDatabase(client, h3Groups) {
    console.log('💾 Upserting to database...');
    
    await client.query('BEGIN');
    
    try {
      let processed = 0;
      
      for (const [h3Index, data] of h3Groups.entries()) {
        // Calculate median
        const sortedPrices = data.prices.sort((a, b) => a - b);
        const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
        
        // Calculate date range
        const firstSeen = new Date(Math.min(...data.dates));
        const lastSeen = new Date(Math.max(...data.dates));
        
        // Calculate confidence (0-1 based on sample size and recency)
        const recencyDays = (Date.now() - lastSeen.getTime()) / (1000 * 3600 * 24);
        const sampleFactor = Math.min(1, Math.log10(data.count + 1) / 2);
        const recencyFactor = Math.max(0.3, 1 - (recencyDays / 365));
        const confidence = sampleFactor * recencyFactor;
        
        // Upsert
        const result = await client.query(`
          INSERT INTO heatmap_cells (
            h3_index, h3_level, country_code, region,
            metric_source, metric_type, metric_value,
            transaction_count, confidence_score,
            first_seen, last_seen, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (h3_index, metric_source, metric_type)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            transaction_count = EXCLUDED.transaction_count,
            confidence_score = EXCLUDED.confidence_score,
            last_seen = EXCLUDED.last_seen,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `, [
          h3Index,
          H3_LEVEL,
          'GB',
          null,
          'uk_land_registry',
          'median_price',
          median,
          data.count,
          confidence,
          firstSeen,
          lastSeen
        ]);
        
        if (result.rows[0].inserted) {
          this.stats.inserted++;
        } else {
          this.stats.updated++;
        }
        
        processed++;
        if (processed % 1000 === 0) {
          process.stdout.write(`\r   Upserted ${processed.toLocaleString()} cells...`);
        }
      }
      
      await client.query('COMMIT');
      console.log(`\n✅ Database upsert complete`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

// Main execution
async function main() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable required');
    process.exit(1);
  }

  const etl = new UKLandRegistryETL(dbUrl);
  
  try {
    await etl.run();
    process.exit(0);
  } catch (error) {
    console.error('❌ ETL failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = UKLandRegistryETL;