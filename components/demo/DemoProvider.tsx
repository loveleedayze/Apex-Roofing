"use client";

// ---------------------------------------------------------------------------
// Demo Mode — client-side state
// ---------------------------------------------------------------------------
// The single source of truth for the /demo dashboard. Every lead, transcript
// line, and status change lives in this reducer and dies with the tab: no
// fetches, no writes, nothing that touches the production CRM path in
// lib/crm.ts. Reload the page and you're back to the seed pipeline.
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  CALL_SCRIPT,
  CALL_SUMMARY,
  buildSimulatedLead,
  seedLeads,
  type CallSummary,
  type DemoBranding,
  type DemoLead,
  type TranscriptLine,
} from "@/lib/demo";

export type MaggieStatus = "online" | "on_call" | "wrapping";

/** How long the freshly-injected row keeps its flash highlight. */
const FLASH_MS = 2600;
/** Beat between the last spoken line and the lead landing in the pipeline. */
const WRAP_UP_MS = 1200;

interface DemoState {
  leads: DemoLead[];
  status: MaggieStatus;
  /** Lines revealed so far in the current/most recent call. */
  transcript: TranscriptLine[];
  summary: CallSummary | null;
  /** Row currently playing its flash animation. */
  flashLeadId: string | null;
  callsHandled: number;
}

type Action =
  | { type: "CALL_STARTED" }
  | { type: "LINE_APPENDED"; line: TranscriptLine }
  | { type: "WRAP_UP_STARTED" }
  | { type: "CALL_COMPLETED"; lead: DemoLead; summary: CallSummary }
  | { type: "FLASH_CLEARED" };

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "CALL_STARTED":
      return { ...state, status: "on_call", transcript: [], summary: null };
    case "LINE_APPENDED":
      return { ...state, transcript: [...state.transcript, action.line] };
    case "WRAP_UP_STARTED":
      return { ...state, status: "wrapping" };
    case "CALL_COMPLETED":
      return {
        ...state,
        status: "online",
        // Newest first so the injected row lands at the top of "New Leads".
        leads: [action.lead, ...state.leads],
        summary: action.summary,
        flashLeadId: action.lead.id,
        callsHandled: state.callsHandled + 1,
      };
    case "FLASH_CLEARED":
      return { ...state, flashLeadId: null };
    default:
      return state;
  }
}

interface DemoContextValue extends DemoState {
  branding: DemoBranding;
  /** No-op while a call is already in flight. */
  simulateCall: () => void;
  isCallActive: boolean;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}

export function DemoProvider({
  branding,
  children,
}: {
  branding: DemoBranding;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    leads: seedLeads(),
    status: "online" as MaggieStatus,
    transcript: [],
    summary: null,
    flashLeadId: null,
    callsHandled: 0,
  }));

  // A simulation is a chain of timers. Track them so an unmount mid-call can't
  // dispatch into a dead component, and so we never start two chains at once.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    // Must reset on (re)mount, not just set on unmount: React StrictMode runs
    // mount → cleanup → mount, so a cleanup-only flag would latch to `true`
    // and permanently disable the simulation.
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        timerRef.current = setTimeout(resolve, ms);
      }),
    []
  );

  const simulateCall = useCallback(async () => {
    if (runningRef.current || cancelledRef.current) return;
    runningRef.current = true;

    try {
      dispatch({ type: "CALL_STARTED" });

      for (const line of CALL_SCRIPT) {
        await wait(line.delayMs);
        if (cancelledRef.current) return;
        dispatch({ type: "LINE_APPENDED", line });
      }

      dispatch({ type: "WRAP_UP_STARTED" });
      await wait(WRAP_UP_MS);
      if (cancelledRef.current) return;

      dispatch({
        type: "CALL_COMPLETED",
        lead: buildSimulatedLead(),
        summary: CALL_SUMMARY,
      });

      await wait(FLASH_MS);
      if (cancelledRef.current) return;
      dispatch({ type: "FLASH_CLEARED" });
    } finally {
      runningRef.current = false;
    }
  }, [wait]);

  const value = useMemo<DemoContextValue>(
    () => ({
      ...state,
      branding,
      simulateCall,
      isCallActive: state.status !== "online",
    }),
    [state, branding, simulateCall]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
