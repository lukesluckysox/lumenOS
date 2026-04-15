/**
 * Renders structured output from any of the 6 Liminal tools.
 * Editorial idiom: ruled sections, no background boxes, typographic hierarchy.
 * Each tool has a distinct layout metaphor from the same philosophical quarterly.
 */

import type {
  CouncilOutput,
  CouncilTurn,
} from '@/lib/tools/small-council/orchestrator';
import type { GenealogyOutput } from '@/lib/tools/genealogist/orchestrator';
import type { InterlocutorOutput } from '@/lib/tools/interlocutor/orchestrator';
import type { StoicsLedgerOutput } from '@/lib/tools/stoics-ledger/orchestrator';
import type { FoolOutput } from '@/lib/tools/fool/orchestrator';
import type { InterpreterOutput } from '@/lib/tools/interpreter/orchestrator';

/* ─── Tool accent palette (old brass, aged olive, ink hues) ──── */

const TOOL_ACCENT: Record<string, string> = {
  'small-council': '156 134 84',   // old brass
  genealogist:     '110 120 98',   // aged olive
  interlocutor:    '96 116 140',   // ink blue-gray
  'stoics-ledger': '98 96 88',     // cool stone — very austere
  fool:            '136 78 70',    // weathered red
  interpreter:     '104 94 120',   // dusty plum
};

/* ─── Council advisor accent palette ────────────────────────── */

const ADVISOR_ACCENTS: Record<string, string> = {
  'The Instinct': '155 104 58',   // terra cotta
  'The Critic':    '86 106 136',  // ink blue
  'The Realist':   '94 110 98',   // bronze-green
  'The Shadow':    '92  78  98',  // dusty plum
  'The Sage':     '156 134 84',   // old brass
};

function accentFor(slug: string) {
  return TOOL_ACCENT[slug] ?? '156 134 84';
}

/* ─── Shared label style helper ─────────────────────────────── */

const labelCss = {
  fontSize: 'clamp(0.625rem, 0.58rem + 0.15vw, 0.6875rem)',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
};

/* ─── Section — ruled heading, no background fill ────────────── */

function Section({
  label,
  children,
  accent: accentHue,
}: {
  label: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="output-section">
      <div
        style={{
          paddingBottom: '0.5rem',
          borderBottom: `1px solid rgb(${accentHue} / 0.18)`,
          marginBottom: '1.125rem',
        }}
      >
        <span
          style={{
            ...labelCss,
            color: `rgb(${accentHue} / 0.75)`,
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ─── TextBlock — body prose ────────────────────────────────── */

function TextBlock({ text }: { text: string }) {
  return (
    <p
      style={{
        fontSize: 'clamp(0.875rem, 0.8rem + 0.3vw, 1rem)',
        color: 'rgb(var(--color-text-muted))',
        lineHeight: 1.75,
        whiteSpace: 'pre-wrap',
      }}
    >
      {text}
    </p>
  );
}

/* ─── BulletList ─────────────────────────────────────────────── */

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="output-list" role="list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/* ─── CalloutBlock — left rule only, no fill, italic serif ───── */

function CalloutBlock({
  text,
  accentHue,
}: {
  text: string;
  accentHue: string;
}) {
  return (
    <div
      style={{
        paddingLeft: '1.25rem',
        borderLeft: `1.5px solid rgb(${accentHue} / 0.35)`,
      }}
    >
      <p
        style={{
          fontSize: 'clamp(0.9375rem, 0.875rem + 0.3vw, 1.0625rem)',
          color: 'rgb(var(--color-text))',
          fontStyle: 'italic',
          lineHeight: 1.65,
          fontFamily: 'var(--font-display), Georgia, serif',
        }}
      >
        {text}
      </p>
    </div>
  );
}

/* ─── Small Council — debate folio ──────────────────────────── */

function SmallCouncilOutput({ output }: { output: CouncilOutput }) {
  const ac = accentFor('small-council');
  const round1 = output.turns.filter((t) => t.round === 1);
  const round2 = output.turns.filter((t) => t.round === 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <Section label="Round I — Initial Counsel" accent={ac}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {round1.map((turn, i) => (
            <AdvisorTurn
              key={turn.advisor + '1'}
              turn={turn}
              toolAccent={ac}
              isLast={i === round1.length - 1}
            />
          ))}
        </div>
      </Section>

      {output.clarification && (
        <div
          style={{
            paddingLeft: '1.25rem',
            borderLeft: `1.5px solid rgb(${ac} / 0.35)`,
          }}
        >
          <div
            style={{
              ...labelCss,
              color: `rgb(${ac} / 0.6)`,
              marginBottom: '0.5rem',
            }}
          >
            Clarification
          </div>
          <p
            style={{
              fontSize: 'clamp(0.875rem, 0.8rem + 0.25vw, 0.9375rem)',
              color: 'rgb(var(--color-text-muted))',
              fontStyle: 'italic',
              lineHeight: 1.65,
            }}
          >
            {output.clarification}
          </p>
        </div>
      )}

      <Section label="Round II — Response" accent={ac}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {round2.map((turn, i) => (
            <AdvisorTurn
              key={turn.advisor + '2'}
              turn={turn}
              toolAccent={ac}
              isLast={i === round2.length - 1}
            />
          ))}
        </div>
      </Section>

      <Section label="Synthesis" accent={ac}>
        <TextBlock text={output.synthesis} />
      </Section>
    </div>
  );
}

function AdvisorTurn({
  turn,
  toolAccent,
  isLast,
}: {
  turn: CouncilTurn;
  toolAccent: string;
  isLast: boolean;
}) {
  const advisorAccent = ADVISOR_ACCENTS[turn.advisor] ?? toolAccent;
  return (
    <div
      style={{
        paddingBottom: '1.25rem',
        marginBottom: isLast ? 0 : '1.25rem',
        borderBottom: isLast
          ? 'none'
          : `1px solid rgb(${toolAccent} / 0.1)`,
      }}
    >
      <div
        style={{
          ...labelCss,
          color: `rgb(${advisorAccent})`,
          marginBottom: '0.5rem',
        }}
      >
        {turn.advisor}
      </div>
      <p
        style={{
          fontSize: 'clamp(0.875rem, 0.8rem + 0.25vw, 0.9375rem)',
          color: 'rgb(var(--color-text-muted))',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}
      >
        {turn.content}
      </p>
    </div>
  );
}

/* ─── Genealogist — dossier of lineages ─────────────────────── */

function GenealogyOutputView({ output }: { output: GenealogyOutput }) {
  const ac = accentFor('genealogist');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <Section label="The Belief, Restated" accent={ac}>
        <CalloutBlock text={output.belief_statement} accentHue={ac} />
      </Section>

      {output.lineages.length > 0 && (
        <Section label="Lineages" accent={ac}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {output.lineages.map((l, i) => (
              <div
                key={i}
                style={{
                  paddingBottom: '0.875rem',
                  marginBottom:
                    i < output.lineages.length - 1 ? '0.875rem' : 0,
                  borderBottom:
                    i < output.lineages.length - 1
                      ? `1px solid rgb(${ac} / 0.1)`
                      : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 'clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem)',
                    fontWeight: 600,
                    color: `rgb(${ac})`,
                    marginBottom: '0.375rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  {l.source}
                </div>
                <p
                  style={{
                    fontSize: 'clamp(0.875rem, 0.8rem + 0.25vw, 0.9375rem)',
                    color: 'rgb(var(--color-text-muted))',
                    lineHeight: 1.65,
                  }}
                >
                  {l.description}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section label="Inherited vs. Chosen" accent={ac}>
        <TextBlock text={output.inherited_vs_chosen} />
      </Section>

      <Section label="Hidden Function" accent={ac}>
        <TextBlock text={output.hidden_function} />
      </Section>

      {output.tensions.length > 0 && (
        <Section label="Tensions" accent={ac}>
          <BulletList items={output.tensions} />
        </Section>
      )}

      <Section label="Belief Map" accent={ac}>
        <TextBlock text={output.belief_map} />
      </Section>

      {output.unresolved_questions.length > 0 && (
        <Section label="Unresolved Questions" accent={ac}>
          <BulletList items={output.unresolved_questions} />
        </Section>
      )}
    </div>
  );
}

/* ─── Interlocutor — numbered examination ───────────────────── */

function InterlocutorOutputView({ output }: { output: InterlocutorOutput }) {
  const ac = accentFor('interlocutor');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <Section label="Clarified Thesis" accent={ac}>
        <CalloutBlock text={output.clarified_thesis} accentHue={ac} />
      </Section>

      {output.exposed_assumptions.length > 0 && (
        <Section label="Exposed Assumptions" accent={ac}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {output.exposed_assumptions.map((a, i) => (
              <NumberedEntry
                key={i}
                index={i}
                total={output.exposed_assumptions.length}
                accentHue={ac}
                heading={a.assumption}
                body={a.examination}
              />
            ))}
          </div>
        </Section>
      )}

      {output.strong_objections.length > 0 && (
        <Section label="Strong Objections" accent={ac}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {output.strong_objections.map((o, i) => (
              <NumberedEntry
                key={i}
                index={i}
                total={output.strong_objections.length}
                accentHue={ac}
                heading={o.objection}
                body={o.weight}
              />
            ))}
          </div>
        </Section>
      )}

      {output.weak_spots.length > 0 && (
        <Section label="Weak Spots" accent={ac}>
          <BulletList items={output.weak_spots} />
        </Section>
      )}

      {output.better_formulations.length > 0 && (
        <Section label="Better Formulations" accent={ac}>
          <BulletList items={output.better_formulations} />
        </Section>
      )}

      {output.unanswered_questions.length > 0 && (
        <Section label="Unanswered Questions" accent={ac}>
          <BulletList items={output.unanswered_questions} />
        </Section>
      )}
    </div>
  );
}

function NumberedEntry({
  index,
  total,
  accentHue,
  heading,
  body,
}: {
  index: number;
  total: number;
  accentHue: string;
  heading: string;
  body: string;
}) {
  const isLast = index === total - 1;
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.875rem',
        paddingBottom: '1rem',
        marginBottom: isLast ? 0 : '1rem',
        borderBottom: isLast ? 'none' : `1px solid rgb(${accentHue} / 0.1)`,
      }}
    >
      <span
        style={{
          fontSize: 'clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem)',
          color: `rgb(${accentHue} / 0.65)`,
          fontWeight: 500,
          flexShrink: 0,
          paddingTop: '0.125em',
          minWidth: '1.25rem',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontStyle: 'italic',
        }}
      >
        {index + 1}.
      </span>
      <div>
        <p
          style={{
            fontWeight: 500,
            color: 'rgb(var(--color-text))',
            fontSize: 'clamp(0.875rem, 0.8rem + 0.25vw, 0.9375rem)',
            lineHeight: 1.5,
            marginBottom: '0.375rem',
          }}
        >
          {heading}
        </p>
        <p
          style={{
            fontSize: 'clamp(0.8rem, 0.75rem + 0.2vw, 0.875rem)',
            color: 'rgb(var(--color-text-muted))',
            lineHeight: 1.65,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

/* ─── Stoic's Ledger — columnar ledger ───────────────────────── */

function StoicsLedgerOutputView({ output }: { output: StoicsLedgerOutput }) {
  const ac = accentFor('stoics-ledger');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <Section label="Conduct Review" accent={ac}>
        <TextBlock text={output.conduct_review} />
      </Section>

      {/* 2-column ledger for duties */}
      {(output.duties_met.length > 0 || output.duties_neglected.length > 0) && (
        <div
          className="stoic-ledger-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
          }}
        >
          {output.duties_met.length > 0 && (
            <div>
              <div
                style={{
                  paddingBottom: '0.5rem',
                  borderBottom: `1px solid rgb(${ac} / 0.18)`,
                  marginBottom: '1rem',
                }}
              >
                <span
                  style={{
                    ...labelCss,
                    color: `rgb(${ac} / 0.75)`,
                  }}
                >
                  Duties Met
                </span>
              </div>
              <BulletList items={output.duties_met} />
            </div>
          )}

          {output.duties_neglected.length > 0 && (
            <div>
              <div
                style={{
                  paddingBottom: '0.5rem',
                  borderBottom: `1px solid rgb(${ac} / 0.18)`,
                  marginBottom: '1rem',
                }}
              >
                <span
                  style={{
                    ...labelCss,
                    color: `rgb(${ac} / 0.75)`,
                  }}
                >
                  Duties Neglected
                </span>
              </div>
              <BulletList items={output.duties_neglected} />
            </div>
          )}
        </div>
      )}

      {output.avoidances_named.length > 0 && (
        <Section label="Avoidances Named" accent={ac}>
          <BulletList items={output.avoidances_named} />
        </Section>
      )}

      {output.excuses_detected.length > 0 && (
        <Section label="Excuses Detected" accent={ac}>
          <BulletList items={output.excuses_detected} />
        </Section>
      )}

      <Section label="Maxim for Tomorrow" accent={ac}>
        <CalloutBlock text={output.maxim} accentHue={ac} />
      </Section>

      <Section label="Act of Repair" accent={ac}>
        <TextBlock text={output.act_of_repair} />
      </Section>
    </div>
  );
}

/* ─── The Fool — counter-brief ───────────────────────────────── */

function FoolOutputView({ output }: { output: FoolOutput }) {
  const ac = accentFor('fool');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <Section label="Your Claim" accent={ac}>
        <TextBlock text={output.core_claim} />
      </Section>

      <Section label="Why You May Be Wrong" accent={ac}>
        <TextBlock text={output.why_wrong} />
      </Section>

      {output.blind_spots.length > 0 && (
        <Section label="Blind Spots" accent={ac}>
          <BulletList items={output.blind_spots} />
        </Section>
      )}

      {output.risks.length > 0 && (
        <Section label="Risks" accent={ac}>
          <BulletList items={output.risks} />
        </Section>
      )}

      <Section label="Reputational Danger" accent={ac}>
        <TextBlock text={output.reputational_danger} />
      </Section>

      {output.second_order_effects.length > 0 && (
        <Section label="Second-Order Effects" accent={ac}>
          <BulletList items={output.second_order_effects} />
        </Section>
      )}

      <Section label="Rival Interpretation" accent={ac}>
        <CalloutBlock text={output.rival_interpretation} accentHue={ac} />
      </Section>
    </div>
  );
}

/* ─── The Interpreter — parallel readings ───────────────────── */

function InterpreterOutputView({ output }: { output: InterpreterOutput }) {
  const ac = accentFor('interpreter');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <Section label="The Symbol" accent={ac}>
        <CalloutBlock text={output.symbol_named} accentHue={ac} />
      </Section>

      <Section label="Five Lenses" accent={ac}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {output.lenses.map((lens, i) => (
            <div
              key={lens.name}
              style={{
                paddingBottom: '1.125rem',
                marginBottom:
                  i < output.lenses.length - 1 ? '1.125rem' : 0,
                borderBottom:
                  i < output.lenses.length - 1
                    ? `1px solid rgb(${ac} / 0.1)`
                    : 'none',
              }}
            >
              <div
                style={{
                  ...labelCss,
                  color: `rgb(${ac})`,
                  marginBottom: '0.5rem',
                }}
              >
                {lens.name}
              </div>
              <p
                style={{
                  fontSize: 'clamp(0.875rem, 0.8rem + 0.25vw, 0.9375rem)',
                  color: 'rgb(var(--color-text-muted))',
                  lineHeight: 1.65,
                  marginBottom: '0.375rem',
                }}
              >
                <strong
                  style={{
                    color: 'rgb(var(--color-text))',
                    fontWeight: 500,
                  }}
                >
                  Notices —
                </strong>{' '}
                {lens.notices}
              </p>
              <p
                style={{
                  fontSize: 'clamp(0.8rem, 0.75rem + 0.2vw, 0.875rem)',
                  color: 'rgb(var(--color-text-faint))',
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                }}
              >
                Misses — {lens.misses}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Tensions Between Interpretations" accent={ac}>
        <TextBlock text={output.tensions} />
      </Section>

      {output.questions_to_sit_with.length > 0 && (
        <Section label="Questions to Sit With" accent={ac}>
          <BulletList items={output.questions_to_sit_with} />
        </Section>
      )}
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────────── */

export function SessionOutput({
  toolSlug,
  output,
}: {
  toolSlug: string;
  output: unknown;
}) {
  switch (toolSlug) {
    case 'small-council':
      return <SmallCouncilOutput output={output as CouncilOutput} />;
    case 'genealogist':
      return <GenealogyOutputView output={output as GenealogyOutput} />;
    case 'interlocutor':
      return (
        <InterlocutorOutputView output={output as InterlocutorOutput} />
      );
    case 'stoics-ledger':
      return (
        <StoicsLedgerOutputView output={output as StoicsLedgerOutput} />
      );
    case 'fool':
      return <FoolOutputView output={output as FoolOutput} />;
    case 'interpreter':
      return (
        <InterpreterOutputView output={output as InterpreterOutput} />
      );
    default:
      return (
        <pre
          style={{
            fontSize: '0.8125rem',
            color: 'rgb(var(--color-text-muted))',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(output, null, 2)}
        </pre>
      );
  }
}
