"use client";

// Kanban-style lead pipeline. The row injected by the call simulation flashes
// on arrival and keeps a permanent "Simulated" badge.

import { Flame, PhoneIncoming } from "lucide-react";
import { STAGES, formatValue, type DemoLead } from "@/lib/demo";
import { useDemo } from "./DemoProvider";

function LeadCard({ lead, flashing }: { lead: DemoLead; flashing: boolean }) {
  return (
    <article
      className={[
        "rounded-xl border bg-white p-3 shadow-sm transition-shadow",
        flashing
          ? "animate-flash-in border-brand-accent"
          : "border-slate-200 hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold leading-tight text-brand-navy">{lead.name}</p>
        {lead.priority === "urgent" && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 ring-1 ring-red-200">
            <Flame className="h-3 w-3" aria-hidden />
            Urgent
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-500">{lead.address}</p>
      <p className="text-xs text-slate-500">{lead.phone}</p>

      <p className="mt-2 text-sm font-semibold text-brand-navy">
        {lead.service}
      </p>
      <p className="text-sm font-bold text-brand-accent">
        {formatValue(lead.value)}
      </p>

      {lead.notes && (
        <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-relaxed text-slate-600">
          {lead.notes}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
        {lead.capturedBy === "Maggie Mae" ? (
          <span className="flex items-center gap-1 rounded-full bg-brand-accent/10 px-2 py-0.5 font-bold text-brand-accentDark">
            <PhoneIncoming className="h-3 w-3" aria-hidden />
            Maggie Mae
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">
            {lead.capturedBy}
          </span>
        )}
        {lead.simulated && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold uppercase tracking-wide text-amber-700">
            Simulated
          </span>
        )}
        <span className="ml-auto">{lead.receivedLabel}</span>
      </div>
    </article>
  );
}

export default function LeadPipeline() {
  const { leads, flashLeadId } = useDemo();

  return (
    <section
      aria-labelledby="pipeline-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="pipeline-heading"
          className="text-lg font-extrabold tracking-tight text-brand-navy"
        >
          Lead Pipeline
        </h2>
        <p className="text-sm text-slate-500">
          {leads.length} active {leads.length === 1 ? "lead" : "leads"}
        </p>
      </div>

      {/* Horizontal scroll keeps all five stages usable on a laptop screen. */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.id);
          const stageValue = stageLeads.reduce((sum, l) => sum + l.value, 0);

          return (
            <div key={stage.id} className="w-64 shrink-0">
              <div className="mb-2 flex items-baseline justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2">
                <span className="text-sm font-bold text-brand-navy">
                  {stage.label}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {stageLeads.length}
                </span>
              </div>
              <p className="mb-2 px-1 text-xs font-semibold text-slate-400">
                {formatValue(stageValue)}
              </p>

              <div className="space-y-2">
                {stageLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    flashing={lead.id === flashLeadId}
                  />
                ))}
                {stageLeads.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    Empty
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
