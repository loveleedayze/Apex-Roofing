"use client";

// Top-of-dashboard KPI tiles. "Leads captured" counts live pipeline state, so
// it ticks up the moment a simulated call lands a new row.

import { formatValue } from "@/lib/demo";
import { useDemo } from "./DemoProvider";

export default function StatRow() {
  const { leads, callsHandled } = useDemo();

  const pipelineValue = leads
    .filter((l) => l.stage !== "won")
    .reduce((sum, l) => sum + l.value, 0);
  const urgentCount = leads.filter((l) => l.priority === "urgent").length;
  const maggieCaptured = leads.filter((l) => l.capturedBy === "Maggie Mae").length;

  const tiles = [
    { label: "Leads captured", value: String(leads.length), hint: "this week" },
    {
      label: "Booked by Maggie",
      value: String(maggieCaptured),
      hint: `${callsHandled} live call${callsHandled === 1 ? "" : "s"} today`,
      accent: true,
    },
    { label: "Open pipeline", value: formatValue(pipelineValue), hint: "excl. won" },
    { label: "Urgent / storm", value: String(urgentCount), hint: "needs same-day" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={[
            "rounded-2xl border bg-white p-4 shadow-sm",
            tile.accent ? "border-brand-accent/40" : "border-slate-200",
          ].join(" ")}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {tile.label}
          </p>
          <p
            className={[
              "mt-1 text-2xl font-extrabold tracking-tight",
              tile.accent ? "text-brand-accent" : "text-brand-navy",
            ].join(" ")}
          >
            {tile.value}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{tile.hint}</p>
        </div>
      ))}
    </div>
  );
}
