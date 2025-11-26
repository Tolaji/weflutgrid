const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  console.log('🔌 Testing database connection...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database!');
    
    const result = await client.query('SELECT version()');
    console.log('📊 Database version:', result.rows[0].version);
    
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    // Try without SSL
    console.log('🔄 Trying without SSL...');
    const clientNoSSL = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: false
    });
    
    try {
      await clientNoSSL.connect();
      console.log('✅ Connected without SSL!');
      await clientNoSSL.end();
      return true;
    } catch (error2) {
      console.error('❌ Connection without SSL also failed:', error2.message);
      return false;
    }
  }
}

testConnection();