import { db } from "./db";
import { axioms, tensions, revisions, constitutions, type Axiom, type Tension, type Revision, type Constitution, type InsertAxiom, type InsertTension, type InsertRevision } from "@shared/schema";
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
    return db.insert(tensions).values({ ...data, userId, createdAt: now() }).returning().get();
  }

  updateTension(id: number, data: Partial<InsertTension>, userId: string): Tension | undefined {
    return db.update(tensions).set(data).where(and(eq(tensions.id, id), eq(tensions.userId, userId))).returning().get();
  }

  deleteTension(id: number, userId: string): boolean {
    const result = db.delete(tensions).where(and(eq(tensions.id, id), eq(tensions.userId, userId))).run();
    return result.changes > 0;
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
