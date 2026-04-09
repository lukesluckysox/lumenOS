import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState<{ userId: number; username: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background px-6 py-10 max-w-lg mx-auto">
      {/* Back */}
      <Link href="/">
        <div className="flex items-center gap-1.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors text-sm mb-10 cursor-pointer">
          <ArrowLeft size={14} />
          <span>Back</span>
        </div>
      </Link>

      {/* Username */}
      <p className="text-[10px] text-muted-foreground/30 font-mono uppercase tracking-widest mb-2">
        Signed in as
      </p>
      <h1 className="text-xl font-display font-semibold text-foreground tracking-tight mb-1">
        {user.username}
      </h1>

      {/* Separator */}
      <div className="h-px bg-border/50 my-8" />

      {/* Suite reference */}
      <p className="text-[10px] text-muted-foreground/30 font-mono uppercase tracking-widest mb-3">
        Part of Lumen
      </p>
      <p className="text-sm text-muted-foreground/60 leading-relaxed max-w-[38ch] mb-4">
        Your Praxis account is part of the Lumen suite. Experiments you run here refine the principles that Axiom distills.
      </p>
      <a
        href="https://lumen-os.up.railway.app"
        className="inline-flex items-center gap-1.5 text-sm text-primary/70 hover:text-primary transition-colors"
      >
        Open Lumen <ExternalLink size={12} />
      </a>

      {/* Separator */}
      <div className="h-px bg-border/50 my-8" />

      {/* Logout */}
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
          window.location.reload();
        }}
        className="text-sm text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
