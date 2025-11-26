const { Client } = require('pg');
require('dotenv').config();

async function testTransactionPooler() {
  console.log('🔌 Testing Transaction Pooler connection...');
  
  // Try different SSL configurations
  const configs = [
    {
      name: 'SSL with reject unauthorized',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'SSL without reject unauthorized',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: true
      }
    },
    {
      name: 'No SSL',
      config: {
        connectionString: process.env.DATABASE_URL,
        ssl: false
      }
    }
  ];

  for (const { name, config } of configs) {
    console.log(`\n🔄 Trying: ${name}...`);
    
    const client = new Client(config);

    try {
      await client.connect();
      const result = await client.query('SELECT NOW() as current_time');
      console.log(`✅ ${name} - SUCCESS!`);
      console.log(`   Database time: ${result.rows[0].current_time}`);
      
      // Test schema creation
      console.log('📊 Testing schema creation...');
      const schema = `
        CREATE TABLE IF NOT EXISTS test_connection (
          id SERIAL PRIMARY KEY,
          message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await client.query(schema);
      console.log('✅ Test table created');
      
      await client.end();
      return true;
      
    } catch (error) {
      console.log(`❌ ${name} - Failed: ${error.message}`);
    }
  }
  
  console.log('\n💡 All connection attempts failed.');
  console.log('   This might be a network/firewall issue.');
  return false;
}

testTransactionPooler();