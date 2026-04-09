import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import {
  db,
  axiomStatements,
  axiomProvenance,
  watchRules,
  promptQueue,
} from '../db';
import { createWatchRules, createLiminalRevisionPrompts } from '../services/epistemicPromotion';

function uid(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

interface AxiomEntry {
  statement: string;
  kind: 'truth_claim' | 'tension' | 'revision' | 'working_doctrine';
  confidence?: number;
}

export async function seedExistingAxiomEntries(userId: string): Promise<{ seeded: number; skipped: number }> {
  const axiomToolUrl = process.env.AXIOMTOOL_INTERNAL_URL;
  let entries: AxiomEntry[] = [];

  if (axiomToolUrl) {
    try {
      const resp = await fetch(`${axiomToolUrl}/api/truths`, {
        headers: {
          'x-lumen-internal-token': process.env.LUMEN_INTERNAL_TOKEN || process.env.JWT_SECRET || '',
        },
      });
      if (resp.ok) {
        const data = await resp.json() as { entries?: AxiomEntry[] };
        entries = data.entries ?? [];
      }
    } catch (err) {
      console.error('[seed/axiom] Failed to fetch from Axiom tool:', err);
      return { seeded: 0, skipped: 0 };
    }
  }

  return await seedFromEntries(userId, entries);
}

export async function seedFromEntries(userId: string, entries: AxiomEntry[]): Promise<{ seeded: number; skipped: number }> {
  let seeded = 0;
  let skipped = 0;

  for (const entry of entries) {
    // Idempotent check
    const existing = db
      .select()
      .from(axiomStatements)
      .where(
        and(
          eq(axiomStatements.userId, userId),
          eq(axiomStatements.statement, entry.statement)
        )
      )
      .get();

    if (existing) {
      skipped++;
      continue;
    }

    const axiom = db
      .insert(axiomStatements)
      .values({
        id: uid(),
        userId,
        statement: entry.statement,
        status: 'seeded',
        seeded: true,
        kind: entry.kind,
        confidence: entry.confidence ?? 0.8,
        provenanceSummary: 'Seeded from existing Axiom tool entries',
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();

    // Create provenance
    db.insert(axiomProvenance)
      .values({
        id: uid(),
        userId,
        axiomStatementId: axiom.id,
        evidenceType: 'manual_seed',
        note: 'Initial seed from Axiom tool during migration',
        createdAt: now(),
      })
      .run();

    // Create watch rules (seeded=true propagated through createWatchRules)
    createWatchRules(axiom);

    // Create Liminal prompts for tensions (seeded=true propagated)
    if (entry.kind === 'tension') {
      db.insert(promptQueue)
        .values({
          id: uid(),
          userId,
          destinationApp: 'liminal',
          promptType: 'discrepancy_prompt',
          title: `Reflect on tension: ${entry.statement.slice(0, 50)}`,
          body: `A tension worth exploring: "${entry.statement}". Something in your reflections echoes this.`,
          relatedAxiomId: axiom.id,
          priority: 30,
          status: 'open',
          seeded: true,
          createdAt: now(),
        })
        .run();
    }

    // Create revision prompts for all seeded axioms
    createLiminalRevisionPrompts(axiom);

    seeded++;
  }

  return { seeded, skipped };
}
