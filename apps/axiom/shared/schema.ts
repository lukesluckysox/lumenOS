import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Axioms (Truth Claims) ──────────────────────────────────────────────────
export const axioms = sqliteTable("axioms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().default("1"),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  // Source input counts
  liminalCount: integer("liminal_count").notNull().default(0),
  parallaxCount: integer("parallax_count").notNull().default(0),
  praxisCount: integer("praxis_count").notNull().default(0),
  source: text("source").notNull().default("manual"), // "manual" | "lumen_push" | "seeded"
  stage: text("stage").notNull().default("proving_ground"), // "proving_ground" | "constitutional"
  inputDescriptions: text("input_descriptions").notNull().default("[]"), // JSON: string[]
  // Synthesis chain
  signal: text("signal").notNull().default(""),
  convergence: text("convergence").notNull().default(""),
  interpretation: text("interpretation").notNull().default(""),
  // Output
  truthClaim: text("truth_claim").notNull(),
  workingPrinciple: text("working_principle").notNull().default(""),
  // Assessment
  confidence: text("confidence").notNull().default("medium"), // low | medium-low | medium | medium-high | high
  confidenceScore: integer("confidence_score").notNull().default(50),
  counterevidence: text("counterevidence").notNull().default(""),
  revisionNote: text("revision_note").notNull().default(""),
  revisionHistory: text("revision_history").notNull().default("[]"), // JSON: { date, change, previousConfidence }[]
  // Grounding / calibration
  groundingVerdict: text("grounding_verdict").notNull().default(""),
  falsificationConditions: text("falsification_conditions").notNull().default(""),
  lastGroundingAt: text("last_grounding_at").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertAxiomSchema = createInsertSchema(axioms).omit({
  id: true, userId: true, number: true, createdAt: true, updatedAt: true, stage: true,
});

export type InsertAxiom = z.infer<typeof insertAxiomSchema>;
export type Axiom = typeof axioms.$inferSelect;

// ─── Tensions (Core Tensions / Polarities) ──────────────────────────────────
export const tensions = sqliteTable("tensions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().default("1"),
  poleA: text("pole_a").notNull(),
  poleB: text("pole_b").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").notNull().default("[]"), // JSON: string[]
  relatedAxiomIds: text("related_axiom_ids").notNull().default("[]"), // JSON: number[]
  createdAt: text("created_at").notNull(),
});

export const insertTensionSchema = createInsertSchema(tensions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertTension = z.infer<typeof insertTensionSchema>;
export type Tension = typeof tensions.$inferSelect;

// ─── Revisions (Worldview Revisions) ────────────────────────────────────────
export const revisions = sqliteTable("revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().default("1"),
  date: text("date").notNull(),
  previousBelief: text("previous_belief").notNull(),
  newBelief: text("new_belief").notNull(),
  triggeringEvidence: text("triggering_evidence").notNull().default(""),
  significance: text("significance").notNull().default("moderate"), // minor | moderate | major
  relatedAxiomId: integer("related_axiom_id"),
  createdAt: text("created_at").notNull(),
});

export const insertRevisionSchema = createInsertSchema(revisions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertRevision = z.infer<typeof insertRevisionSchema>;
export type Revision = typeof revisions.$inferSelect;

// ─── Constitutions (Preamble + meta per user) ────────────────────────────────
export const constitutions = sqliteTable("constitutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique(),
  preamble: text("preamble").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export type Constitution = typeof constitutions.$inferSelect;

// ─── Grounding Signals (Calibration axes per axiom) ─────────────────────────
export const groundingSignals = sqliteTable("grounding_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  axiomId: integer("axiom_id").notNull(),
  userId: text("user_id").notNull().default("1"),
  axis: text("axis").notNull(),
  value: text("value").notNull(),
  detail: text("detail").notNull().default(""),
  sourceApp: text("source_app").notNull().default(""),
  sourceRecordId: text("source_record_id").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export type GroundingSignal = typeof groundingSignals.$inferSelect;
