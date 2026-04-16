import { useState, useEffect, useCallback } from "react";

interface ProfileData {
  username: string;
  email: string;
  sensitivity: string;
  plan: string;
  createdAt: string;
  isOwner: boolean;
}

interface OracleUser {
  id: number;
  username?: string;
  name?: string;
  email?: string;
  role?: string;
  plan?: string;
  createdAt?: string;
  created_at?: string;
}

interface OracleData {
  lumen: OracleUser[];
  liminal: OracleUser[];
  parallax: OracleUser[];
  praxis: OracleUser[];
  axiom: OracleUser[];
  subAppStatus: Record<string, string>;
}

const APPS = ["lumen", "liminal", "parallax", "praxis", "axiom"] as const;
const APP_LABELS: Record<string, string> = { lumen: "Lumen", liminal: "Liminal", parallax: "Parallax", praxis: "Praxis", axiom: "Axiom" };

function formatDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return iso; }
}

interface Props { open: boolean; onClose: () => void; onLogout: () => void; }

export default function ProfilePanel({ open, onClose, onLogout }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [oracleData, setOracleData] = useState<OracleData | null>(null);
  const [oracleTab, setOracleTab] = useState("lumen");
  const [oracleLoading, setOracleLoading] = useState(false);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/profile", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setProfile(d);
          if (d.isOwner) loadOracle();
        }
      })
      .catch(() => {});
  }, [open]);

  const loadOracle = useCallback(async () => {
    setOracleLoading(true);
    try {
      const res = await fetch("/api/oracle/users", { credentials: "same-origin" });
      if (res.ok) setOracleData(await res.json());
    } catch {}
    setOracleLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  async function setPlan(userId: number, plan: string) {
    try {
      const res = await fetch(`/api/oracle/users/${userId}/plan`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || "Failed"); return; }
      setOracleData((prev) => {
        if (!prev) return prev;
        return { ...prev, lumen: prev.lumen.map((u) => u.id === userId ? { ...u, plan } : u) };
      });
    } catch (e: any) { alert("Error: " + e.message); }
  }

  async function deleteUser(userId: number, username: string) {
    if (!confirm(`Delete user "${username}" from Lumen AND all sub-apps? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/oracle/users/${userId}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) { const e = await res.json(); alert(e.error || "Failed"); return; }
      setOracleData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lumen: prev.lumen.filter((u) => u.id !== userId),
          liminal: prev.liminal.filter((u) => (u.username || u.name) !== username),
          parallax: prev.parallax.filter((u) => (u.username || u.name) !== username),
          praxis: prev.praxis.filter((u) => (u.username || u.name) !== username),
          axiom: prev.axiom.filter((u) => (u.username || u.name) !== username),
        };
      });
    } catch (e: any) { alert("Error: " + e.message); }
  }

  async function deleteAppUser(app: string, username: string, email: string) {
    if (!confirm(`Delete user "${username}" from ${app} only?`)) return;
    try {
      const res = await fetch(`/api/oracle/app/${app}/user`, {
        method: "DELETE", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || "Failed"); return; }
      setOracleData((prev) => {
        if (!prev) return prev;
        return { ...prev, [app]: (prev as any)[app].filter((u: OracleUser) => (u.username || u.name) !== username) };
      });
    } catch (e: any) { alert("Error: " + e.message); }
  }

  const oracleRows = oracleData ? (oracleData as any)[oracleTab] || [] : [];
  const hasEmail = oracleRows.some((u: OracleUser) => u.email);

  return (
    <>
      <div className={`profile-backdrop ${open ? "profile-backdrop--open" : ""}`} onClick={onClose} />
      <div className={`profile-panel ${open ? "profile-panel--open" : ""} ${wide ? "profile-panel--wide" : ""}`}>
        <div className="profile-panel__head">
          <h2 className="profile-panel__title">Profile</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
            <button onClick={() => setWide(!wide)} className="oracle-plan-btn">
              {wide ? "Collapse" : "Expand"}
            </button>
            <button className="profile-panel__close" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="profile-panel__body">
          {profile && (
            <div>
              <p className="pf-username">{profile.username}</p>
              <div className="pf-field">
                <span className="pf-label">Email</span>
                <span className="pf-value">{profile.email}</span>
              </div>
              <div className="pf-field">
                <span className="pf-label">Member since</span>
                <span className="pf-value">{formatDate(profile.createdAt)}</span>
              </div>
              <div className="pf-field">
                <span className="pf-label">Sensitivity</span>
                <span className="pf-value" style={{ textTransform: "capitalize" }}>{profile.sensitivity || "medium"}</span>
              </div>
              <button className="pf-signout" onClick={onLogout}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                </svg>
                Sign out
              </button>
            </div>
          )}

          {profile?.isOwner && (
            <>
              <div className="oracle-divider">
                <span className="oracle-divider__label">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ verticalAlign: "middle", marginRight: ".3em" }}>
                    <ellipse cx="12" cy="12" rx="10" ry="4"/>
                    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
                  </svg>
                  Oracle
                </span>
              </div>

              {oracleLoading ? (
                <div className="oracle-loading">
                  <span className="oracle-spinner" />
                  Loading oracle data...
                </div>
              ) : oracleData ? (
                <>
                  <div className="oracle-tabs">
                    {APPS.map((app) => {
                      const status = app === "lumen" ? "online" : (oracleData.subAppStatus[app] || "offline");
                      return (
                        <button key={app} onClick={() => setOracleTab(app)}
                          className={`oracle-tab ${oracleTab === app ? "oracle-tab--active" : ""}`}>
                          <span className={`oracle-tab__dot ${status === "online" ? "oracle-tab__dot--online" : "oracle-tab__dot--offline"}`} />
                          {APP_LABELS[app]}
                        </button>
                      );
                    })}
                  </div>

                  {oracleRows.length === 0 ? (
                    <p className="oracle-empty">
                      {oracleTab !== "lumen" && oracleData.subAppStatus[oracleTab] === "offline"
                        ? "Service offline — unable to fetch users."
                        : "No registered users."}
                    </p>
                  ) : (
                    <>
                      <p className="oracle-count"><strong>{oracleRows.length}</strong> registered user{oracleRows.length !== 1 ? "s" : ""}</p>
                      <table className="oracle-table">
                        <thead>
                          <tr>
                            <th>Username</th>
                            {hasEmail && <th>Email</th>}
                            <th>Joined</th>
                            <th>Plan</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {oracleRows.map((u: OracleUser, i: number) => {
                            const uname = u.username || u.name || "—";
                            const joined = formatDate(u.createdAt || u.created_at);
                            const currentPlan = u.plan || "aspirant";
                            const isOracle = u.role === "oracle";
                            return (
                              <tr key={i}>
                                <td>
                                  {uname} {isOracle && <span style={{ color: "var(--gold)", fontSize: "9px" }}>◆</span>}
                                </td>
                                {hasEmail && <td className="muted">{u.email || "—"}</td>}
                                <td className="muted">{joined}</td>
                                <td>
                                  {oracleTab === "lumen" ? (
                                    <span className="oracle-plan-group">
                                      {["aspirant", "fellow", "founder"].map((p) => (
                                        <button key={p} onClick={() => setPlan(u.id, p)}
                                          className={`oracle-plan-btn ${currentPlan === p ? "oracle-plan-btn--active" : ""}`}>
                                          {p}
                                        </button>
                                      ))}
                                    </span>
                                  ) : (
                                    <span className="oracle-plan-btn oracle-plan-btn--active">{currentPlan}</span>
                                  )}
                                </td>
                                <td>
                                  {!isOracle && (
                                    <span className="oracle-actions">
                                      <button onClick={() => oracleTab === "lumen" ? deleteUser(u.id, uname) : deleteAppUser(oracleTab, uname, u.email || "")}
                                        className="oracle-del-btn"
                                        title={oracleTab === "lumen" ? "Delete from Lumen + all sub-apps" : `Delete from ${oracleTab} only`}>
                                        ×
                                      </button>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
