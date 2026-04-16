interface Props { open: boolean; onClose: () => void; }

const LOOP_STEPS = [
  { idx: "01", name: "Liminal", verb: "Questions belief", desc: "Surfaces hidden assumptions. Identifies what you believe that you have not chosen to believe." },
  { idx: "02", name: "Parallax", verb: "Reveals pattern", desc: "Reads across time. Finds recurring structures in thought, behavior, and emotional response." },
  { idx: "03", name: "Praxis", verb: "Tests hypothesis", desc: "Turns insight into experiment. Measures belief against lived experience before committing to it." },
  { idx: "04", name: "Axiom", verb: "Distills truth", desc: "Synthesizes what survived. Extracts durable principles, active tensions, and earned doctrines." },
];

const GLOSSARY = [
  { term: "Sensitivity", def: "Controls how readily the loop promotes recurring signals into candidates. Low = more exploratory, High = more conservative." },
  { term: "Candidate", def: "A piece of insight — a belief, pattern, tension, or hypothesis — that the loop has identified as worth examining further." },
  { term: "Promotion", def: "When a candidate meets the current sensitivity threshold, it advances to a destination app (Axiom, Praxis, or Liminal) for deeper processing." },
  { term: "Convergence", def: "When a belief from Liminal and a behavioral pattern from Parallax align on the same theme, they are paired and promoted together." },
  { term: "Doctrine", def: "A recurring belief or principle that has been observed across multiple reflections, strong enough to be proposed as a governing truth." },
  { term: "Tension", def: "A contradiction between two beliefs or between belief and behavior. Tensions are not errors — they are invitations to examine." },
  { term: "Alignment", def: "A measure of how closely your current state across all dimensions matches your stated targets. Shown in the sundial." },
  { term: "The Loop", def: "The recursive cycle connecting Liminal (questioning), Parallax (observing), Praxis (testing), and Axiom (governing). Each pass refines what came before." },
];

export default function AboutModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="gate" id="about-modal" style={{ zIndex: 9999, overflow: "auto" }}>
      <div style={{ width: "100%", maxWidth: "var(--w-wide)", margin: "0 auto", padding: "var(--sp-8) clamp(var(--sp-5), 5vw, var(--sp-16))" }}>
        <button onClick={onClose} className="nav__link" style={{ marginBottom: "var(--sp-8)", display: "block" }}>
          ← Back
        </button>

        {/* The Loop */}
        <section className="section loop-band">
          <div className="wrap">
            <div className="section__head" style={{ textAlign: "center" }}>
              <span className="section__eye">The Loop</span>
              <h2 className="section__title">Not a sequence.<br/>A cycle.</h2>
              <p className="section__desc" style={{ marginInline: "auto" }}>
                Each pass through the loop refines what came before. The light Lumen produces — the truths Axiom distills — becomes the next layer of darkness that Liminal interrogates. The cycle is the method.
              </p>
            </div>

            <div className="loop-row up">
              {LOOP_STEPS.map((s, i) => (
                <div key={s.idx} className={`loop-step ${i === 3 ? "loop-step--apex" : ""}`}>
                  <div className="loop-step__node">{s.idx}</div>
                  <h3 className="loop-step__name">{s.name}</h3>
                  <span className="loop-step__verb">{s.verb}</span>
                  <p className="loop-step__desc">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="loop-return up">
              <div className="loop-return__ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
              </div>
              <p className="loop-return__txt">
                The truths distilled by <span className="loop-return__em">Axiom</span> become the assumptions
                interrogated by <span className="loop-return__em">Liminal</span> in the next cycle.
                The loop does not close — it deepens.
              </p>
            </div>
          </div>
        </section>

        {/* Philosophy / Closing */}
        <section className="close-band">
          <div className="wrap wrap--mid">
            <div className="close-rule" />
            <blockquote className="close-quote up">
              "A personal constitution is not found.
              It is constructed — question by question,
              experiment by experiment, revision by revision."
            </blockquote>
            <div className="close-divider" />
            <p className="close-body up">
              Lumen is not a productivity system. It does not optimize your morning or aggregate your goals. It is a framework for building conviction from tested experience — for knowing, with some rigor, what you actually believe and why.
            </p>
            <p className="close-body up">
              The examined life requires infrastructure. This is that infrastructure.
            </p>
          </div>
        </section>

        {/* Glossary */}
        <div className="about-glossary">
          <h3>Glossary</h3>
          <dl>
            {GLOSSARY.map((g) => (
              <div key={g.term}>
                <dt>{g.term}</dt>
                <dd>{g.def}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
