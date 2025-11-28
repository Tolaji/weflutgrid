const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
  console.log('🆓 WeflutGrid Working Setup');
  console.log('==========================\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔌 Testing connection...');
    await client.connect();
    console.log('✅ Database connected\n');
    
    // Step 1: Drop existing tables if they exist (clean start)
    console.log('🧹 Cleaning existing tables...');
    try {
      await client.query('DROP MATERIALIZED VIEW IF EXISTS heatmap_aggregated CASCADE');
      await client.query('DROP TABLE IF EXISTS etl_runs CASCADE');
      await client.query('DROP TABLE IF EXISTS heatmap_cells CASCADE');
      await client.query('DROP FUNCTION IF EXISTS refresh_heatmap_aggregated CASCADE');
      await client.query('DROP FUNCTION IF EXISTS compute_percentiles CASCADE');
      console.log('   ✅ Cleaned existing schema');
    } catch (error) {
      console.log('   ⚠️  Cleanup skipped:', error.message);
    }
    
    // Step 2: Create main table with ALL columns
    console.log('📊 Creating main table...');
    await client.query(`
      CREATE TABLE heatmap_cells (
        id BIGSERIAL PRIMARY KEY,
        h3_index TEXT NOT NULL,
        h3_level INT NOT NULL,
        country_code TEXT,
        region TEXT,
        metric_source TEXT NOT NULL,
        metric_type TEXT NOT NULL DEFAULT 'median_price',
        metric_value NUMERIC,
        transaction_count INT DEFAULT 0,
        confidence_score NUMERIC DEFAULT 0.0,
        first_seen TIMESTAMPTZ,
        last_seen TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('   ✅ heatmap_cells table created');
    
    // Step 3: Create indexes
    console.log('📈 Creating indexes...');
    await client.query(`
      CREATE UNIQUE INDEX idx_h3_source_type_unique 
      ON heatmap_cells (h3_index, metric_source, metric_type)
    `);
    console.log('   ✅ Unique index created');
    
    await client.query('CREATE INDEX idx_h3_level ON heatmap_cells (h3_level)');
    await client.query('CREATE INDEX idx_country ON heatmap_cells (country_code)');
    await client.query('CREATE INDEX idx_updated ON heatmap_cells (updated_at DESC)');
    await client.query('CREATE INDEX idx_h3_index ON heatmap_cells (h3_index)');
    console.log('   ✅ Performance indexes created');
    
    // Step 4: Create materialized view WITHOUT normalized_value initially
    console.log('📊 Creating materialized view...');
    await client.query(`
      CREATE MATERIALIZED VIEW heatmap_aggregated AS
      SELECT 
        h3_index,
        h3_level,
        country_code,
        region,
        SUM(metric_value * confidence_score) / NULLIF(SUM(confidence_score), 0) AS weighted_metric,
        SUM(transaction_count) AS tx_count,
        AVG(confidence_score) AS avg_confidence,
        MAX(last_seen) AS last_update,
        CASE 
          WHEN MAX(last_seen) > NOW() - INTERVAL '7 days' THEN 'fresh'
          WHEN MAX(last_seen) > NOW() - INTERVAL '30 days' THEN 'recent'
          ELSE 'stale'
        END AS freshness
      FROM heatmap_cells
      WHERE metric_type = 'median_price'
      GROUP BY h3_index, h3_level, country_code, region
    `);
    console.log('   ✅ Materialized view created');
    
    // Step 5: Create indexes on materialized view
    await client.query('CREATE UNIQUE INDEX idx_aggregated_h3 ON heatmap_aggregated (h3_index)');
    await client.query('CREATE INDEX idx_aggregated_level ON heatmap_aggregated (h3_level)');
    await client.query('CREATE INDEX idx_aggregated_country ON heatmap_aggregated (country_code)');
    console.log('   ✅ Aggregated indexes created');
    
    // Step 6: Create refresh function
    console.log('⚙️  Creating refresh function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_heatmap_aggregated()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY heatmap_aggregated;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('   ✅ Refresh function created');
    
    // Step 7: Create ETL tracking table
    console.log('📝 Creating ETL table...');
    await client.query(`
      CREATE TABLE etl_runs (
        id BIGSERIAL PRIMARY KEY,
        source_name TEXT NOT NULL,
        status TEXT NOT NULL,
        rows_processed INT DEFAULT 0,
        rows_inserted INT DEFAULT 0,
        rows_updated INT DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
    await client.query('CREATE INDEX idx_etl_source ON etl_runs (source_name)');
    await client.query('CREATE INDEX idx_etl_started ON etl_runs (started_at DESC)');
    console.log('   ✅ ETL table created');
    
    // Step 8: Create a VIEW (not function) for percentile computation
    console.log('📊 Creating percentile view...');
    await client.query(`
      CREATE OR REPLACE VIEW heatmap_with_percentiles AS
      SELECT 
        a.*,
        CASE
          WHEN a.weighted_metric <= p.p10 THEN 0.1
          WHEN a.weighted_metric <= p.p25 THEN 0.25
          WHEN a.weighted_metric <= p.p50 THEN 0.5
          WHEN a.weighted_metric <= p.p75 THEN 0.75
          WHEN a.weighted_metric <= p.p90 THEN 0.9
          ELSE 1.0
        END AS normalized_value
      FROM heatmap_aggregated a
      CROSS JOIN (
        SELECT
          PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY weighted_metric) AS p10,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY weighted_metric) AS p25,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY weighted_metric) AS p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY weighted_metric) AS p75,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY weighted_metric) AS p90
        FROM heatmap_aggregated
      ) p
    `);
    console.log('   ✅ Percentile view created');
    
    // Step 9: Load sample data
    console.log('📍 Loading sample data...');
    const sampleData = [
      ['8a1969492d7ffff', 10, 'GB', 'London', 'sample', 'median_price', 850000, 25, 0.9],
      ['8a19694929bffff', 10, 'GB', 'London', 'sample', 'median_price', 920000, 18, 0.85],
      ['8a196949297ffff', 10, 'GB', 'London', 'sample', 'median_price', 780000, 32, 0.92],
      ['8a19694d2d7ffff', 10, 'GB', 'London', 'sample', 'median_price', 450000, 45, 0.95],
      ['8a19694d29bffff', 10, 'GB', 'London', 'sample', 'median_price', 520000, 38, 0.9],
      ['8a196d452d7ffff', 10, 'GB', 'Manchester', 'sample', 'median_price', 280000, 52, 0.93],
      ['8a196d4529bffff', 10, 'GB', 'Manchester', 'sample', 'median_price', 310000, 41, 0.88]
    ];
    
    for (let i = 0; i < sampleData.length; i++) {
      const [h3_index, h3_level, country_code, region, metric_source, metric_type, metric_value, transaction_count, confidence_score] = sampleData[i];
      
      await client.query(`
        INSERT INTO heatmap_cells (
          h3_index, h3_level, country_code, region,
          metric_source, metric_type, metric_value,
          transaction_count, confidence_score,
          first_seen, last_seen
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      `, [h3_index, h3_level, country_code, region, metric_source, metric_type, metric_value, transaction_count, confidence_score]);
    }
    console.log(`   ✅ ${sampleData.length} sample records inserted`);
    
    // Step 10: Refresh materialized view
    console.log('🔄 Refreshing materialized view...');
    await client.query('REFRESH MATERIALIZED VIEW heatmap_aggregated');
    console.log('   ✅ Materialized view refreshed');
    
    // Step 11: Verify setup
    console.log('🧪 Verifying setup...');
    const cellCount = await client.query('SELECT COUNT(*) as count FROM heatmap_cells');
    const aggCount = await client.query('SELECT COUNT(*) as count FROM heatmap_aggregated');
    const percentileCount = await client.query('SELECT COUNT(*) as count FROM heatmap_with_percentiles');
    const etlCount = await client.query('SELECT COUNT(*) as count FROM etl_runs');
    
    console.log(`✅ Heatmap cells: ${cellCount.rows[0].count} rows`);
    console.log(`✅ Aggregated data: ${aggCount.rows[0].count} rows`);
    console.log(`✅ Percentile view: ${percentileCount.rows[0].count} rows`);
    console.log(`✅ ETL runs: ${etlCount.rows[0].count} rows`);
    
    // Test a sample query with percentiles
    const sampleQuery = await client.query(`
      SELECT h3_index, weighted_metric, tx_count, normalized_value
      FROM heatmap_with_percentiles 
      LIMIT 3
    `);
    console.log('✅ Sample query successful');
    console.log('   Sample data:', sampleQuery.rows.map(row => ({
      h3: row.h3_index,
      price: row.weighted_metric,
      count: row.tx_count,
      percentile: row.normalized_value
    })));
    
    console.log('\n🎉 SETUP COMPLETE!');
    console.log('\n📝 IMPORTANT: Update your tile API to use `heatmap_with_percentiles` view instead of `heatmap_aggregated`');
    console.log('\n🚀 Next steps:');
    console.log('   1. Update vercel-tiles/api/tiles/[z]/[x]/[y].js to query heatmap_with_percentiles');
    console.log('   2. Deploy tile API: cd vercel-tiles && npm install && vercel --prod');
    console.log('   3. Update mobile app with your Vercel URL');
    console.log('   4. Run mobile app: cd weflutgrid-mobile && npm install && npx expo start');
    console.log('\n💡 Your database is ready for ETL processing!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('   Full error:', error);
  } finally {
    await client.end();
  }
}

setup();