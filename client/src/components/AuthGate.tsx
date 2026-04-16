import { useState } from "react";

interface AuthGateProps {
  onAuth: (username: string) => void;
}

const PLANS = [
  {
    id: "aspirant",
    name: "Aspirant",
    price: "Free forever",
    fellow: false,
    sections: [
      { app: "Liminal", features: ["All six thinking tools", "8 sessions per month", "7-day session archive"] },
      { app: "Parallax", features: ["Check-ins and gauges", "Baseline radar chart", "Archetype tracking", "Trajectory (data-driven unlock)", "Decision evaluation"] },
      { app: "Praxis & Axiom", features: ["Full access"] },
    ],
  },
  {
    id: "fellow",
    name: "Fellow",
    price: "$15 / month · coming soon",
    fellow: true,
    sections: [
      { app: "Liminal", features: ["All six thinking tools", "Unlimited sessions", "Full session archive", "Session comparison", "Markdown export"] },
      { app: "Parallax", features: ["Everything in Aspirant", "Daily Reading", "Feeling interpretation", "Decision analysis & suggestions", "Writing analysis", "Sonic Reading", "Signal Forecast", "Identity Wrapped"] },
      { app: "Praxis & Axiom", features: ["Full access"] },
    ],
  },
];

function PlanCard({ plan }: { plan: (typeof PLANS)[0] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`plan-card ${plan.fellow ? "plan-card--fellow" : ""} ${open ? "plan-card--open" : ""}`}>
      <div className="plan-card__header" onClick={() => setOpen(!open)} role="button" tabIndex={0} aria-expanded={open}>
        <span className="plan-card__header-left">
          <p className="plan-card__name">{plan.name}</p>
          <p className="plan-card__price">{plan.price}</p>
        </span>
        <span className="plan-card__toggle" aria-hidden="true">+</span>
      </div>
      <div className="plan-card__body">
        {plan.sections.map((sec) => (
          <div key={sec.app}>
            <p className="plan-card__app">{sec.app}</p>
            <ul className="plan-card__features">
              {sec.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthGate({ onAuth }: AuthGateProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!emailOrUsername || !password) { setError("Username or email and password required."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: emailOrUsername, password }),
      });
      const data = await res.json();
      if (res.ok) { onAuth(data.username); }
      else { setError(data.error || "Login failed."); }
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regUsername || !regEmail || !password || !confirmPassword) { setError("All fields required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: regUsername, email: regEmail, password }),
      });
      const data = await res.json();
      if (res.ok) { onAuth(data.username); }
      else { setError(data.error || "Registration failed."); }
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="gate">
      <div className={`gate__inner ${error ? "gate__inner--shake" : ""}`}>
        <div className="gate__mark" aria-hidden="true">
          <svg width="200" height="160" viewBox="0 0 200 160" fill="none">
            <circle cx="100" cy="80" r="28" stroke="currentColor" strokeWidth="0.5" opacity="0.15"/>
            <line x1="100" y1="64" x2="100" y2="52" stroke="#FFD166" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
            <line x1="100" y1="96" x2="100" y2="108" stroke="#FFD166" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
            <line x1="84" y1="80" x2="72" y2="80" stroke="#FFD166" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
            <line x1="116" y1="80" x2="128" y2="80" stroke="#FFD166" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
            <line x1="88.7" y1="68.7" x2="80.2" y2="60.2" stroke="#FFD166" strokeWidth="1.4" strokeLinecap="round" opacity="0.38"/>
            <line x1="111.3" y1="91.3" x2="119.8" y2="99.8" stroke="#FFD166" strokeWidth="1.4" strokeLinecap="round" opacity="0.38"/>
            <line x1="111.3" y1="68.7" x2="119.8" y2="60.2" stroke="#FFD166" strokeWidth="1.4" strokeLinecap="round" opacity="0.38"/>
            <line x1="88.7" y1="91.3" x2="80.2" y2="99.8" stroke="#FFD166" strokeWidth="1.4" strokeLinecap="round" opacity="0.38"/>
            <circle cx="100" cy="80" r="4" fill="#FFD166" opacity="0.95"/>
            <circle cx="100" cy="80" r="10" fill="none" stroke="#FFD166" strokeWidth="0.5" opacity="0.22"/>
            <line x1="100" y1="40" x2="100" y2="47" stroke="#FFD166" strokeWidth="1" strokeLinecap="round" opacity="0.42"/>
            <line x1="97" y1="47" x2="103" y2="47" stroke="#FFD166" strokeWidth="1" strokeLinecap="round" opacity="0.42"/>
            <circle cx="135.5" cy="80" r="1.3" fill="#FFD166" opacity="0.42"/>
            <circle cx="140" cy="80" r="1.3" fill="#FFD166" opacity="0.42"/>
            <circle cx="100" cy="117" r="3.5" stroke="#FFD166" strokeWidth="0.9" fill="none" opacity="0.42"/>
            <circle cx="62" cy="80" r="2.5" fill="#FFD166" opacity="0.42"/>
          </svg>
        </div>

        <p className="gate__wordmark">
          <svg className="lumen-loop-inline" width="28" height="28" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path d="M32 4C47.46 4 60 16.54 60 32S47.46 60 32 60" stroke="#FFD166" strokeWidth="1.6" strokeLinecap="round" opacity=".6"/>
            <path d="M32 60C16.54 60 4 47.46 4 32S16.54 4 32 4" stroke="#FFD166" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 3" opacity=".25"/>
            <circle cx="32" cy="4" r="2.5" fill="#FFD166" opacity=".8"/>
            <line x1="32" y1="14" x2="32" y2="22" stroke="#FFD166" strokeWidth="1.4" strokeLinecap="round" opacity=".7"/>
            <circle cx="32" cy="32" r="5" fill="#FFD166" opacity=".5"/>
            <circle cx="32" cy="32" r="3" fill="#FFD166" opacity=".8"/>
            <circle cx="32" cy="32" r="1.5" fill="#FFD166"/>
          </svg>
          Lumen
        </p>
        <hr className="gate__rule" aria-hidden="true" />
        <p className="gate__phrase">Where reflection becomes structure.</p>

        <div className="gate__auth gate__auth--visible">
          <div className="gate__tabs" role="tablist">
            <button
              className={`gate__tab ${mode === "login" ? "gate__tab--active" : ""}`}
              onClick={() => { setMode("login"); setError(""); }}
              role="tab"
              aria-selected={mode === "login"}
            >
              Sign in
            </button>
            <button
              className={`gate__tab ${mode === "register" ? "gate__tab--active" : ""}`}
              onClick={() => { setMode("register"); setError(""); }}
              role="tab"
              aria-selected={mode === "register"}
            >
              Register
            </button>
          </div>

          {mode === "login" ? (
            <div className="gate__panel" role="tabpanel">
              <form onSubmit={handleLogin} noValidate>
                <div className="gate__field">
                  <label htmlFor="login-email" className="sr-only">Username or email</label>
                  <input type="text" id="login-email" className="gate__input" placeholder="Username or email"
                    autoComplete="username" autoFocus value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)} />
                </div>
                <div className="gate__field">
                  <label htmlFor="login-password" className="sr-only">Password</label>
                  <input type="password" id="login-password" className="gate__input" placeholder="Password"
                    autoComplete="current-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
                <button type="submit" className="gate__submit" disabled={loading}>
                  {loading ? "Signing in\u2026" : <>Enter Lumen <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>}
                </button>
              </form>
            </div>
          ) : (
            <div className="gate__panel" role="tabpanel">
              <form onSubmit={handleRegister} noValidate>
                <div className="gate__field">
                  <label htmlFor="reg-username" className="sr-only">Username</label>
                  <input type="text" id="reg-username" className="gate__input" placeholder="Username"
                    autoComplete="username" autoFocus value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)} />
                </div>
                <div className="gate__field">
                  <label htmlFor="reg-email" className="sr-only">Email</label>
                  <input type="email" id="reg-email" className="gate__input" placeholder="Email"
                    autoComplete="email" value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)} />
                </div>
                <div className="gate__field">
                  <label htmlFor="reg-password" className="sr-only">Password</label>
                  <input type="password" id="reg-password" className="gate__input" placeholder="Password"
                    autoComplete="new-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="gate__field">
                  <label htmlFor="reg-confirm" className="sr-only">Confirm password</label>
                  <input type="password" id="reg-confirm" className="gate__input" placeholder="Confirm password"
                    autoComplete="new-password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <button type="submit" className="gate__submit" disabled={loading}>
                  {loading ? "Creating account\u2026" : <>Create account <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>}
                </button>
              </form>
            </div>
          )}

          <p className="gate__error" role="alert">{error}</p>
        </div>

        <div className="gate__plans gate__plans--visible">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
}
