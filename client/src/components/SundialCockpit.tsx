import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/* ── Types ──────────────────────────────────────────────── */
interface DimensionBreakdown {
  parallaxBase: number;
  epistemicBoost: number;
  praxisBoost: number;
  integrityFactor?: number;
  topContributors?: string[];
}
interface Dimension {
  label: string;
  name: string;
  fed: number;
  target: number;
  breakdown?: DimensionBreakdown;
}
interface CockpitState {
  alignment: number;
  dimensions: Dimension[];
  sources: Record<string, boolean>;
}

const FALLBACK: CockpitState = {
  alignment: 50,
  dimensions: [
    { label: "Clarity", name: "clarity", fed: 20, target: 20 },
    { label: "Groundedness", name: "groundedness", fed: 20, target: 20 },
    { label: "Agency", name: "agency", fed: 20, target: 20 },
    { label: "Vitality", name: "vitality", fed: 20, target: 20 },
    { label: "Connection", name: "connection", fed: 20, target: 20 },
    { label: "Expression", name: "expression", fed: 20, target: 20 },
    { label: "Discovery", name: "discovery", fed: 20, target: 20 },
    { label: "Purpose", name: "purpose", fed: 20, target: 20 },
    { label: "Integrity", name: "integrity", fed: 20, target: 20 },
  ],
  sources: {},
};

const GOLD = "#FFD166";
const GOLD_DIM = "rgba(255,209,102,0.30)";
const GOLD_GLOW = "rgba(255,209,102,0.18)";
const MAX_PER_DIM = 40;

/* ── Canvas renderer ────────────────────────────────────── */
function renderCanvas(canvas: HTMLCanvasElement, state: CockpitState) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;
  const SUN_R = W * 0.085;
  const INNER_R = W * 0.16;
  const MAX_R = W * 0.36;
  const LABEL_R = W * 0.41;
  const dims = state.dimensions;
  const N = dims.length;
  const STEP = (Math.PI * 2) / N;
  const OFFSET = -Math.PI / 2;

  function valRadius(v: number) {
    return INNER_R + (MAX_R - INNER_R) * Math.max(0, Math.min(1, v / MAX_PER_DIM));
  }
  function pt(angle: number, r: number) {
    return { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r };
  }

  ctx.clearRect(0, 0, W, H);

  // reference circles
  [10, 20, 30, 40].forEach((v) => {
    ctx.beginPath();
    ctx.arc(CX, CY, valRadius(v), 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,209,102,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // ray axes
  for (let i = 0; i < N; i++) {
    const a = OFFSET + i * STEP;
    const pI = pt(a, INNER_R), pO = pt(a, MAX_R);
    ctx.beginPath(); ctx.moveTo(pI.x, pI.y); ctx.lineTo(pO.x, pO.y);
    ctx.strokeStyle = "rgba(255,209,102,0.10)"; ctx.lineWidth = 1; ctx.stroke();
  }

  // each dimension
  for (let i = 0; i < N; i++) {
    const a = OFFSET + i * STEP;
    const d = dims[i];
    const perpLen = 14;
    const perpX = Math.cos(a + Math.PI / 2) * perpLen;
    const perpY = Math.sin(a + Math.PI / 2) * perpLen;

    // target (dashed)
    const tP = pt(a, valRadius(d.target));
    ctx.beginPath(); ctx.moveTo(tP.x - perpX, tP.y - perpY); ctx.lineTo(tP.x + perpX, tP.y + perpY);
    ctx.strokeStyle = GOLD_DIM; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);

    // fed (solid bright)
    const fP = pt(a, valRadius(d.fed));
    ctx.beginPath(); ctx.moveTo(fP.x - perpX, fP.y - perpY); ctx.lineTo(fP.x + perpX, fP.y + perpY);
    ctx.strokeStyle = GOLD_GLOW; ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fP.x - perpX, fP.y - perpY); ctx.lineTo(fP.x + perpX, fP.y + perpY);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;

    // label
    const lP = pt(a, LABEL_R);
    ctx.font = "500 17px Satoshi, sans-serif";
    ctx.fillStyle = "rgba(255,209,102,0.65)";
    ctx.textBaseline = "middle";
    const deg = ((a * 180 / Math.PI) % 360 + 360) % 360;
    if (deg > 85 && deg < 95) ctx.textAlign = "center";
    else if (deg > 265 && deg < 275) ctx.textAlign = "center";
    else if (deg > 90 && deg < 270) ctx.textAlign = "right";
    else ctx.textAlign = "left";
    ctx.fillText(d.label, lP.x, lP.y);

    // value
    const vP = pt(a, valRadius(d.fed) + 16);
    ctx.font = "600 13px Satoshi, sans-serif";
    ctx.fillStyle = "rgba(255,209,102,0.5)";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(d.fed.toFixed(1), vP.x, vP.y);
  }

  // sun
  const sunGrd = ctx.createRadialGradient(CX, CY, SUN_R * 0.3, CX, CY, SUN_R * 2);
  sunGrd.addColorStop(0, "rgba(255,209,102,0.18)"); sunGrd.addColorStop(1, "rgba(255,209,102,0)");
  ctx.beginPath(); ctx.arc(CX, CY, SUN_R * 2, 0, Math.PI * 2); ctx.fillStyle = sunGrd; ctx.fill();

  const orbGrd = ctx.createRadialGradient(CX, CY - SUN_R * 0.2, 0, CX, CY, SUN_R);
  orbGrd.addColorStop(0, "rgba(255,209,102,0.25)"); orbGrd.addColorStop(0.7, "rgba(255,209,102,0.10)"); orbGrd.addColorStop(1, "rgba(255,209,102,0.03)");
  ctx.beginPath(); ctx.arc(CX, CY, SUN_R, 0, Math.PI * 2); ctx.fillStyle = orbGrd; ctx.fill();

  ctx.beginPath(); ctx.arc(CX, CY, SUN_R, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,209,102,0.2)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(CX, CY, SUN_R * 0.55, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,209,102,0.12)"; ctx.lineWidth = 0.5; ctx.stroke();

  // alignment score
  let totalFed = 0, totalTarget = 0;
  dims.forEach((d) => { totalFed += d.fed; totalTarget += d.target; });
  const pct = totalTarget > 0 ? Math.min(100, Math.round((totalFed / totalTarget) * 100)) : 0;
  ctx.font = "300 48px Cormorant, serif"; ctx.fillStyle = GOLD;
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(String(pct), CX, CY + 4);
  ctx.font = "500 11px Satoshi, sans-serif"; ctx.fillStyle = "rgba(255,209,102,0.45)";
  ctx.textBaseline = "top"; ctx.fillText("ALIGNMENT", CX, CY + 16);
}

/* ── Sundial SVG ray builder ─────────────────────────────── */
const NUM_RAYS = 18;
const SC_CX = 100, SC_CY = 100, SC_INNER = 36, SC_OUTER = 88, SC_BASE_W = 7, SC_TIP_W = 2;

function buildRayPath(index: number, fillPct: number) {
  const a = (index / NUM_RAYS) * Math.PI * 2 - Math.PI / 2;
  const cosA = Math.cos(a), sinA = Math.sin(a);
  const perpCos = Math.cos(a + Math.PI / 2), perpSin = Math.sin(a + Math.PI / 2);
  const rayLen = SC_OUTER - SC_INNER;
  const filledLen = rayLen * Math.min(1, Math.max(0, fillPct));
  const filledOuter = SC_INNER + filledLen;
  const halfBase = SC_BASE_W / 2, halfTip = SC_TIP_W / 2;
  const t = filledLen / rayLen;
  const halfMid = halfBase + (halfTip - halfBase) * t;
  const paths: { d: string; filled: boolean }[] = [];

  if (filledLen > 0.5) {
    const ix1 = SC_CX + cosA * SC_INNER - perpCos * halfBase;
    const iy1 = SC_CY + sinA * SC_INNER - perpSin * halfBase;
    const fx1 = SC_CX + cosA * filledOuter - perpCos * halfMid;
    const fy1 = SC_CY + sinA * filledOuter - perpSin * halfMid;
    const fx2 = SC_CX + cosA * filledOuter + perpCos * halfMid;
    const fy2 = SC_CY + sinA * filledOuter + perpSin * halfMid;
    const ix2 = SC_CX + cosA * SC_INNER + perpCos * halfBase;
    const iy2 = SC_CY + sinA * SC_INNER + perpSin * halfBase;
    paths.push({
      d: `M${ix1.toFixed(2)},${iy1.toFixed(2)} L${fx1.toFixed(2)},${fy1.toFixed(2)} L${fx2.toFixed(2)},${fy2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} Z`,
      filled: true,
    });
  }
  if (filledLen < rayLen - 0.5) {
    const ux1 = SC_CX + cosA * filledOuter - perpCos * halfMid;
    const uy1 = SC_CY + sinA * filledOuter - perpSin * halfMid;
    const ox1 = SC_CX + cosA * SC_OUTER - perpCos * halfTip;
    const oy1 = SC_CY + sinA * SC_OUTER - perpSin * halfTip;
    const ox2 = SC_CX + cosA * SC_OUTER + perpCos * halfTip;
    const oy2 = SC_CY + sinA * SC_OUTER + perpSin * halfTip;
    const ux2 = SC_CX + cosA * filledOuter + perpCos * halfMid;
    const uy2 = SC_CY + sinA * filledOuter + perpSin * halfMid;
    paths.push({
      d: `M${ux1.toFixed(2)},${uy1.toFixed(2)} L${ox1.toFixed(2)},${oy1.toFixed(2)} L${ox2.toFixed(2)},${oy2.toFixed(2)} L${ux2.toFixed(2)},${uy2.toFixed(2)} Z`,
      filled: false,
    });
  }
  return paths;
}

function sundialRays(dims: Dimension[]) {
  const rayData: number[] = [];
  dims.forEach((d) => {
    const pct = d.target > 0 ? Math.min(1, d.fed / d.target) : 0;
    rayData.push(pct, pct);
  });
  const paths: JSX.Element[] = [];
  for (let r = 0; r < NUM_RAYS; r++) {
    const fill = r < rayData.length ? rayData[r] : 0;
    buildRayPath(r, fill).forEach((p, pi) =>
      paths.push(
        <path key={`${r}-${pi}`} d={p.d}
          fill={p.filled ? GOLD : "rgba(255,209,102,0.15)"}
          opacity={p.filled ? 0.9 : 1}
          filter={p.filled ? "url(#sc-ray-glow)" : undefined}
        />
      )
    );
  }
  return paths;
}

/* ── Component ──────────────────────────────────────────── */
export default function SundialCockpit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localTargets, setLocalTargets] = useState<Record<string, number>>({});
  const [activeDim, setActiveDim] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: state = FALLBACK } = useQuery<CockpitState>({
    queryKey: ["/api/cockpit/state"],
    queryFn: async () => {
      const r = await fetch("/api/cockpit/state", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  // Merged state (API + local target overrides)
  const mergedState: CockpitState = {
    ...state,
    dimensions: state.dimensions.map((d) => ({
      ...d,
      target: localTargets[d.name] !== undefined ? localTargets[d.name] : d.target,
    })),
  };

  const saveMutation = useMutation({
    mutationFn: async (targets: Record<string, number>) => {
      const r = await fetch("/api/cockpit/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(targets),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cockpit/state"] });
      setLocalTargets({});
    },
  });

  // Draw canvas whenever expanded view changes
  useEffect(() => {
    if (expanded && canvasRef.current) {
      renderCanvas(canvasRef.current, mergedState);
    }
  }, [expanded, mergedState]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const x = e.clientX - rect.left - cx, y = e.clientY - rect.top - cy;
    const sunR = c.width * 0.085 * 1.5 * (rect.width / c.width);
    if (Math.sqrt(x * x + y * y) <= sunR) setExpanded(false);
  }, []);

  const totalFed = mergedState.dimensions.reduce((s, d) => s + d.fed, 0);
  const totalTarget = mergedState.dimensions.reduce((s, d) => s + d.target, 0);
  const pct = totalTarget > 0 ? Math.min(100, Math.round((totalFed / totalTarget) * 100)) : 0;

  const sourceNames: Record<string, string> = { parallax: "Parallax", epistemic: "Loop", praxis: "Praxis", axiom: "Axiom" };

  return (
    <div id="cockpit-wrapper" className={expanded ? "cockpit-wrapper--expanded" : "cockpit-wrapper--collapsed"}>

      {/* ─ Compact sundial (collapsed view) ─ */}
      {!expanded && (
        <div className="sundial-compact" tabIndex={0} role="button" aria-label="Expand alignment sundial"
          onClick={() => setExpanded(true)}>
          <div className="sundial-compact__svg-wrap">
            <svg className="sundial-compact__svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="sc-orb-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFD166" stopOpacity="0.25" />
                  <stop offset="70%" stopColor="#FFD166" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#FFD166" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="sc-orb-fill" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#FFD166" stopOpacity="0.3" />
                  <stop offset="60%" stopColor="#FFD166" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#FFD166" stopOpacity="0.04" />
                </radialGradient>
                <filter id="sc-ray-glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <g>{sundialRays(mergedState.dimensions)}</g>
              <circle cx="100" cy="100" r="36" stroke="rgba(255,209,102,0.1)" strokeWidth="0.5" fill="none" />
              <circle cx="100" cy="100" r="50" fill="url(#sc-orb-glow)" className="sundial-compact__orb-pulse" />
              <circle cx="100" cy="100" r="24" fill="url(#sc-orb-fill)" />
              <circle cx="100" cy="100" r="24" stroke="rgba(255,209,102,0.22)" strokeWidth="0.7" fill="none" />
              <circle cx="100" cy="100" r="15" stroke="rgba(255,209,102,0.1)" strokeWidth="0.4" fill="none" />
            </svg>
          </div>
          <div className="sundial-compact__summary">
            <div className="sundial-compact__alignment-line">
              <span className="sundial-compact__pct">
                <span>{pct}</span>
                <span className="sundial-compact__pct-sign">%</span>
              </span>
              <span className="sundial-compact__label">Alignment</span>
            </div>
            <div className="sundial-compact__tally">
              Current: <strong>{Math.round(totalFed)}</strong> / Target: <strong>{Math.round(totalTarget)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ─ Expanded solar cockpit ─ */}
      {expanded && (
        <>
          <div className="solar-cockpit up" aria-label="Alignment cockpit — 9 dimensions">
            <canvas ref={canvasRef} id="solar-canvas" width={840} height={840} onClick={handleCanvasClick} />
          </div>

          {/* Dimension detail panel */}
          <div className="sundial-detail" id="sundial-detail">
            <div className="sundial-detail__grid" id="sundial-detail-grid">
              {mergedState.dimensions.map((d) => {
                const dp = d.target > 0 ? Math.min(100, Math.round((d.fed / d.target) * 100)) : 0;
                return (
                  <button key={d.name} className={`sundial-detail__item ${activeDim === d.name ? "sundial-detail__item--active" : ""}`}
                    onClick={() => setActiveDim(activeDim === d.name ? null : d.name)}>
                    <span className="sundial-detail__name">{d.label}</span>
                    <span className="sundial-detail__bar">
                      <span className="sundial-detail__bar-fill" style={{ width: `${dp}%` }} />
                    </span>
                    <span className="sundial-detail__vals">
                      <span>{Math.round(d.fed)} / {Math.round(d.target)}</span>
                      <strong>{dp}%</strong>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drilldown */}
          {activeDim && (() => {
            const dim = mergedState.dimensions.find((d) => d.name === activeDim);
            if (!dim?.breakdown) return null;
            const bd = dim.breakdown;
            const bars = dim.name === "integrity"
              ? [{ label: "Integrity", value: bd.integrityFactor || 0, max: 40 }]
              : [{ label: "Parallax", value: bd.parallaxBase, max: 40 }, { label: "Epistemic", value: bd.epistemicBoost, max: 4 }, { label: "Praxis", value: bd.praxisBoost, max: 3 }];
            return (
              <div style={{ padding: "var(--sp-3)", borderRadius: "var(--r-sm)", border: "1px solid rgba(141,153,174,0.15)", background: "rgba(255,209,102,0.03)", margin: "var(--sp-3) auto 0", maxWidth: "480px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-2)" }}>
                  <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text)" }}>{dim.label}</h3>
                  <button onClick={() => setActiveDim(null)} style={{ color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}>&times;</button>
                </div>
                {bars.map((b) => {
                  const bp = b.max > 0 ? Math.round(Math.min(100, (b.value / b.max) * 100)) : 0;
                  return (
                    <div key={b.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "4px" }}>
                      <span style={{ width: "4rem", fontSize: "10px", fontFamily: "monospace", color: "var(--muted)" }}>{b.label}</span>
                      <span className="sundial-detail__bar" style={{ flex: 1 }}>
                        <span className="sundial-detail__bar-fill" style={{ width: `${bp}%` }} />
                      </span>
                      <span style={{ width: "2rem", textAlign: "right" as const, fontSize: "10px", fontFamily: "monospace", color: "var(--muted)" }}>{(Math.round(b.value * 10) / 10)}</span>
                    </div>
                  );
                })}
                {bd.topContributors?.map((c, i) => (
                  <p key={i} style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>{c}</p>
                ))}
              </div>
            );
          })()}

          {/* Sources */}
          <div className="cockpit-sources" id="cockpit-sources">
            {Object.entries(sourceNames).map(([k, v]) => (
              <span key={k} className={state.sources[k] ? "src-on" : ""}>
                <span className="src-dot" />
                {v}
              </span>
            ))}
          </div>

          {/* Settings toggle */}
          <button className="settings-toggle" id="settings-toggle" aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(!settingsOpen)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: settingsOpen ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}>
              <path d="M12 15.5l-6-6h12l-6 6z" fill="currentColor" stroke="none" />
            </svg>
            Set Targets
          </button>

          {/* Settings panel */}
          <div className={`cockpit-settings ${settingsOpen ? "" : "collapsed"}`} id="cockpit-settings">
            <div className="settings-total">
              Target Total: <strong id="target-total">{Math.round(totalTarget)}</strong> / 360
            </div>
            <div className="settings-grid" id="settings-grid">
              {mergedState.dimensions.map((d) => (
                <div key={d.name} className="settings-row">
                  <label>{d.label}</label>
                  <input type="range" min={0} max={40} step={1} value={d.target}
                    onChange={(e) => setLocalTargets((prev) => ({ ...prev, [d.name]: Number(e.target.value) }))} />
                  <span className="val-display">{Math.round(d.target)}<span className="suffix">/40</span></span>
                </div>
              ))}
            </div>
            <div className="settings-save">
              <button className="btn-save-targets" id="btn-save"
                onClick={() => {
                  const targets: Record<string, number> = {};
                  mergedState.dimensions.forEach((d) => { targets[d.name] = d.target; });
                  saveMutation.mutate(targets);
                }}
                disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : saveMutation.isSuccess ? "Saved" : "Save Targets"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
