import { db } from "./db";
import { sqlite } from "./db";
import { axioms, tensions, revisions, constitutions, tensionSignals, type Axiom, type Tension, type Revision, type Constitution, type InsertAxiom, type InsertTension, type InsertRevision, type TensionSignal } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // Axioms
  getAxioms(userId: string): Axiom[];
  getAxiom(id: number, userId: string): Axiom | undefined;
  createAxiom(data: InsertAxiom, userId: string): Axiom;
  updateAxiom(id: number, data: Partial<InsertAxiom>, userId: string): Axiom | undefined;
  deleteAxiom(id: number, userId: string): boolean;
  setAxiomStage(id: number, stage: string, userId: string): void;
  // Tensions
  getTensions(userId: string): Tension[];
  getTension(id: number, userId: string): Tension | undefined;
  createTension(data: InsertTension, userId: string): Tension;
  updateTension(id: number, data: Partial<InsertTension>, userId: string): Tension | undefined;
  deleteTension(id: number, userId: string): boolean;
  // Tension signals
  addTensionSignal(tensionId: number, userId: string, data: { sourceApp: string; sourceRecordId?: string; signalType: string; poleAffected?: string; content: string; confidence?: number }): TensionSignal;
  getTensionSignals(tensionId: number, userId: string): TensionSignal[];
  // Revisions
  getRevisions(userId: string): Revision[];
  getRevision(id: number, userId: string): Revision | undefined;
  createRevision(data: InsertRevision, userId: string): Revision;
  deleteRevision(id: number, userId: string): boolean;
  // Constitutions
  getConstitutionMeta(userId: string): Constitution | undefined;
  upsertConstitutionMeta(userId: string, preamble: string): Constitution;
}

function now(): string {
  return new Date().toISOString();
}

function nextAxiomNumber(userId: string): number {
  const result = db.select({ max: sql<number>`max(${axioms.number})` }).from(axioms).where(eq(axioms.userId, userId)).get();
  return ((result?.max) ?? 0) + 1;
}

export class Storage implements IStorage {
  constructor() {
    // seed() removed — existing data preserved via DB migration with user_id='1'
  }

  // ─── Axioms ──────────────────────────────────────────────────────────────
  getAxioms(userId: string): Axiom[] {
    return db.select().from(axioms).where(eq(axioms.userId, userId)).orderBy(desc(axioms.confidenceScore)).all();
  }

  getAxiom(id: number, userId: string): Axiom | undefined {
    return db.select().from(axioms).where(and(eq(axioms.id, id), eq(axioms.userId, userId))).get();
  }

  createAxiom(data: InsertAxiom, userId: string): Axiom {
    const ts = now();
    const number = nextAxiomNumber(userId);
    return db.insert(axioms).values({
      ...data,
      userId,
      number,
      createdAt: ts,
      updatedAt: ts,
    }).returning().get();
  }

  updateAxiom(id: number, data: Partial<InsertAxiom>, userId: string): Axiom | undefined {
    return db.update(axioms)
      .set({ ...data, updatedAt: now() })
      .where(and(eq(axioms.id, id), eq(axioms.userId, userId)))
      .returning().get();
  }

  deleteAxiom(id: number, userId: string): boolean {
    const result = db.delete(axioms).where(and(eq(axioms.id, id), eq(axioms.userId, userId))).run();
    return result.changes > 0;
  }

  setAxiomStage(id: number, stage: string, userId: string): void {
    db.update(axioms).set({ stage, updatedAt: now() } as any).where(and(eq(axioms.id, id), eq(axioms.userId, userId))).run();
  }

  // ─── Tensions ────────────────────────────────────────────────────────────
  getTensions(userId: string): Tension[] {
    return db.select().from(tensions).where(eq(tensions.userId, userId)).orderBy(desc(tensions.createdAt)).all();
  }

  getTension(id: number, userId: string): Tension | undefined {
    return db.select().from(tensions).where(and(eq(tensions.id, id), eq(tensions.userId, userId))).get();
  }

  createTension(data: InsertTension, userId: string): Tension {
    const ts = now();
    return db.insert(tensions).values({ ...data, userId, firstSurfacedAt: ts, createdAt: ts } as any).returning().get();
  }

  updateTension(id: number, data: Partial<InsertTension>, userId: string): Tension | undefined {
    return db.update(tensions).set(data).where(and(eq(tensions.id, id), eq(tensions.userId, userId))).returning().get();
  }

  deleteTension(id: number, userId: string): boolean {
    const result = db.delete(tensions).where(and(eq(tensions.id, id), eq(tensions.userId, userId))).run();
    return result.changes > 0;
  }

  addTensionSignal(tensionId: number, userId: string, data: { sourceApp: string; sourceRecordId?: string; signalType: string; poleAffected?: string; content: string; confidence?: number }): TensionSignal {
    const ts = now();
    const signal = db.insert(tensionSignals).values({
      tensionId,
      userId,
      sourceApp: data.sourceApp,
      sourceRecordId: data.sourceRecordId || "",
      signalType: data.signalType,
      poleAffected: data.poleAffected || "",
      content: data.content,
      confidence: Math.round((data.confidence ?? 0.5) * 1000),
      createdAt: ts,
    }).returning().get();

    // Update tension: increment count, update last_signal_at, add source app, transition status
    const tension = this.getTension(tensionId, userId);
    if (tension) {
      const newCount = (tension.signalCount || 0) + 1;
      const apps: string[] = (() => { try { return JSON.parse(tension.sourceApps || '[]'); } catch { return []; } })();
      if (!apps.includes(data.sourceApp)) apps.push(data.sourceApp);

      // Compute salience
      const firstSurfaced = tension.firstSurfacedAt || tension.createdAt;
      const durationDays = Math.max(1, (Date.now() - new Date(firstSurfaced).getTime()) / (1000 * 60 * 60 * 24));
      const recurrence = Math.min(1, newCount / 10);
      const recency = Math.min(1, 1 / (1 + (Date.now() - Date.now()) / (1000 * 60 * 60 * 24 * 7))); // just signaled now = 1
      const crossApp = Math.min(1, apps.length / 4);
      const duration = Math.min(1, durationDays / 30);
      const salience = recurrence * 0.3 + 1.0 * 0.3 + crossApp * 0.2 + duration * 0.2; // recency=1 since just signaled

      let newStatus = tension.status || 'surfaced';
      if (newStatus === 'surfaced') newStatus = 'accumulating';
      if (salience >= 0.7 && newCount >= 3 && apps.length >= 2) newStatus = 'threshold';

      sqlite.prepare(
        `UPDATE tensions SET signal_count = ?, last_signal_at = ?, source_apps = ?, salience = ?, status = ? WHERE id = ? AND user_id = ?`
      ).run(newCount, ts, JSON.stringify(apps), Math.round(salience * 1000), newStatus, tensionId, userId);
    }

    return signal;
  }

  getTensionSignals(tensionId: number, userId: string): TensionSignal[] {
    return db.select().from(tensionSignals)
      .where(and(eq(tensionSignals.tensionId, tensionId), eq(tensionSignals.userId, userId)))
      .orderBy(desc(tensionSignals.createdAt)).all();
  }

  // ─── Revisions ───────────────────────────────────────────────────────────
  getRevisions(userId: string): Revision[] {
    return db.select().from(revisions).where(eq(revisions.userId, userId)).orderBy(desc(revisions.date)).all();
  }

  getRevision(id: number, userId: string): Revision | undefined {
    return db.select().from(revisions).where(and(eq(revisions.id, id), eq(revisions.userId, userId))).get();
  }

  createRevision(data: InsertRevision, userId: string): Revision {
    return db.insert(revisions).values({ ...data, userId, createdAt: now() }).returning().get();
  }

  deleteRevision(id: number, userId: string): boolean {
    const result = db.delete(revisions).where(and(eq(revisions.id, id), eq(revisions.userId, userId))).run();
    return result.changes > 0;
  }

  // ─── Constitutions ─────────────────────────────────────────────────────
  getConstitutionMeta(userId: string): Constitution | undefined {
    return db.select().from(constitutions).where(eq(constitutions.userId, userId)).get();
  }

  upsertConstitutionMeta(userId: string, preamble: string): Constitution {
    const ts = now();
    const existing = this.getConstitutionMeta(userId);
    if (existing) {
      return db.update(constitutions)
        .set({ preamble, updatedAt: ts })
        .where(eq(constitutions.userId, userId))
        .returning().get();
    }
    return db.insert(constitutions).values({ userId, preamble, updatedAt: ts }).returning().get();
  }
}

export const storage = new Storage();
