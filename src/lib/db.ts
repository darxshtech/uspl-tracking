import mysql from 'mysql2/promise';

const globalForDb = globalThis as unknown as {
  _mysqlPool: mysql.Pool | undefined;
  _wrappedPool: boolean | undefined;
};

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY
);

// Safe connection limit for hosting with max 16 user connections total (e.g. cPanel).
// In Vercel serverless, each lambda container serves 1 request at a time, so connectionLimit = 1.
// In Node.js / cPanel / local dev, defaults to 3 to leave headroom for Vercel lambdas & background tasks.
const defaultLimit = isServerless ? '1' : '3';
const connectionLimit = parseInt(process.env.DB_CONNECTION_LIMIT || defaultLimit, 10);

const pool = globalForDb._mysqlPool ?? mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'employee_tracking',
  waitForConnections: true,
  dateStrings: true,
  connectionLimit,
  maxIdle: isServerless ? 0 : 1, // Never hold idle connections open inside frozen serverless containers
  idleTimeout: isServerless ? 2000 : 10000, // Drop idle connections fast
  queueLimit: 0, // In-memory queue: incoming requests wait safely without failing
  connectTimeout: 10000, // 10s connection timeout
  enableKeepAlive: !isServerless, // Do NOT keepalive across frozen serverless instances
  keepAliveInitialDelay: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// Automatically set MySQL session timeouts to 10 seconds.
// If a serverless function freezes or connection sits idle for 10s,
// MySQL server will automatically terminate it and reclaim the connection slot.
(pool as any).on?.('connection', (conn: any) => {
  conn.query?.('SET SESSION wait_timeout = 10, interactive_timeout = 10').catch?.(() => {});
});

// Catch pool errors safely
(pool as any).on?.('error', (err: any) => {
  console.error('[DB Pool Warning/Error]:', err?.message || err);
});

function isConnectionExhaustionError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err.message === 'string' ? err.message : '';
  const code = err.code || '';
  const errno = err.errno;
  return (
    code === 'ER_USER_LIMIT_REACHED' ||
    code === 'ER_TOO_MANY_USER_CONNECTIONS' ||
    code === 'ER_CON_COUNT_ERROR' ||
    errno === 1203 ||
    errno === 1040 ||
    msg.includes('max_user_connections') ||
    msg.includes('Too many connections') ||
    msg.includes('Connection lost') ||
    msg.includes('PROTOCOL_CONNECTION_LOST') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT')
  );
}

async function withRetry<T>(operation: () => Promise<T>, maxRetries = 6): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      if (isConnectionExhaustionError(err) && attempt <= maxRetries) {
        // Backoff with random jitter: 200ms, 400ms, 800ms, 1400ms, 2000ms
        const delay = Math.min(2500, Math.floor(Math.pow(2, attempt - 1) * 200 + Math.random() * 150));
        console.warn(
          `[DB Pool] Connection limit / exhaustion detected (${err.message || err.code}). Retrying query in ${delay}ms (attempt ${attempt}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (isConnectionExhaustionError(err)) {
        console.error(`[DB Pool] Max retries exhausted for connection limit error:`, err.message);
        const friendlyError = new Error(
          "The database server is currently experiencing high activity. Please try again in a few seconds."
        );
        (friendlyError as any).code = err.code || 'ER_USER_LIMIT_REACHED';
        (friendlyError as any).errno = err.errno || 1203;
        throw friendlyError;
      }

      throw err;
    }
  }
}

// Transparently wrap query, execute, and getConnection if not already wrapped
if (!globalForDb._wrappedPool) {
  const originalQuery = pool.query.bind(pool);
  const originalExecute = pool.execute.bind(pool);
  const originalGetConnection = pool.getConnection.bind(pool);

  pool.query = (async (...args: any[]) => {
    return withRetry(() => (originalQuery as any)(...args));
  }) as any;

  pool.execute = (async (...args: any[]) => {
    return withRetry(() => (originalExecute as any)(...args));
  }) as any;

  pool.getConnection = (async (...args: any[]) => {
    return withRetry(async () => {
      const conn = await (originalGetConnection as any)(...args);
      return conn;
    });
  }) as any;

  globalForDb._wrappedPool = true;
}

globalForDb._mysqlPool = pool;

export default pool;

