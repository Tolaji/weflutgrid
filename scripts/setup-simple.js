const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function setup() {
  console.log('🆓 WeflutGrid Simple Setup');
  console.log('==========================\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔌 Testing connection...');
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
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Check your DATABASE_URL in .env file');
    console.log('2. Ensure Supabase project is active');
    console.log('3. Check if your IP is whitelisted in Supabase');
    console.log('4. Try using a VPN if you have network restrictions');
  } finally {
    await client.end();
  }
}

setup();