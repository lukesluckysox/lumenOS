import { useEffect, useState } from "react";

const APP_URLS: Record<string, string> = {
  liminal: "https://liminal-app.up.railway.app",
  parallax: "https://parallaxapp.up.railway.app",
  praxis: "https://praxis-app.up.railway.app",
  axiom: "https://axiomtool-production.up.railway.app",
};

type Status = "ok" | "warn" | "err" | "off";
const STATUS_DOT_CLS: Record<Status, string> = {
  ok: "pipeline__dot--ok",
  warn: "pipeline__dot--warn",
  err: "pipeline__dot--err",
  off: "pipeline__dot--off",
};
const STATUS_LABELS: Record<Status, string> = { ok: "Online", warn: "Slow", err: "Down", off: "Unknown" };
const STATUS_ROW_CLS: Record<Status, string> = {
  ok: "pipeline__row-status--ok",
  warn: "pipeline__row-status--warn",
  err: "pipeline__row-status--err",
  off: "pipeline__row-status--off",
};

export default function PipelineHealth() {
  const [results, setResults] = useState<Record<string, Status>>({});
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function check() {
      const entries = Object.entries(APP_URLS);
      const res = await Promise.all(
        entries.map(async ([name, url]) => {
          try {
            const ctrl = new AbortController();
            const tm = setTimeout(() => ctrl.abort(), 6000);
            await fetch(url, { mode: "no-cors", signal: ctrl.signal });
            clearTimeout(tm);
            return [name, "ok" as Status] as const;
          } catch (e: any) {
            return [name, e.name === "AbortError" ? "warn" as Status : "err" as Status] as const;
          }
        })
      );
      setResults(Object.fromEntries(res));
      setVisible(true);
    }
    check();
  }, []);

  return (
    <div className={`pipeline ${visible ? "pipeline--visible" : ""}`} aria-label="Connection status">
      <span className="pipeline__label">Status</span>
      <div className="pipeline__dots">
        {Object.keys(APP_URLS).map((name) => (
          <span key={name} className={`pipeline__dot ${STATUS_DOT_CLS[results[name] || "off"]}`} title={name} />
        ))}
      </div>
      <div className="pipeline__tooltip">
        {Object.keys(APP_URLS).map((name) => {
          const st = results[name] || "off";
          return (
            <div key={name} className="pipeline__row">
              <span className="pipeline__row-name">{name.charAt(0).toUpperCase() + name.slice(1)}</span>
              <span className={`pipeline__row-status ${STATUS_ROW_CLS[st]}`}>{STATUS_LABELS[st]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
