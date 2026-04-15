import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import fs from "fs";

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/axiom.db`
  : process.env.DATA_DIR
    ? `${process.env.DATA_DIR}/axiom.db`
    : path.resolve(process.cwd(), "axiom.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const volumeSet = !!process.env.RAILWAY_VOLUME_MOUNT_PATH;
console.log(`[axiom/db] SQLite path: ${dbPath}`);
console.log(`[axiom/db] RAILWAY_VOLUME_MOUNT_PATH: ${process.env.RAILWAY_VOLUME_MOUNT_PATH ?? '(NOT SET)'}`);
console.log(`[axiom/db] Persistent volume: ${volumeSet ? 'YES' : 'NO \u2014 data will be lost on redeploy'}`);
if (!volumeSet) {
  console.warn('[axiom/db] \u26a0\ufe0f  Set RAILWAY_VOLUME_MOUNT_PATH in Railway Variables to persist data across deploys.');
}
const dbExists = fs.existsSync(dbPath);
console.log(`[axiom/db] DB file exists: ${dbExists}${dbExists ? ` (${(fs.statSync(dbPath).size / 1024).toFixed(1)} KB)` : ' \u2014 will create fresh'}`);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS axioms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    liminal_count INTEGER NOT NULL DEFAULT 0,
    parallax_count INTEGER NOT NULL DEFAULT 0,
    praxis_count INTEGER NOT NULL DEFAULT 0,
    input_descriptions TEXT NOT NULL DEFAULT '[]',
    signal TEXT NOT NULL DEFAULT '',
    convergence TEXT NOT NULL DEFAULT '',
    interpretation TEXT NOT NULL DEFAULT '',
    truth_claim TEXT NOT NULL,
    working_principle TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'medium',
    confidence_score INTEGER NOT NULL DEFAULT 50,
    counterevidence TEXT NOT NULL DEFAULT '',
    revision_note TEXT NOT NULL DEFAULT '',
    revision_history TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pole_a TEXT NOT NULL,
    pole_b TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence TEXT NOT NULL DEFAULT '[]',
    related_axiom_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    previous_belief TEXT NOT NULL,
    new_belief TEXT NOT NULL,
    triggering_evidence TEXT NOT NULL DEFAULT '',
    significance TEXT NOT NULL DEFAULT 'moderate',
    related_axiom_id INTEGER,
    created_at TEXT NOT NULL
  );
`);

// ─── Auth migrations ──────────────────────────────────────────────────────────
try { sqlite.exec(`ALTER TABLE axioms ADD COLUMN user_id TEXT NOT NULL DEFAULT '1'`); } catch {}
try { sqlite.exec(`ALTER TABLE tensions ADD COLUMN user_id TEXT NOT NULL DEFAULT '1'`); } catch {}
try { sqlite.exec(`ALTER TABLE revisions ADD COLUMN user_id TEXT NOT NULL DEFAULT '1'`); } catch {}

// Add source column to axioms (no-op if exists)
try { sqlite.exec("ALTER TABLE axioms ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'"); } catch {}

// Add stage column: proving_ground (default) or constitutional
try { sqlite.exec("ALTER TABLE axioms ADD COLUMN stage TEXT NOT NULL DEFAULT 'proving_ground'"); } catch {}

// Mark seeded axioms as constitutional (they were manually crafted originals)
try {
  sqlite.exec(`UPDATE axioms SET stage = 'constitutional' WHERE source = 'seeded'`);
} catch {}

// Mark original seeded axioms (first 5 per user)
try {
  const manualCount = sqlite.prepare(`SELECT COUNT(*) as cnt FROM axioms WHERE user_id = '1' AND source = 'manual'`).get() as { cnt: number };
  if (manualCount.cnt > 0) {
    sqlite.exec(`UPDATE axioms SET source = 'seeded' WHERE user_id = '1' AND number <= 5 AND source = 'manual'`);
  }
} catch {}

// Create constitutions table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS constitutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    preamble TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS axiom_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    lumen_user_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL
  )
`);

// Additive migration: plan column (no-op if already exists)
try { sqlite.exec("ALTER TABLE axiom_users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'"); } catch {}

// ─── Grounding / calibration migrations ──────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS grounding_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    axiom_id INTEGER NOT NULL,
    user_id TEXT NOT NULL DEFAULT '1',
    axis TEXT NOT NULL,
    value TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    source_app TEXT NOT NULL DEFAULT '',
    source_record_id TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE(axiom_id, axis)
  )
`);

try { sqlite.exec("ALTER TABLE axioms ADD COLUMN grounding_verdict TEXT NOT NULL DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE axioms ADD COLUMN falsification_conditions TEXT NOT NULL DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE axioms ADD COLUMN last_grounding_at TEXT NOT NULL DEFAULT ''"); } catch {}

// ─── Tension lifecycle migrations ────────────────────────────────────────────
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN status TEXT NOT NULL DEFAULT 'surfaced'"); } catch {}
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN signal_count INTEGER NOT NULL DEFAULT 0"); } catch {}
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN first_surfaced_at TEXT NOT NULL DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN last_signal_at TEXT NOT NULL DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN salience INTEGER NOT NULL DEFAULT 0"); } catch {}
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN resolution_direction TEXT NOT NULL DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN nominated_at TEXT NOT NULL DEFAULT ''"); } catch {}
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN source_apps TEXT NOT NULL DEFAULT '[]'"); } catch {}

// Backfill first_surfaced_at from created_at for existing tensions
try { sqlite.exec("UPDATE tensions SET first_surfaced_at = created_at WHERE first_surfaced_at = ''"); } catch {}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS tension_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tension_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    source_app TEXT NOT NULL,
    source_record_id TEXT NOT NULL DEFAULT '',
    signal_type TEXT NOT NULL,
    pole_affected TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    confidence INTEGER NOT NULL DEFAULT 500,
    created_at TEXT NOT NULL
  )
`);
