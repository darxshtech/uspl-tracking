import mysql from 'mysql2/promise';

const globalForDb = globalThis as unknown as {
  _mysqlPool: mysql.Pool | undefined;
};

const pool = globalForDb._mysqlPool ?? mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'employee_tracking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 15000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

if (process.env.NODE_ENV !== 'production') globalForDb._mysqlPool = pool;

export default pool;
