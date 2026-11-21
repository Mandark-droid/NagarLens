"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Pill, SourceBadge } from "@/components/bits";
import { api, DECISION_LABEL } from "@/lib/api";

// Recommended verdict (rule based, src/verdict.py) and the fair hearing (src/hearing.py: Claude or template).
// The officer still decides with the buttons below this panel. Owner: Harsh (docs/tasks/harsh.md).

const DECISION_TONE: Record<string, { color: string; bg: string }> = {
  release_payment: { color: "#1E5B1F", bg: "#E5F4E4" },
  hold_for_evidence: { color: "#9A3412", bg: "#FFEDD5" },
  return_under_warranty: { color: "#4338A0", bg: "#ECE9FB" },
};

export default function VerdictPanel({ findingId }: { findingId: string }) {
  const v = useQuery({ queryKey: ["verdict", findingId], queryFn: () => api(`/findings/${findingId}/verdict`) });
  const h = useQuery({ queryKey: ["hearing", findingId], queryFn: () => api(`/findings/${findingId}/hearing`) });
  if (v.error || h.error) {
    return <div className="mt-4 rounded-xl border border-[#E9A988] bg-[#FFF3EC] p-3 text-[13px] text-[#7A2A08]">Could not load the recommended verdict.</div>;
  }
  if (!v.data) return <div className="mt-4 animate-pulse rounded-xl border border-dashed border-[#D5D6D0] p-4 text-[13px] text-[#454952]">Loading recommendation…</div>;
  const rec = v.data.recommended;
  const tone = DECISION_TONE[rec.decision] ?? DECISION_TONE.hold_for_evidence;

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[#D5D6D0] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#454952]">Recommended verdict</span>
        <span className="rounded-full px-3 py-1 text-[13.5px] font-bold" style={{ color: tone.color, background: tone.bg }}>
          {DECISION_LABEL[rec.decision] ?? rec.decision}
        </span>
        <span className="text-[12px] text-[#454952]">Rule based · the officer decides below</span>
        <Link href={`/receipt?wo=${v.data.work_order_id}`} className="ml-auto text-[12.5px] font-semibold text-[#17306E] underline">
          Public repair receipt
        </Link>
      </div>
      <p className="text-[13.5px] text-[#16181D]">{rec.reason}</p>
      {rec.documents?.length ? (
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#454952]">Documents to request</div>
          <ul className="list-disc space-y-0.5 pl-5 text-[13px]">
            {rec.documents.map((d: string) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-[#EDEDE8] pt-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[13.5px] font-bold text-[#16181D]">Fair hearing</span>
          {h.data ? <SourceBadge source={h.data.source} /> : <Pill>Hearing both sides…</Pill>}
        </div>
        {h.data ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[#F3C9A8] bg-[#FFF8F1] p-3">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#9A3412]">Auditor</div>
                <ul className="list-disc space-y-1 pl-5 text-[13px]">{h.data.auditor.map((x: string) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div className="rounded-lg border border-[#BFDDBE] bg-[#F4FAF3] p-3">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#1E5B1F]">Fairness advocate</div>
                <ul className="list-disc space-y-1 pl-5 text-[13px]">{h.data.fairness_advocate.map((x: string) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-[#F6F6F3] p-3 text-[13px]"><b>Neutral summary:</b> {h.data.neutral_summary}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
