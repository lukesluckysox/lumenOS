import SundialCockpit from "@/components/SundialCockpit";
import StateCards from "@/components/StateCards";
import WhatAdvanced from "@/components/WhatAdvanced";
import LoopPulse from "@/components/LoopPulse";
import ToolCards from "@/components/ToolCards";
import LoopSensitivity from "@/components/LoopSensitivity";
import ActivityLog from "@/components/ActivityLog";

interface Props {
  userId?: number;
}

export default function HomePage({ userId }: Props) {
  return (
    <main>
      {/* ═══ HERO ═══ */}
      <section className="hero" id="hero" aria-label="Introduction">
        <div className="hero__atmo" aria-hidden="true">
          <div className="hero__glow hero__glow--a"></div>
          <div className="hero__glow hero__glow--b"></div>
          <div className="hero__grid"></div>
        </div>

        <div className="wrap hero__body">
          <SundialCockpit />

          <h1 className="hero__headline up d1">
            Where reflection<br />becomes structure.
          </h1>
        </div>
      </section>

      {/* ═══ COCKPIT — authenticated user modules ═══ */}
      <div id="cockpit" className="cockpit" aria-label="Personal observation cockpit">
        <StateCards />
        <WhatAdvanced />
        <LoopPulse />
      </div>

      {/* ═══ TOOLS ═══ */}
      <ToolCards />

      {/* ═══ BOTTOM ROW — Sensitivity + Event History ═══ */}
      <section className="section bottom-row-band" aria-label="Controls and history">
        <div className="wrap">
          <div className="bottom-row">
            <div className="bottom-row__col">
              <LoopSensitivity userId={userId} />
            </div>
            <div className="bottom-row__col">
              <ActivityLog />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
