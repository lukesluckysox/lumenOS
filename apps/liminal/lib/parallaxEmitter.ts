// lib/parallaxEmitter.ts
// Pushes completed Liminal sessions to Parallax for pattern tracking

const PARALLAX_URL = process.env.PARALLAX_URL;
const LUMEN_INTERNAL_TOKEN = process.env.LUMEN_INTERNAL_TOKEN;

export async function emitToParallax(event: {
  lumenUserId: string;
  sessionId: string;
  toolSlug: string;
  inputText: string;
  structuredOutput: object;
  summary: string;
  createdAt?: string;
}): Promise<void> {
  if (!PARALLAX_URL || !LUMEN_INTERNAL_TOKEN) return;
  try {
    await fetch(`${PARALLAX_URL}/api/internal/from-liminal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lumen-internal-token": LUMEN_INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        lumenUserId: event.lumenUserId,
        sessionId: event.sessionId,
        toolSlug: event.toolSlug,
        inputText: event.inputText,
        structuredOutput: event.structuredOutput,
        summary: event.summary,
        createdAt: event.createdAt || new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[ParallaxEmitter] Failed to push session:", e);
    // Never throw — emission must not break the main app flow
  }
}

// Also push to Axiom when we detect strong belief/truth signals
const AXIOM_URL = process.env.AXIOM_TOOL_URL;

export async function emitToAxiom(event: {
  lumenUserId: string;
  sessionId: string;
  toolSlug: string;
  inputText: string;
  structuredOutput: object;
  summary: string;
}): Promise<void> {
  if (!AXIOM_URL || !LUMEN_INTERNAL_TOKEN) return;

  // Only tools that produce truth-adjacent outputs should push to Axiom
  const axiomTools = ["genealogist", "interlocutor", "stoics-ledger"];
  if (!axiomTools.includes(event.toolSlug)) return;

  try {
    // Extract a potential truth claim from the structured output
    const output = event.structuredOutput as any;
    let signal = "";
    let interpretation = "";
    let suggestedClaim = "";

    if (event.toolSlug === "genealogist") {
      signal = output.belief_statement || "";
      interpretation = output.hidden_function || "";
      suggestedClaim = output.inherited_vs_chosen || "";
    } else if (event.toolSlug === "interlocutor") {
      signal = output.clarified_thesis || "";
      interpretation = (output.strong_objections || []).join("; ");
      suggestedClaim = output.clarified_thesis || "";
    } else if (event.toolSlug === "stoics-ledger") {
      signal = output.conduct_review || "";
      interpretation = output.maxim || "";
      suggestedClaim = output.maxim || "";
    }

    if (!suggestedClaim) return;

    await fetch(`${AXIOM_URL}/api/internal/from-lumen`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lumen-internal-token": LUMEN_INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        lumenUserId: event.lumenUserId,
        source: "liminal",
        axioms: [{
          title: suggestedClaim.slice(0, 100),
          signal,
          interpretation,
          truthClaim: suggestedClaim,
          sourceCounts: { liminal: 1, parallax: 0, praxis: 0 },
        }],
      }),
    });
  } catch (e) {
    console.error("[AxiomEmitter] Failed to push from Liminal:", e);
  }
}
