import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
const now = () => new Date().toISOString();

export const epistemicEvents = sqliteTable("epistemic_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceApp: text("source_app", { enum: ["liminal","parallax","praxis","axiom"] }).notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  eventType: text("event_type", { enum: ["belief_candidate","tension_candidate","pattern_candidate","hypothesis_candidate","experiment_candidate","experiment_result","doctrine_candidate","axiom_statement","identity_discrepancy","revision_candidate"] }).notNull(),
  epistemicStatus: text("epistemic_status", { enum: ["candidate","patterned","testing","provisional_truth","seeded","archived","rejected"] }).notNull().default("candidate"),
  seeded: integer("seeded", { mode: "boolean" }).notNull().default(false),
  ingestionMode: text("ingestion_mode", { enum: ["live","backfill","manual_seed"] }).notNull().default("live"),
  confidence: real("confidence").notNull().default(0),
  salience: real("salience").notNull().default(0),
  domain: text("domain"),
  tags: text("tags").notNull().default("[]"),
  evidence: text("evidence").notNull().default("[]"),
  payload: text("payload").notNull().default("{}"),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
}, (t) => ({
  userIdx: index("epistemic_events_user_idx").on(t.userId),
  typeIdx: index("epistemic_events_type_idx").on(t.eventType),
  sourceIdx: index("epistemic_events_source_idx").on(t.sourceApp, t.sourceRecordId),
  dedupeIdx: index("epistemic_events_dedupe_idx").on(t.sourceApp, t.sourceRecordId, t.eventType),
}));

export const epistemicCandidates = sqliteTable("epistemic_candidates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  candidateType: text("candidate_type", { enum: ["belief_candidate","tension_candidate","pattern_candidate","hypothesis_candidate","doctrine_candidate","revision_candidate","identity_discrepancy"] }).notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  status: text("status", { enum: ["open","queued_for_axiom","queued_for_praxis","accepted","rejected","testing","resolved"] }).notNull().default("open"),
  targetApp: text("target_app", { enum: ["axiom","praxis","liminal","parallax"] }),
  confidence: real("confidence").notNull().default(0),
  recurrenceScore: real("recurrence_score").notNull().default(0),
  contradictionScore: real("contradiction_score").notNull().default(0),
  actionabilityScore: real("actionability_score").notNull().default(0),
  seeded: integer("seeded", { mode: "boolean" }).notNull().default(false),
  originMode: text("origin_mode", { enum: ["live","historical_derivation","manual_seed"] }).notNull().default("live"),
  seedLabel: text("seed_label"),
  sourceEventIds: text("source_event_ids").notNull().default("[]"),
  supportingEvidence: text("supporting_evidence").notNull().default("[]"),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
}, (t) => ({
  candidateUserIdx: index("epistemic_candidates_user_idx").on(t.userId),
  candidateStatusIdx: index("epistemic_candidates_status_idx").on(t.status),
}));

export const candidateEdges = sqliteTable("candidate_edges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  fromCandidateId: text("from_candidate_id").notNull(),
  toCandidateId: text("to_candidate_id").notNull(),
  edgeType: text("edge_type", { enum: ["supports","contradicts","suggests","tests","revises","derived_from","observed_in"] }).notNull(),
  weight: real("weight").notNull().default(1),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const axiomStatements = sqliteTable("axiom_statements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  statement: text("statement").notNull(),
  status: text("status", { enum: ["provisional","stable","under_revision","seeded","retired"] }).notNull().default("provisional"),
  seeded: integer("seeded", { mode: "boolean" }).notNull().default(false),
  kind: text("kind", { enum: ["truth_claim","tension","revision","working_doctrine"] }).notNull(),
  confidence: real("confidence").notNull().default(0),
  sourceCandidateIds: text("source_candidate_ids").notNull().default("[]"),
  provenanceSummary: text("provenance_summary").notNull().default(""),
  supersedesAxiomId: text("supersedes_axiom_id"),
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now),
}, (t) => ({
  axiomUserIdx: index("axiom_statements_user_idx").on(t.userId),
  axiomStatusIdx: index("axiom_statements_status_idx").on(t.status),
}));

export const axiomProvenance = sqliteTable("axiom_provenance", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  axiomStatementId: text("axiom_statement_id").notNull(),
  eventId: text("event_id"),
  candidateId: text("candidate_id"),
  experimentId: text("experiment_id"),
  evidenceType: text("evidence_type", { enum: ["entry","pattern","experiment","manual_seed","manual_revision"] }).notNull(),
  note: text("note").notNull().default(""),
  weight: real("weight").notNull().default(1),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const watchRules = sqliteTable("watch_rules", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdBy: text("created_by", { enum: ["axiom","praxis","system"] }).notNull(),
  targetApp: text("target_app", { enum: ["parallax","liminal"] }).notNull(),
  ruleType: text("rule_type", { enum: ["pattern_watch","contradiction_watch","prompt_watch","revision_watch"] }).notNull(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  ruleJson: text("rule_json").notNull().default("{}"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  seeded: integer("seeded", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const promptQueue = sqliteTable("prompt_queue", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  destinationApp: text("destination_app", { enum: ["liminal","praxis"] }).notNull(),
  promptType: text("prompt_type", { enum: [
    "followup_question",
    "experiment_prompt",
    "revision_prompt",
    "discrepancy_prompt",
    "deliberation_prompt",
    "reckoning_prompt",
    "origin_prompt",
    "examination_prompt",
    "interpretation_prompt",
    "accountability_prompt",
  ] }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  relatedCandidateId: text("related_candidate_id"),
  relatedAxiomId: text("related_axiom_id"),
  priority: integer("priority").notNull().default(50),
  status: text("status", { enum: ["open","shown","accepted","dismissed"] }).notNull().default("open"),
  seeded: integer("seeded", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

// Convenience type alias used across services
export type EpistemicCandidate = typeof epistemicCandidates.$inferSelect;
