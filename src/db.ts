import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import path from 'path';
import {
  epistemicEvents,
  epistemicCandidates,
  candidateEdges,
  axiomStatements,
  axiomProvenance,
  watchRules,
  promptQueue,
} from './schema/epistemic';

// ─── Schema ──────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  username:     text('username').notNull().unique(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    text('created_at').notNull(),
});

export type User = typeof users.$inferSelect;

// Re-export epistemic schema for convenience
export {
  epistemicEvents,
  epistemicCandidates,
  candidateEdges,
  axiomStatements,
  axiomProvenance,
  watchRules,
  promptQueue,
};

// ─── Connection ───────────────────────────────────────────────────────────────

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/lumen.db`
  : path.resolve(process.cwd(), 'lumen.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, {
  schema: {
    users,
    epistemicEvents,
    epistemicCandidates,
    candidateEdges,
    axiomStatements,
    axiomProvenance,
    watchRules,
    promptQueue,
  },
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT NOT NULL UNIQUE,
    email        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at   TEXT NOT NULL
  )
`);

// ─── Epistemic Migrations ────────────────────────────────────────────────────

function runEpistemicMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS epistemic_events (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      source_app       TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      event_type       TEXT NOT NULL,
      epistemic_status TEXT NOT NULL DEFAULT 'candidate',
      seeded           INTEGER NOT NULL DEFAULT 0,
      ingestion_mode   TEXT NOT NULL DEFAULT 'live',
      confidence       REAL NOT NULL DEFAULT 0,
      salience         REAL NOT NULL DEFAULT 0,
      domain           TEXT,
      tags             TEXT NOT NULL DEFAULT '[]',
      evidence         TEXT NOT NULL DEFAULT '[]',
      payload          TEXT NOT NULL DEFAULT '{}',
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    )
  `);

  sqlite.exec(`CREATE INDEX IF NOT EXISTS epistemic_events_user_idx ON epistemic_events(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS epistemic_events_type_idx ON epistemic_events(event_type)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS epistemic_events_source_idx ON epistemic_events(source_app, source_record_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS epistemic_events_dedupe_idx ON epistemic_events(source_app, source_record_id, event_type)`);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS epistemic_candidates (
      id                   TEXT PRIMARY KEY,
      user_id              TEXT NOT NULL,
      candidate_type       TEXT NOT NULL,
      title                TEXT NOT NULL,
      summary              TEXT NOT NULL,
      status               TEXT NOT NULL DEFAULT 'open',
      target_app           TEXT,
      confidence           REAL NOT NULL DEFAULT 0,
      recurrence_score     REAL NOT NULL DEFAULT 0,
      contradiction_score  REAL NOT NULL DEFAULT 0,
      actionability_score  REAL NOT NULL DEFAULT 0,
      seeded               INTEGER NOT NULL DEFAULT 0,
      origin_mode          TEXT NOT NULL DEFAULT 'live',
      seed_label           TEXT,
      source_event_ids     TEXT NOT NULL DEFAULT '[]',
      supporting_evidence  TEXT NOT NULL DEFAULT '[]',
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL
    )
  `);

  sqlite.exec(`CREATE INDEX IF NOT EXISTS epistemic_candidates_user_idx ON epistemic_candidates(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS epistemic_candidates_status_idx ON epistemic_candidates(status)`);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS candidate_edges (
      id                TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL,
      from_candidate_id TEXT NOT NULL,
      to_candidate_id   TEXT NOT NULL,
      edge_type         TEXT NOT NULL,
      weight            REAL NOT NULL DEFAULT 1,
      created_at        TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS axiom_statements (
      id                   TEXT PRIMARY KEY,
      user_id              TEXT NOT NULL,
      statement            TEXT NOT NULL,
      status               TEXT NOT NULL DEFAULT 'provisional',
      seeded               INTEGER NOT NULL DEFAULT 0,
      kind                 TEXT NOT NULL,
      confidence           REAL NOT NULL DEFAULT 0,
      source_candidate_ids TEXT NOT NULL DEFAULT '[]',
      provenance_summary   TEXT NOT NULL DEFAULT '',
      supersedes_axiom_id  TEXT,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL
    )
  `);

  sqlite.exec(`CREATE INDEX IF NOT EXISTS axiom_statements_user_idx ON axiom_statements(user_id)`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS axiom_statements_status_idx ON axiom_statements(status)`);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS axiom_provenance (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL,
      axiom_statement_id TEXT NOT NULL,
      event_id           TEXT,
      candidate_id       TEXT,
      experiment_id      TEXT,
      evidence_type      TEXT NOT NULL,
      note               TEXT NOT NULL DEFAULT '',
      weight             REAL NOT NULL DEFAULT 1,
      created_at         TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS watch_rules (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      target_app  TEXT NOT NULL,
      rule_type   TEXT NOT NULL,
      label       TEXT NOT NULL,
      description TEXT NOT NULL,
      rule_json   TEXT NOT NULL DEFAULT '{}',
      active      INTEGER NOT NULL DEFAULT 1,
      seeded      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prompt_queue (
      id                   TEXT PRIMARY KEY,
      user_id              TEXT NOT NULL,
      destination_app      TEXT NOT NULL,
      prompt_type          TEXT NOT NULL,
      title                TEXT NOT NULL,
      body                 TEXT NOT NULL,
      related_candidate_id TEXT,
      related_axiom_id     TEXT,
      priority             INTEGER NOT NULL DEFAULT 50,
      status               TEXT NOT NULL DEFAULT 'open',
      seeded               INTEGER NOT NULL DEFAULT 0,
      created_at           TEXT NOT NULL
    )
  `);
}

runEpistemicMigrations();

console.log(`[db] Connected: ${dbPath}`);
