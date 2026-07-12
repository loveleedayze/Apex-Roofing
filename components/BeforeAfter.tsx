"use client";

import { useRef, useState, useCallback } from "react";
import { MoveHorizontal } from "lucide-react";

/**
 * Draggable before/after slider. Uses two pure-SVG "photos" (weathered vs.
 * pristine roof) so there are zero image requests — keeps the page featherweight.
 */
export default function BeforeAfter() {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl shadow-card"
      onMouseDown={(e) => {
        dragging.current = true;
        update(e.clientX);
      }}
      onMouseMove={(e) => dragging.current && update(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => update(e.touches[0].clientX)}
      onTouchMove={(e) => update(e.touches[0].clientX)}
    >
      {/* AFTER (base layer, full) */}
      <RoofScene variant="after" />
      <span className="absolute right-3 top-3 rounded bg-black/50 px-2 py-1 text-xs font-bold text-white">
        AFTER
      </span>

      {/* BEFORE (clipped to slider position) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <div className="h-full" style={{ width: wrapRef.current?.offsetWidth || "100%" }}>
          <RoofScene variant="before" />
        </div>
        <span className="absolute left-3 top-3 rounded bg-black/50 px-2 py-1 text-xs font-bold text-white">
          BEFORE
        </span>
      </div>

      {/* Handle */}
      <div className="absolute inset-y-0 z-10 flex items-center" style={{ left: `calc(${pos}% - 18px)` }}>
        <div className="h-full w-1 bg-white/90 shadow" />
        <button
          className="absolute left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full bg-white text-brand-navy shadow-lg"
          aria-label="Drag to compare"
        >
          <MoveHorizontal size={18} />
        </button>
      </div>
    </div>
  );
}

function RoofScene({ variant }: { variant: "before" | "after" }) {
  const before = variant === "before";
  return (
    <svg viewBox="0 0 640 400" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      {/* sky */}
      <defs>
        <linearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={before ? "#8a97a3" : "#7fb2e5"} />
          <stop offset="100%" stopColor={before ? "#c3cad0" : "#dcecfb"} />
        </linearGradient>
      </defs>
      <rect width="640" height="400" fill={`url(#sky-${variant})`} />

      {/* house body */}
      <rect x="80" y="230" width="480" height="150" fill={before ? "#c9b79c" : "#efe6d6"} />
      {/* windows */}
      <rect x="140" y="270" width="70" height="70" fill={before ? "#6b7885" : "#9cc4e8"} stroke="#fff" strokeWidth="4" />
      <rect x="430" y="270" width="70" height="70" fill={before ? "#6b7885" : "#9cc4e8"} stroke="#fff" strokeWidth="4" />
      {/* door */}
      <rect x="290" y="285" width="60" height="95" fill={before ? "#5a4a3a" : "#7a4a2a"} />

      {/* roof */}
      <polygon
        points="60,230 320,90 580,230"
        fill={before ? "#5b5147" : "#374658"}
      />
      {/* shingle rows */}
      {Array.from({ length: 6 }).map((_, i) => {
        const y = 120 + i * 18;
        const spread = 20 + i * 42;
        return (
          <line
            key={i}
            x1={320 - spread}
            y1={y}
            x2={320 + spread}
            y2={y}
            stroke={before ? "#463f36" : "#26313f"}
            strokeWidth={before ? 3 : 2}
            strokeDasharray={before ? "10 6" : "0"}
          />
        );
      })}

      {/* weathering artifacts on the "before" */}
      {before && (
        <>
          <circle cx="250" cy="175" r="14" fill="#3f3a31" opacity="0.7" />
          <circle cx="380" cy="200" r="10" fill="#3f3a31" opacity="0.6" />
          <polygon points="300,150 315,150 308,168" fill="#8a97a3" />
          <rect x="200" y="205" width="26" height="6" fill="#2f2a24" />
        </>
      )}
      {/* clean ridge highlight on the "after" */}
      {!before && (
        <>
          <line x1="60" y1="230" x2="320" y2="90" stroke="#4d6178" strokeWidth="6" />
          <line x1="320" y1="90" x2="580" y2="230" stroke="#2b3746" strokeWidth="6" />
        </>
      )}

      {/* grass */}
      <rect x="0" y="380" width="640" height="20" fill={before ? "#6f7a53" : "#6aa84f"} />
    </svg>
  );
}
