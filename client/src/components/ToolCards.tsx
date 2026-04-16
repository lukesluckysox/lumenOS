import { ssoNavigate } from "@/lib/sso";

const TOOLS = [
  { idx: "01", name: "Liminal", fn: "Questions belief", desc: "Six instruments for questioning what you believe.", href: "https://liminal-app.up.railway.app/", cls: "card--liminal" },
  { idx: "02", name: "Parallax", fn: "Reveals pattern", desc: "Your patterns — what's stable, shifting, and recurring.", href: "https://parallaxapp.up.railway.app/", cls: "card--parallax" },
  { idx: "03", name: "Praxis", fn: "Tests hypothesis", desc: "Design experiments. Test what you think you've learned.", href: "https://praxis-app.up.railway.app/", cls: "card--praxis" },
  { idx: "04", name: "Axiom", fn: "Distills truth", desc: "Distill tested insights into governing principles.", href: "https://axiomtool-production.up.railway.app/#/", cls: "card--axiom" },
];

export default function ToolCards() {
  return (
    <section className="section tools-band" id="tools" aria-label="The four tools">
      <div className="tools-grid" role="list">
        {TOOLS.map((t, i) => (
          <article key={t.idx} className={`card ${t.cls} up ${i > 0 ? `d${i}` : ""}`} role="listitem">
            <p className="card__idx">{t.idx}</p>
            <div className="card__hd">
              <div className="card__hd-row">
                <h3 className="card__name">{t.name}</h3>
                <button onClick={() => ssoNavigate(t.href)} className="card__cta card__cta--live" aria-label={`Enter ${t.name}`}>
                  Enter
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
              <span className="card__fn">{t.fn}</span>
            </div>
            <p className="card__desc">{t.desc}</p>
          </article>
        ))}
      </div>

      <div className="wrap">
        <div className="section__head">
          <span className="section__eye">The Architecture</span>
          <h2 className="section__title">Four instruments.<br/>One recursive loop.</h2>
          <p className="section__desc">Each tool operates independently, but their power is in sequence. Together they close a system of reflective inquiry — one that spirals toward earned understanding, not comfortable answers.</p>
        </div>
      </div>
    </section>
  );
}
