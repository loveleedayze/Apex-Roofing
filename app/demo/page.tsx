import type { Metadata } from "next";
import { DemoProvider } from "@/components/demo/DemoProvider";
import DashboardShell from "@/components/demo/DashboardShell";
import MaggieStatusPanel from "@/components/demo/MaggieStatusPanel";
import LeadPipeline from "@/components/demo/LeadPipeline";
import StatRow from "@/components/demo/StatRow";
import { resolveBranding } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Demo Dashboard",
  // A personalized prospecting link should never be indexed.
  robots: { index: false, follow: false },
};

/**
 * Simulated onboarding / walkthrough dashboard.
 *
 * Personalize by appending tracking params to the link you send a prospect:
 *   /demo?contractor_name=John&business_name=Apex%20Roofing&city=Austin,%20TX
 *
 * Branding is resolved server-side and handed to a client provider; every
 * lead and call the page produces stays in React state.
 */
export default function DemoPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const branding = resolveBranding(searchParams);

  return (
    <DemoProvider branding={branding}>
      <DashboardShell>
        <div className="space-y-5">
          <StatRow />
          <MaggieStatusPanel />
          <LeadPipeline />
        </div>
      </DashboardShell>
    </DemoProvider>
  );
}
