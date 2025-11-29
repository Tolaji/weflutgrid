const { Client } = require('pg');
require('dotenv').config();

async function verifyData() {
  console.log('🧪 Verifying data...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Check cell count
    const cellResult = await client.query('SELECT COUNT(*) as count FROM heatmap_cells');
    console.log(`✅ Heatmap cells: ${cellResult.rows[0].count}`);

    // Check aggregated view count
    const aggResult = await client.query('SELECT COUNT(*) as count FROM heatmap_aggregated');
    console.log(`✅ Aggregated view: ${aggResult.rows[0].count}`);

    // Show sample data
    console.log('📊 Sample data:');
    const sampleResult = await client.query(`
      SELECT 
        h3_index,
        country_code,
        region,
        metric_value as price,
        transaction_count,
        confidence_score
      FROM heatmap_cells 
      ORDER BY updated_at DESC 
      LIMIT 5
    `);
    console.table(sampleResult.rows);

    // Show H3 level distribution
    console.log('📈 H3 Level Distribution:');
    const levelResult = await client.query(`
      SELECT 
        h3_level,
        COUNT(*) as cell_count,
        AVG(metric_value) as avg_price
      FROM heatmap_aggregated
      GROUP BY h3_level
      ORDER BY h3_level
    `);
    console.table(levelResult.rows);

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyData();