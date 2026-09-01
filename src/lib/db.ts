import mysql from 'mysql2/promise';

const globalForDb = globalThis as unknown as {
  _mysqlPool: mysql.Pool | undefined;
};

// Resilient singleton connection pool optimized for hosting with limited max_user_connections (e.g. max 16)
const pool = globalForDb._mysqlPool ?? mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'employee_tracking',
  waitForConnections: true,
  dateStrings: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '12', 10),
  maxIdle: 6, // Maintain warm idle connections
  idleTimeout: 30000, // 30s idle timeout
  queueLimit: 500, // Queue incoming queries gracefully
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

globalForDb._mysqlPool = pool;

export default pool;
