"use client";

// Dashboard chrome: sidebar, topbar, and the persistent demo disclosure.
// Nav items are inert by design — this is a walkthrough prop, not an app.

import {
  BarChart3,
  CalendarDays,
  FileText,
  Hammer,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { DEMO_DISCLOSURE } from "@/lib/demo";
import { useDemo } from "./DemoProvider";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Leads", icon: Users, active: false },
  { label: "Jobs", icon: Hammer, active: false },
  { label: "Estimates", icon: FileText, active: false },
  { label: "Schedule", icon: CalendarDays, active: false },
  { label: "Reports", icon: BarChart3, active: false },
  { label: "Settings", icon: Settings, active: false },
];

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { branding } = useDemo();

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Disclosure bar — stays put so a fabricated pipeline can never be
          mistaken for the prospect's real account data. */}
      <div className="bg-brand-navy px-4 py-2 text-center text-xs font-semibold tracking-wide text-amber-300">
        {DEMO_DISCLOSURE}
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col bg-brand-navy px-4 py-6 md:flex">
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-accent font-extrabold text-white">
              {branding.monogram}
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight text-white">
                {branding.businessName}
              </p>
              <p className="truncate text-xs text-white/50">{branding.city}</p>
            </div>
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {NAV.map(({ label, icon: Icon, active }) => (
              <span
                key={label}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/5",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </span>
            ))}
          </nav>

          <div className="mt-auto rounded-lg bg-white/5 p-3 text-xs text-white/60">
            <p className="font-semibold text-white/80">Maggie Mae</p>
            <p className="mt-1 leading-relaxed">
              Answering every call for {branding.businessName}, 24/7.
            </p>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight text-brand-navy">
                Welcome back, {branding.contractorName}
              </h1>
              <p className="truncate text-sm text-slate-500">
                Here&apos;s what Maggie Mae has been handling for{" "}
                {branding.businessName}.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {branding.city}
              </span>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-steel text-sm font-bold text-white">
                {branding.contractorName.slice(0, 1).toUpperCase()}
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
