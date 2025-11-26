const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function setup() {
  console.log('🆓 WeflutGrid Windows Setup');
  console.log('==========================\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Database connected\n');
    
    console.log('📊 Creating schema...');
    const schema = fs.readFileSync('./database/schema.sql', 'utf8');
    await client.query(schema);
    console.log('✅ Schema created\n');
    
    console.log('📍 Loading sample data...');
    const samples = fs.readFileSync('./database/seeds/sample_data.sql', 'utf8');
    await client.query(samples);
    console.log('✅ Sample data loaded\n');
    
    console.log('🎉 Setup complete!');
    console.log('\nNext steps:');
    console.log('  1. cd vercel-tiles && npm install && vercel --prod');
    console.log('  2. Update weflutgrid-mobile/app.json with Vercel URL');
    console.log('  3. cd weflutgrid-mobile && npm install && npx expo start');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();