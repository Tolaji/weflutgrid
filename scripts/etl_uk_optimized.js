#!/usr/bin/env node
/**
* Optimized ETL for UK Land Registry pp-2025.csv
* Processes downloaded data and creates visible heatmap
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
const DATA_FILE = process.env.DATA_FILE || 'data/uk_ppd_trimmed.csv';

// UK Land Registry CSV columns (no headers in file)
const COLUMNS = [
'tx_id', 'price', 'date', 'postcode', 'type', 'new',
'duration', 'paon', 'saon', 'street', 'locality',
'city', 'district', 'county', 'ppd_cat', 'record_status'
];

class PostcodeLookup {
  constructor() {
    this.cache = new Map();
  }

  async load(csvPath) {
    console.log('📍 Loading postcode lookup...');

    return new Promise((resolve, reject) => {
      let count = 0;
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          const postcode = row.postcode.replace(/\s/g, '').toUpperCase();
          this.cache.set(postcode, {
            lat: parseFloat(row.latitude),
            lng: parseFloat(row.longitude)
          });
          count++;
          if (count % 100000 === 0) {
            process.stdout.write(`   Loaded ${count.toLocaleString()} postcodes...`);
          }
        })
        .on('end', () => {
          console.log(`✅ Loaded ${this.cache.size.toLocaleString()} postcodes`);
          resolve();
        })
        .on('error', reject);
    });
  }

  lookup(postcode) {
    if (!postcode) return null;
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
      geocoded: 0,
      noGeocode: 0,
      inserted: 0,
      updated: 0,
      errors: 0
    };
  }

  async run() {
    const startTime = Date.now();
    console.log('🚀 Starting UK Land Registry ETL');
    console.log(`   Data file: ${DATA_FILE}`);
    console.log(`   Max rows: ${MAX_ROWS.toLocaleString()}`);
    console.log('');

    // Connect to database
    const client = new Client({ 
      connectionString: this.dbUrl,
      ssl: { rejectUnauthorized: false }
    });
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
      if (!fs.existsSync(postcodePath)) {
        throw new Error('Postcode lookup not found. Run: node scripts/download_postcodes.js');
      }
      await this.postcodeLookup.load(postcodePath);

      // Process property data
      console.log('');
      console.log('🏠 Processing property transactions...');
      const h3Groups = await this.processPropertyData(DATA_FILE);

      console.log('');
      console.log(`📊 Statistics:`);
      console.log(`   Total processed: ${this.stats.processed.toLocaleString()}`);
      console.log(`   Geocoded: ${this.stats.geocoded.toLocaleString()}`);
      console.log(`   No geocode: ${this.stats.noGeocode.toLocaleString()}`);
      console.log(`   Skipped (price filter): ${this.stats.skipped.toLocaleString()}`);
      console.log(`   H3 cells created: ${h3Groups.size.toLocaleString()}`);
      console.log('');

      // Batch insert to database
      await this.upsertToDatabase(client, h3Groups);

      // Refresh aggregated view
      console.log('');
      console.log('🔄 Refreshing aggregated view...');
      await client.query('REFRESH MATERIALIZED VIEW heatmap_aggregated');
      console.log('✅ Aggregated view refreshed');

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

      // Show some sample data
      console.log('');
      console.log('📍 Sample hexagons created:');
      const samples = await client.query(`
        SELECT h3_index, region, metric_value, transaction_count, confidence_score
        FROM heatmap_cells 
        ORDER BY transaction_count DESC 
        LIMIT 5
      `);
      console.table(samples.rows);

    } catch (error) {
      console.error('❌ ETL failed:', error);

      // Record failure
      await client.query(`
        UPDATE etl_runs 
        SET status = 'failed', 
        error_message = $1, 
        completed_at = NOW()
        WHERE source_name = 'uk_land_registry' 
        AND status = 'running'
      `, [error.message]);

      throw error;

    } finally {
      await client.end();
    }
  }

  async processPropertyData(csvPath) {
    const h3Groups = new Map();

    return new Promise((resolve, reject) => {
      let rowCount = 0;
      const stream = fs.createReadStream(csvPath)
        .pipe(csv({ headers: COLUMNS }))
        .on('data', (row) => {
          rowCount++;

          // Stop at max rows
          if (rowCount > MAX_ROWS) {
            stream.destroy();
            return;
          }

          try {
            // Parse and validate price
            const price = parseFloat(row.price);
            if (!price || price < 10000 || price > 10000000) {
              this.stats.skipped++;
              return;
            }

            // Geocode postcode
            const coords = this.postcodeLookup.lookup(row.postcode);
            if (!coords) {
              this.stats.noGeocode++;
              this.stats.processed++;
              return;
            }

            this.stats.geocoded++;

            // Convert to H3
            const h3Index = h3.latLngToCell(coords.lat, coords.lng, H3_LEVEL);

            // Group by H3
            if (!h3Groups.has(h3Index)) {
              h3Groups.set(h3Index, {
                prices: [],
                dates: [],
                count: 0,
                region: row.city || row.district || row.county || 'Unknown'
              });
            }

            const group = h3Groups.get(h3Index);
            group.prices.push(price);
            group.dates.push(new Date(row.date));
            group.count++;

            this.stats.processed++;

            if (this.stats.processed % 10000 === 0) {
              process.stdout.write(`   Processed ${this.stats.processed.toLocaleString()} transactions, ${h3Groups.size.toLocaleString()} H3 cells...`);
            }

          } catch (error) {
            this.stats.errors++;
          }
        })
        .on('end', () => {
          console.log(`✅ Processing complete: ${this.stats.processed.toLocaleString()} transactions`);
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
          data.region,
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
          process.stdout.write(`   Upserted ${processed.toLocaleString()} cells...`);
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Database upsert complete: ${processed.toLocaleString()} cells`);

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
    console.error('   Create .env file with: DATABASE_URL=your_connection_string');
    process.exit(1);
  }

  // Check if data file exists
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ Data file not found: ${DATA_FILE}`);
    console.error('');
    console.error('Quick fix:');
    console.error('  1. Ensure pp-2025.csv is in your project root');
    console.error('  2. Run: mkdir -p data && head -n 100000 pp-2025.csv > data/uk_ppd_trimmed.csv');
    console.error('');
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