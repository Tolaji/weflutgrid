const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
  console.log('🆓 WeflutGrid Setup (No H3 Extensions)');
  console.log('=====================================\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔌 Testing connection...');
    await client.connect();
    console.log('✅ Database connected\n');
    
    console.log('📊 Creating schema (no H3 extensions)...');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema-no-h3.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema statements one by one
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement && !statement.startsWith('--')) {
        try {
          await client.query(statement);
          console.log(`   ✅ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          console.log(`   ⚠️  Statement ${i + 1} skipped: ${error.message}`);
        }
      }
    }
    console.log('✅ Schema created\n');
    
    console.log('📍 Loading sample data...');
    const samplesPath = path.join(__dirname, '..', 'database', 'seeds', 'sample_data.sql');
    const samples = fs.readFileSync(samplesPath, 'utf8');
    await client.query(samples);
    console.log('✅ Sample data loaded\n');
    
    // Test the setup
    console.log('🧪 Testing data access...');
    const testResult = await client.query('SELECT COUNT(*) as count FROM heatmap_cells');
    console.log(`✅ Sample data: ${testResult.rows[0].count} rows loaded`);
    
    const aggregatedResult = await client.query('SELECT COUNT(*) as count FROM heatmap_aggregated');
    console.log(`✅ Aggregated data: ${aggregatedResult.rows[0].count} rows`);
    
    console.log('🎉 Setup complete!');
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