const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Simple SQL parser that handles basic cases
function parseSQL(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inComment = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    
    // Handle comments
    if (!inString && char === '-' && nextChar === '-') {
      inComment = true;
      current += char;
      continue;
    }
    if (inComment && char === '\n') {
      inComment = false;
    }
    if (inComment) {
      current += char;
      continue;
    }
    
    // Handle strings
    if ((char === "'" || char === '"') && !inString) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && sql[i - 1] !== '\\') {
      inString = false;
    }
    
    current += char;
    
    // End of statement
    if (char === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed && trimmed !== ';') {
        statements.push(trimmed);
      }
      current = '';
    }
  }
  
  // Add final statement
  const finalTrimmed = current.trim();
  if (finalTrimmed && finalTrimmed !== ';') {
    statements.push(finalTrimmed);
  }
  
  return statements;
}

async function setup() {
  console.log('🆓 WeflutGrid Final Setup');
  console.log('========================\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔌 Testing connection...');
    await client.connect();
    console.log('✅ Database connected\n');
    
    // Step 1: Create tables one by one
    console.log('📊 Creating tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS heatmap_cells (
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
    
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_h3_source_type_unique 
      ON heatmap_cells (h3_index, metric_source, metric_type)
    `);
    console.log('   ✅ Unique index created');
    
    await client.query('CREATE INDEX IF NOT EXISTS idx_h3_level ON heatmap_cells (h3_level)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_country ON heatmap_cells (country_code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_updated ON heatmap_cells (updated_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_h3_index ON heatmap_cells (h3_index)');
    console.log('   ✅ Performance indexes created');
    
    // Step 2: Create materialized view
    console.log('📈 Creating materialized view...');
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS heatmap_aggregated AS
      SELECT 
        h3_index,
        h3_level,
        country_code,
        region,
        SUM(metric_value * confidence_score) / NULLIF(SUM(confidence_score), 0) AS weighted_metric,
        SUM(transaction_count) AS tx_count,
        AVG(confidence_score) AS avg_confidence,
        0.5 AS normalized_value,
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
    
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_aggregated_h3 ON heatmap_aggregated (h3_index)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_aggregated_level ON heatmap_aggregated (h3_level)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_aggregated_country ON heatmap_aggregated (country_code)');
    console.log('   ✅ Aggregated indexes created');
    
    // Step 3: Create functions
    console.log('⚙️  Creating functions...');
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_heatmap_aggregated()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY heatmap_aggregated;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('   ✅ Refresh function created');
    
    // Step 4: Create ETL table
    await client.query(`
      CREATE TABLE IF NOT EXISTS etl_runs (
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
    await client.query('CREATE INDEX IF NOT EXISTS idx_etl_source ON etl_runs (source_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_etl_started ON etl_runs (started_at DESC)');
    console.log('   ✅ ETL table created');
    
    // Step 5: Load sample data
    console.log('📍 Loading sample data...');
    const samplesPath = path.join(__dirname, '..', 'database', 'seeds', 'sample_data_simple.sql');
    const samples = fs.readFileSync(samplesPath, 'utf8');
    const sampleStatements = parseSQL(samples);
    
    for (let i = 0; i < sampleStatements.length; i++) {
      try {
        await client.query(sampleStatements[i]);
        console.log(`   ✅ Sample statement ${i + 1}/${sampleStatements.length} executed`);
      } catch (error) {
        console.log(`   ⚠️  Sample statement ${i + 1} skipped: ${error.message}`);
      }
    }
    
    // Step 6: Verify setup
    console.log('🧪 Verifying setup...');
    const cellCount = await client.query('SELECT COUNT(*) as count FROM heatmap_cells');
    const aggCount = await client.query('SELECT COUNT(*) as count FROM heatmap_aggregated');
    
    console.log(`✅ Heatmap cells: ${cellCount.rows[0].count} rows`);
    console.log(`✅ Aggregated data: ${aggCount.rows[0].count} rows`);
    
    console.log('\n🎉 Setup complete!');
    console.log('\nNext steps:');
    console.log('  1. Run: cd vercel-tiles && npm install && vercel --prod');
    console.log('  2. Update mobile app with Vercel URL');
    console.log('  3. Run: cd weflutgrid-mobile && npm install && npx expo start');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    await client.end();
  }
}

setup();