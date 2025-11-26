// import { Client, Pool, PoolConfig } from 'pg';

// const config: PoolConfig = {
//   connectionString: process.env.DATABASE_URL,
//   ssl: process.env.NODE_ENV === 'production' 
//     ? { rejectUnauthorized: false } 
//     : false,
//   max: 10,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 5000
// };

// export const pool = new Pool(config);

// // Test connection
// pool.on('connect', () => {
//   console.log('✅ Database pool connected');
// });

// pool.on('error', (err) => {
//   console.error('❌ Unexpected database error:', err);
//   process.exit(-1);
// });

// export async function testConnection(): Promise<boolean> {
//   try {
//     const result = await pool.query('SELECT NOW()');
//     console.log('Database time:', result.rows[0].now);
//     return true;
//   } catch (error) {
//     console.error('Database connection failed:', error);
//     return false;
//   }
// }

// export async function closePool(): Promise<void> {
//   await pool.end();
//   console.log('Database pool closed');
// }


import { Pool, PoolConfig } from 'pg';

const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

export const pool = new Pool(config);

pool.on('connect', () => {
  console.log('✅ Database connected via Transaction Pooler');
});

export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Transaction Pooler connection successful');
    return true;
  } catch (error: any) {
    console.error('❌ Transaction Pooler connection failed:', error.message);
    return false;
  }
}