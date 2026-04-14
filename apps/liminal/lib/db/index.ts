import { Pool } from 'pg';

// Log DB host at startup so Railway logs immediately reveal connection issues
// (credentials are never printed — only host, port, and DB name)
if (process.env.DATABASE_URL) {
  try {
    const _u = new URL(process.env.DATABASE_URL);
    console.log(
      `[db] Pool initializing: host=${_u.hostname} port=${_u.port || 5432} db=${_u.pathname.slice(1)}`
    );
    if (_u.hostname === 'host' || _u.hostname === 'localhost') {
      console.error(
        `[db] WARNING: DATABASE_URL hostname is "${_u.hostname}" — this looks like a placeholder. ` +
        'Set DATABASE_URL to ${{Postgres.DATABASE_URL}} in Railway Variables to link the PostgreSQL service.'
      );
    }
  } catch {
    console.error('[db] DATABASE_URL is set but is not a valid URL');
  }
} else {
  console.error('[db] DATABASE_URL is not set — pool will fail on first connect');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

// Schema is inlined so it works in any deploy environment
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_slug TEXT NOT NULL,
  title TEXT,
  input_text TEXT,
  structured_output JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS council_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_session_id UUID NOT NULL REFERENCES tool_sessions(id) ON DELETE CASCADE,
  advisor_name TEXT NOT NULL,
  round INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Additive migrations (idempotent — safe to run on every boot)
ALTER TABLE tool_sessions ADD COLUMN IF NOT EXISTS feedback TEXT;

-- ── Monetization schema additions ──────────────────────────────────────────
-- Role: 'user' (default) or 'oracle' (admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
-- Plan: 'aspirant' (free) or 'fellow' (paid). Extensible to 'trialing', 'canceled', 'grandfathered'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'aspirant';
-- Monthly usage tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_session_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_session_reset TIMESTAMPTZ DEFAULT NOW();
-- Billing placeholders
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_changed_at TIMESTAMPTZ;

-- Lumen SSO: store the Lumen-side userId for epistemic event emission
ALTER TABLE users ADD COLUMN IF NOT EXISTS lumen_user_id TEXT;

-- Username: display name synced from Lumen
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

-- Oracle role is seeded via: npm run seed:oracle (reads ORACLE_EMAIL env var)
-- See scripts/seedOracle.ts

-- Audit log for plan changes and admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;


let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!process.env.DATABASE_URL) {
      const err = new Error('[db] DATABASE_URL is not set — cannot connect to PostgreSQL');
      console.error(err.message);
      initPromise = null; // Allow retry after env is set
      throw err;
    }
    const client = await pool.connect();
    try {
      await client.query(SCHEMA_SQL);
      initialized = true;
    } catch (err) {
      // Critical: reset so the next request can retry instead of
      // permanently returning this rejected promise.
      console.error('[db] Schema initialization failed:', err);
      initPromise = null;
      throw err;
    } finally {
      client.release();
    }
  })();

  return initPromise;
}

export async function query<T>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  await initializeDatabase();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  await initializeDatabase();
  const result = await pool.query(sql, params);
  return (result.rows[0] as T) ?? null;
}

export async function execute(
  sql: string,
  params?: unknown[]
): Promise<void> {
  await initializeDatabase();
  await pool.query(sql, params);
}

export default pool;
