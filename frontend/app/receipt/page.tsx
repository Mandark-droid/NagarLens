"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { DataBadge, ErrorBox, Loading, Pill } from "@/components/bits";
import { api } from "@/lib/api";
import { cleanName, inrFull, when } from "@/lib/format";

// Public Repair Receipt (stretch, docs/tasks/harsh.md), at /receipt?wo=<work order id>. Facts from GET /api/cases/{id} (organizer data);
// "Did this repair survive?" answers are new data (Synthetic, NagarLens) and never enter organizer totals.

function NagarLensBadge() {
  return <span className="inline-block whitespace-nowrap rounded-full bg-[#ECE9FB] px-2.5 py-0.5 text-[11px] font-bold text-[#4338A0]">Synthetic (NagarLens)</span>;
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Receipt />
    </Suspense>
  );
}

// /receipt?wo=WO25-02485 (a query parameter keeps the route static under cacheComponents)
function Receipt() {
  const id = useSearchParams().get("wo") ?? "";
  const qc = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const q = useQuery({ queryKey: ["case", id], queryFn: () => api(`/cases/${id}`), enabled: !!id });
  const fb = useQuery({ queryKey: ["receipt-feedback", id], queryFn: () => api(`/receipts/${id}/feedback`), enabled: !!id });
  const send = useMutation({
    mutationFn: (answer: string) => api(`/receipts/${id}/feedback`, { method: "POST", body: JSON.stringify({ answer, note }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipt-feedback", id] }),
  });

  if (!id) return <p className="text-[14px]">Open a receipt from an audit lead, e.g. /receipt?wo=WO25-02485.</p>;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const w = q.data.work_order;
  const c = q.data.complaints?.[0];
  const dlp = w.under_dlp === "Y";
  const rows: [string, React.ReactNode][] = [
    ["Road", `${w.road_name} (${w.road_id})`],
    ["Ward", w.ward_code],
    ["Contractor on the work order", cleanName(w.contractor_name)],
    ["Repair", `${w.work_type} · ${w.repair_method}`],
    ["Completed", when(w.completed_at, false)],
    ["Amount billed", inrFull(w.cost_inr)],
    ["Within SLA", w.sla_met === "Y" ? "Yes" : "No"],
    ["Re-opened within 30 days", w.reopened_within_30d === "Y" ? "Yes" : "No"],
    ["Warranty (DLP)", dlp ? "Road is under its Defect Liability Period" : "Not under DLP"],
  ];

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[#16181D]">Public repair receipt</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#454952]">
          <span className="font-mono">{w.work_order_id}</span>
          <DataBadge />
        </div>
      </div>

      <div className="rounded-2xl border border-[#D5D6D0] bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#454952]">Complaint</div>
        {c ? (
          <>
            <p className="mt-1 text-[14px]">{c.description}</p>
            <p className="mt-1 text-[12px] text-[#454952]">{c.complaint_id} · {when(c.received_at, false)} · {c.language} · {c.upvotes} upvotes</p>
          </>
        ) : (
          <p className="mt-1 text-[14px]">No citizen complaint is linked to this work order.</p>
        )}
      </div>

      <dl className="divide-y divide-[#EDEDE8] rounded-2xl border border-[#D5D6D0] bg-white px-4 text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-[#454952]">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {q.data.findings?.length ? (
        <div className="flex flex-wrap gap-2">{q.data.findings.map((f: any) => <Pill key={f.finding_id}>Needs review: {f.rule}</Pill>)}</div>
      ) : null}

      <div className="rounded-2xl border border-[#D5D6D0] bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold">Did this repair survive?</h2>
          <NagarLensBadge />
        </div>
        {send.data ? (
          <div className="rounded-lg bg-[#ECE9FB] p-3 text-[13.5px] text-[#2E2580]">
            {send.data.message}
            <button className="mt-2 block text-[12.5px] underline" onClick={() => { send.reset(); setFailed(false); setNote(""); }}>Answer again</button>
          </div>
        ) : (
          <div className="grid gap-2">
            <button onClick={() => send.mutate("survived")} disabled={send.isPending}
              className="min-h-11 rounded-lg border border-[#BFDDBE] bg-[#F4FAF3] px-4 text-left text-[14px] font-semibold text-[#1E5B1F]">Yes, it is holding up</button>
            <button onClick={() => setFailed(true)} disabled={send.isPending} aria-expanded={failed}
              className="min-h-11 rounded-lg border border-[#E6C27A] bg-[#FBF3E1] px-4 text-left text-[14px] font-semibold text-[#8A5A00]">No, the problem returned</button>
            <button onClick={() => send.mutate("unsure")} disabled={send.isPending}
              className="min-h-11 rounded-lg border border-[#D5D6D0] bg-white px-4 text-left text-[14px] font-semibold">Not sure</button>
            {failed ? (
              <div className="space-y-2 rounded-lg bg-[#F6F6F3] p-3">
                <label className="block text-[12.5px] font-semibold text-[#454952]">
                  What do you see? (optional)
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
                    className="mt-1 block min-h-10 w-full rounded-lg border border-[#D5D6D0] bg-white px-3 text-[14px] font-normal" />
                </label>
                <button onClick={() => send.mutate("failed")} disabled={send.isPending}
                  className="min-h-11 w-full rounded-lg bg-[#16181D] px-4 text-[14px] font-semibold text-white">Send report</button>
                {dlp ? <p className="text-[12px] text-[#454952]">This road is under warranty, so a failed repair is recorded as a warranty case at ₹0 to BMC.</p> : null}
              </div>
            ) : null}
          </div>
        )}
        {fb.data ? (
          <p className="mt-3 text-[12px] text-[#454952]">
            Citizen answers so far: {fb.data.survived} holding · {fb.data.failed} returned · {fb.data.unsure} not sure
            {fb.data.warranty_cases?.length ? ` · warranty cases: ${fb.data.warranty_cases.join(", ")}` : ""}
          </p>
        ) : null}
      </div>
      <p className="text-[11.5px] text-[#454952]">
        A review is a routine check of records, not a finding of wrongdoing. Amounts are billed amounts; the dataset has no payment records.
      </p>
    </div>
  );
}
