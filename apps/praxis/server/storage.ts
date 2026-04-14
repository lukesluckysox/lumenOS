import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and } from "drizzle-orm";
import path from "path";
import fs from "fs";
import {
  experiments,
  doctrines,
  tensions,
  type Experiment,
  type InsertExperiment,
  type Doctrine,
  type InsertDoctrine,
  type Tension,
  type InsertTension,
} from "@shared/schema";

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/praxis.db`
  : path.resolve(process.cwd(), "praxis.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const volumeSet = !!process.env.RAILWAY_VOLUME_MOUNT_PATH;
console.log(`[praxis/db] SQLite path: ${dbPath}`);
console.log(`[praxis/db] RAILWAY_VOLUME_MOUNT_PATH: ${process.env.RAILWAY_VOLUME_MOUNT_PATH ?? '(NOT SET)'}`);
console.log(`[praxis/db] Persistent volume: ${volumeSet ? 'YES' : 'NO — data will be lost on redeploy'}`);
if (!volumeSet) {
  console.warn('[praxis/db] ⚠️  Set RAILWAY_VOLUME_MOUNT_PATH in Railway Variables to persist data across deploys.');
}
const dbExists = fs.existsSync(dbPath);
console.log(`[praxis/db] DB file exists: ${dbExists}${dbExists ? ` (${(fs.statSync(dbPath).size / 1024).toFixed(1)} KB)` : ' — will create fresh'}`);

const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

// Run migrations
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trial_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    source TEXT NOT NULL DEFAULT 'manual',
    hypothesis TEXT NOT NULL,
    design TEXT NOT NULL,
    experiment_constraint TEXT NOT NULL DEFAULT '',
    observation TEXT NOT NULL DEFAULT '',
    meaning_extraction TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS doctrines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    statement TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'emerging',
    source_experiment_ids TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pole_a TEXT NOT NULL,
    pole_b TEXT NOT NULL,
    insight TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    is_primary INTEGER NOT NULL DEFAULT 0,
    strength INTEGER NOT NULL DEFAULT 5,
    created_at INTEGER NOT NULL
  );
`);

// Add user_id columns to existing tables (no-op if already added)
try { sqlite.exec("ALTER TABLE experiments ADD COLUMN user_id TEXT NOT NULL DEFAULT '1'"); } catch {}
try { sqlite.exec("ALTER TABLE doctrines ADD COLUMN user_id TEXT NOT NULL DEFAULT '1'"); } catch {}
try { sqlite.exec("ALTER TABLE tensions ADD COLUMN user_id TEXT NOT NULL DEFAULT '1'"); } catch {}

// Add source_description column (no-op if already added)
try { sqlite.exec("ALTER TABLE experiments ADD COLUMN source_description TEXT"); } catch {}

// Add proposed_to_axiom column for doctrine graduation tracking
try { sqlite.exec("ALTER TABLE doctrines ADD COLUMN proposed_to_axiom INTEGER NOT NULL DEFAULT 0"); } catch {}

// User table for SSO
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS praxis_users (
    id TEXT PRIMARY KEY,
    email TEXT,
    username TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// Additive migration: plan column (no-op if already exists)
try { sqlite.exec("ALTER TABLE praxis_users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'"); } catch {}

export interface IStorage {
  // Experiments
  getExperiments(userId: string): Experiment[];
  getExperiment(id: number, userId: string): Experiment | undefined;
  createExperiment(data: InsertExperiment, userId: string): Experiment;
  updateExperiment(id: number, data: Partial<InsertExperiment> & { completedAt?: number | null }, userId: string): Experiment | undefined;
  deleteExperiment(id: number, userId: string): void;
  getNextTrialNumber(userId: string): number;

  // Doctrines
  getDoctrines(userId: string): Doctrine[];
  getDoctrine(id: number, userId: string): Doctrine | undefined;
  createDoctrine(data: InsertDoctrine, userId: string): Doctrine;
  updateDoctrine(id: number, data: Partial<InsertDoctrine>, userId: string): Doctrine | undefined;
  deleteDoctrine(id: number, userId: string): void;

  // Tensions
  getTensions(userId: string): Tension[];
  getTension(id: number, userId: string): Tension | undefined;
  createTension(data: InsertTension, userId: string): Tension;
  updateTension(id: number, data: Partial<InsertTension>, userId: string): Tension | undefined;
  deleteTension(id: number, userId: string): void;
}

class Storage implements IStorage {
  // ── Experiments ──────────────────────────────────────────────────────────

  getExperiments(userId: string): Experiment[] {
    return db.select().from(experiments).where(eq(experiments.userId, userId)).orderBy(desc(experiments.createdAt)).all();
  }

  getExperiment(id: number, userId: string): Experiment | undefined {
    return db.select().from(experiments).where(and(eq(experiments.id, id), eq(experiments.userId, userId))).get();
  }

  createExperiment(data: InsertExperiment, userId: string): Experiment {
    return db.insert(experiments).values({
      ...data,
      userId,
      createdAt: Date.now(),
    }).returning().get();
  }

  updateExperiment(id: number, data: Partial<InsertExperiment> & { completedAt?: number | null }, userId: string): Experiment | undefined {
    return db.update(experiments).set(data).where(and(eq(experiments.id, id), eq(experiments.userId, userId))).returning().get();
  }

  deleteExperiment(id: number, userId: string): void {
    db.delete(experiments).where(and(eq(experiments.id, id), eq(experiments.userId, userId))).run();
  }

  getNextTrialNumber(userId: string): number {
    const rows = db.select({ trialNumber: experiments.trialNumber }).from(experiments).where(eq(experiments.userId, userId)).all();
    if (rows.length === 0) return 1;
    return Math.max(...rows.map(r => r.trialNumber)) + 1;
  }

  // ── Doctrines ────────────────────────────────────────────────────────────

  getDoctrines(userId: string): Doctrine[] {
    return db.select().from(doctrines).where(eq(doctrines.userId, userId)).orderBy(desc(doctrines.createdAt)).all();
  }

  getDoctrine(id: number, userId: string): Doctrine | undefined {
    return db.select().from(doctrines).where(and(eq(doctrines.id, id), eq(doctrines.userId, userId))).get();
  }

  createDoctrine(data: InsertDoctrine, userId: string): Doctrine {
    return db.insert(doctrines).values({
      ...data,
      userId,
      createdAt: Date.now(),
    }).returning().get();
  }

  updateDoctrine(id: number, data: Partial<InsertDoctrine>, userId: string): Doctrine | undefined {
    return db.update(doctrines).set(data).where(and(eq(doctrines.id, id), eq(doctrines.userId, userId))).returning().get();
  }

  deleteDoctrine(id: number, userId: string): void {
    db.delete(doctrines).where(and(eq(doctrines.id, id), eq(doctrines.userId, userId))).run();
  }

  // ── Tensions ─────────────────────────────────────────────────────────────

  getTensions(userId: string): Tension[] {
    return db.select().from(tensions).where(eq(tensions.userId, userId)).orderBy(desc(tensions.isPrimary), desc(tensions.strength)).all();
  }

  getTension(id: number, userId: string): Tension | undefined {
    return db.select().from(tensions).where(and(eq(tensions.id, id), eq(tensions.userId, userId))).get();
  }

  createTension(data: InsertTension, userId: string): Tension {
    return db.insert(tensions).values({
      ...data,
      userId,
      createdAt: Date.now(),
    }).returning().get();
  }

  updateTension(id: number, data: Partial<InsertTension>, userId: string): Tension | undefined {
    return db.update(tensions).set(data).where(and(eq(tensions.id, id), eq(tensions.userId, userId))).returning().get();
  }

  deleteTension(id: number, userId: string): void {
    db.delete(tensions).where(and(eq(tensions.id, id), eq(tensions.userId, userId))).run();
  }

  // ── Users (for Oracle) ──────────────────────────────────────────────────

  getAllUsers(): { id: string; username: string | null; email: string | null; plan: string; createdAt: number }[] {
    return sqlite.prepare(
      `SELECT id, username, email, plan, created_at as createdAt FROM praxis_users ORDER BY created_at ASC`
    ).all() as any[];
  }

  deleteUserById(userId: string): void {
    // Delete all user content first
    sqlite.prepare(`DELETE FROM experiments WHERE user_id = ?`).run(userId);
    sqlite.prepare(`DELETE FROM doctrines WHERE user_id = ?`).run(userId);
    sqlite.prepare(`DELETE FROM tensions WHERE user_id = ?`).run(userId);
    // Delete the user record
    sqlite.prepare(`DELETE FROM praxis_users WHERE id = ?`).run(userId);
  }

  deleteUserByIdentifier(username?: string, email?: string): boolean {
    let user: any = null;
    if (email) {
      user = sqlite.prepare(`SELECT id FROM praxis_users WHERE email = ?`).get(email.toLowerCase().trim());
    }
    if (!user && username) {
      user = sqlite.prepare(`SELECT id FROM praxis_users WHERE username = ?`).get(username);
    }
    if (!user) return false;
    this.deleteUserById(user.id);
    return true;
  }

  syncPlan(username?: string, email?: string, plan?: string): boolean {
    if (!plan) return false;
    let user: any = null;
    if (email) {
      user = sqlite.prepare(`SELECT id FROM praxis_users WHERE email = ?`).get(email.toLowerCase().trim());
    }
    if (!user && username) {
      user = sqlite.prepare(`SELECT id FROM praxis_users WHERE username = ?`).get(username);
    }
    if (!user) return false;
    sqlite.prepare(`UPDATE praxis_users SET plan = ? WHERE id = ?`).run(plan, user.id);
    return true;
  }
}

export const storage = new Storage();

// Expose raw sqlite for internal routes that need ad-hoc queries
export { sqlite };
