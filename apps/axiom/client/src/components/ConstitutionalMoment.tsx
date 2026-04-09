import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface ConstitutionalMomentProps {
  axiom: {
    truthClaim: string;
    workingPrinciple: string;
    confidence: string;
  };
  onContinue?: () => void;
}

export default function ConstitutionalMoment({ axiom, onContinue }: ConstitutionalMomentProps) {
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Trigger fade-in on mount
    const fadeIn = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    // Show button after 2.5s
    const buttonTimer = setTimeout(() => setShowButton(true), 2500);

    // Auto-advance after 5s
    const autoTimer = setTimeout(() => {
      handleContinue();
    }, 5000);

    return () => {
      cancelAnimationFrame(fadeIn);
      clearTimeout(buttonTimer);
      clearTimeout(autoTimer);
    };
  }, []);

  function handleContinue() {
    if (onContinue) {
      onContinue();
    } else {
      navigate("/constitution");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "radial-gradient(ellipse at center, rgba(255, 209, 102, 0.06) 0%, rgba(0,0,0,0) 60%), rgba(10, 10, 12, 0.96)",
        opacity: visible ? 1 : 0,
        transition: "opacity 600ms ease",
      }}
      onClick={handleContinue}
    >
      <div
        className="max-w-lg w-full mx-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gold line divider */}
        <div
          className="mx-auto mb-8"
          style={{
            width: "60px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #FFD166, transparent)",
          }}
        />

        {/* "Constitutional" in Cormorant serif, gold */}
        <div
          className="mb-6 tracking-widest uppercase"
          style={{
            fontFamily: "'Cormorant Garamond', 'Cormorant', 'Georgia', serif",
            fontSize: "clamp(2rem, 5vw, 3rem)",
            color: "#FFD166",
            letterSpacing: "0.25em",
            fontWeight: 300,
          }}
        >
          Constitutional
        </div>

        {/* Working principle — medium serif */}
        {axiom.workingPrinciple && axiom.workingPrinciple.trim().length > 0 && (
          <p
            className="mb-5 leading-relaxed"
            style={{
              fontFamily: "'Cormorant Garamond', 'Cormorant', 'Georgia', serif",
              fontSize: "1.125rem",
              color: "rgba(255, 255, 255, 0.85)",
              fontStyle: "italic",
            }}
          >
            {axiom.workingPrinciple}
          </p>
        )}

        {/* Truth claim — smaller body */}
        <p
          className="leading-relaxed mb-10"
          style={{
            fontSize: "0.875rem",
            color: "rgba(255, 255, 255, 0.45)",
            fontStyle: "italic",
          }}
        >
          &ldquo;{axiom.truthClaim}&rdquo;
        </p>

        {/* Gold line divider */}
        <div
          className="mx-auto mb-10"
          style={{
            width: "40px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,209,102,0.4), transparent)",
          }}
        />

        {/* Continue button — fades in after pause */}
        <div
          style={{
            opacity: showButton ? 1 : 0,
            transition: "opacity 400ms ease",
          }}
        >
          <button
            onClick={handleContinue}
            className="font-mono text-[10px] uppercase tracking-widest px-5 py-2.5 transition-colors"
            style={{
              color: "rgba(255, 209, 102, 0.7)",
              border: "1px solid rgba(255, 209, 102, 0.2)",
              letterSpacing: "0.2em",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#FFD166";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255, 209, 102, 0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255, 209, 102, 0.7)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255, 209, 102, 0.2)";
            }}
          >
            Continue to Constitution →
          </button>
        </div>
      </div>
    </div>
  );
}
