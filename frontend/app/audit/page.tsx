"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DataBadge, ErrorBox, Kpi, Loading, PageTitle, Pill, Section } from "@/components/bits";
import VerdictPanel from "@/components/verdict-panel";
import { api, DECISION_LABEL, qs, RULE_COLOR } from "@/lib/api";
import { cleanName, inr, inrFull, when } from "@/lib/format";

import { useWard } from "../providers";

const FLAG_RULES = ["dlp_paid_by_bmc", "overbilled_vs_rate_card", "duplicate_bill"];

export default function AuditPage() {
  const { ward } = useWard();
  const [onlyWard, setOnlyWard] = useState(true);
  const [rule, setRule] = useState<string>("");
  const [picked, setPicked] = useState<string | null>(null);
  const city = useQuery({ queryKey: ["overview"], queryFn: () => api("/overview") });
  const wardSum = useQuery({ queryKey: ["findings-ward-summary", ward], queryFn: () => api(`/findings${qs({ ward, limit: 1 })}`) });
  const list = useQuery({
    queryKey: ["findings", onlyWard ? ward : "", rule],
    queryFn: () => api(`/findings${qs({ ward: onlyWard ? ward : undefined, rule: rule || undefined, limit: 300 })}`),
  });
  if (list.error) return <ErrorBox error={list.error} />;
  if (!list.data || !city.data) return <Loading />;
  const rows = list.data.rows as any[];
  const current = picked ?? rows[0]?.finding_id ?? null;

  return (
    <div className="space-y-5">
      <PageTitle
        title={`${inr(city.data.review.total_at_risk_inr)} of ${inr(city.data.billed_inr)} billed needs a second look`}
        sub="Three deterministic rules. A job caught by two rules counts once. These are leads for review, not findings of wrongdoing."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {((onlyWard ? wardSum.data?.review?.by_rule : null) ?? city.data.review.by_rule).map((r: any) => (
          <Kpi key={r.rule_id} label={r.label} value={inr(r.at_risk_inr)} sub={`${r.jobs} jobs ${onlyWard && wardSum.data ? `in ward ${ward}` : "city-wide"}`} tone={RULE_COLOR[r.rule_id]} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <label className="flex items-center gap-1.5 font-semibold">
          <input type="checkbox" checked={onlyWard} onChange={(e) => { setOnlyWard(e.target.checked); setPicked(null); }} /> Only ward {ward}
        </label>
        {["", ...FLAG_RULES].map((r) => (
          <button key={r} onClick={() => { setRule(r); setPicked(null); }}
            className={`min-h-10 rounded-full border px-3 py-1.5 font-semibold ${rule === r ? "border-[#1E4FD8] bg-[#E3EBFD] text-[#17306E]" : "border-[#D5D6D0] bg-white"}`}>
            {r ? <span aria-hidden className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: RULE_COLOR[r] }} /> : null}
            {r ? list.data.rules.find((x: any) => x.rule_id === r)?.label : "All rules"}
          </button>
        ))}
        <span className="ml-auto text-[#454952]">{list.data.total} leads · {inr(list.data.review.total_at_risk_inr)} to review</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Section title="Leads" hint="Largest amount first. Click one to see its evidence.">
            <div className="space-y-1.5 pr-1 lg:max-h-[620px] lg:overflow-auto">
              {rows.map((f) => (
                <button key={f.finding_id} onClick={() => { setPicked(f.finding_id); if (window.innerWidth < 1024) setTimeout(() => document.getElementById("evidence")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-[13px] ${current === f.finding_id ? "border-[#1E4FD8] bg-[#F3F6FE]" : "border-[#EDEDE8] bg-white hover:border-[#B9BDC6]"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold" style={{ color: rule ? "#16181D" : RULE_COLOR[f.rule_id] }}>{rule ? f.work_order_id : f.rule}</span>
                    <span className="whitespace-nowrap font-bold">{inr(f.amount_at_risk_inr)}</span>
                  </div>
                  <div className="text-[#454952]">{f.work_order_id} · ward {f.ward_code} · {f.contractor}{f.borderline ? " · borderline" : ""}</div>
                </button>
              ))}
              {rows.length === 0 ? <div className="text-sm text-[#454952]">No leads for this filter.</div> : null}
            </div>
          </Section>
        </div>
        <div id="evidence" className="scroll-mt-4 lg:col-span-3">{current ? <Evidence id={current} /> : <Loading label="Pick a lead" />}</div>
      </div>
    </div>
  );
}

function Evidence({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["finding", id], queryFn: () => api(`/findings/${id}`) });
  const [note, setNote] = useState("");
  const [confirmRelease, setConfirmRelease] = useState(false);
  const decide = useMutation({
    mutationFn: (decision: string) => api(`/findings/${id}/review`, { method: "PUT", body: JSON.stringify({ decision, note }) }),
    onSuccess: () => { setConfirmRelease(false); qc.invalidateQueries({ queryKey: ["finding", id] }); },
  });
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const f = q.data.finding, e = q.data.evidence, color = RULE_COLOR[f.rule_id] ?? "#8A8F98";

  return (
    <Section title={`${f.rule} · ${f.work_order_id}`} hint={`${f.finding_id} · ward ${f.ward_code} · ${f.contractor}`}
      right={<div className="text-right"><div className="text-[11px] font-bold uppercase text-[#454952]">To review</div><div className="whitespace-nowrap text-[24px] font-extrabold" style={{ color }}>{inr(f.amount_at_risk_inr)}</div></div>}>
      <div className="mb-3 flex gap-2"><Pill>Needs review</Pill><DataBadge /></div>

      {f.rule_id === "duplicate_bill" && e.twin ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <Bill title="The matching bill" tone="#1E7B34" w={e.twin} same={e.match.same} />
          <div className="self-center text-center text-[12px] text-[#454952]">
            <div className="text-[22px] font-extrabold text-[#16181D]">{e.match.days_apart} d</div>apart
            <div className="mt-2 text-[22px] font-extrabold text-[#16181D]">{(e.match.cost_difference * 100).toFixed(1)}%</div>cost difference
          </div>
          <Bill title="This bill (flagged)" tone="#C2410C" w={e.work_order} same={e.match.same} />
        </div>
      ) : null}

      {f.rule_id === "overbilled_vs_rate_card" && e.rate_card ? (
        <div>
          {[["Rate card cost", e.rate_card.expected_cost_inr, "#8A8F98", "1.00×"], ["Upper end of normal", e.rate_card.tolerance_inr, "#B9BDC6", "1.30×"], ["Billed", e.rate_card.billed_inr, "#C2410C", `${e.rate_card.cost_ratio}×`]].map(([label, v, c, note]: any) => (
            <div key={label} className="my-1.5 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-[13px] md:grid-cols-[150px_1fr_120px]">
              <span className="text-[#454952]">{label}</span>
              <div className="order-3 col-span-2 h-5 rounded bg-[#EFEFEA] md:order-none md:col-span-1"><div className="h-5 rounded" style={{ width: `${Math.max(2, (100 * v) / e.rate_card.billed_inr)}%`, background: c }} /></div>
              <span className="text-right font-bold">{inrFull(v)} <span className="font-normal text-[#454952]">{note}</span></span>
            </div>
          ))}
          <p className="mt-1 text-[12.5px] text-[#454952]">{e.rate_card.basis}. Normal jobs fall between 0.75× and 1.3×; amount to review = billed minus the upper end of normal.</p>
          {f.borderline ? <p className="mt-2 rounded-lg border border-[#E8CF8A] bg-[#FFF8E6] px-3 py-2 text-[13px]"><b>Borderline.</b> Only just above the 1.4× line and below the main group of outliers. Check the measurement book first; this may be normal variation.</p> : null}
        </div>
      ) : null}

      {f.rule_id === "dlp_paid_by_bmc" && e.road ? (
        <div className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-4">
          <Cell label="Road" value={`${e.road.road_name} (${e.road.road_id})`} />
          <Cell label="Last resurfaced" value={when(e.road.last_resurfaced, false)} />
          <Cell label="Warranty (DLP)" value={e.road.under_dlp === "Y" ? "Still under warranty" : "Expired"} />
          <Cell label="This job" value={`${e.work_order.work_type}`} />
          <Cell label="Billed to BMC" value={inrFull(e.work_order.cost_inr)} />
          <Cell label="Jobs on this road" value={`${e.road.jobs_this_monsoon} · ${inr(e.road.billed_this_monsoon_inr)}`} />
          <div className="col-span-2">
            <Pill color={f.dlp_scope === "surface" ? "#3A2E8C" : "#7A4B00"} bg={f.dlp_scope === "surface" ? "#EFEDFF" : "#F9EEDA"}>
              {f.dlp_scope === "surface" ? "Surface defect: inside a resurfacing warranty" : "Drainage / manhole work: verify the warranty scope"}
            </Pill>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 border-t border-[#EDEDE8] pt-3 text-[13px] md:grid-cols-3">
        <Cell label="Why it was flagged" value={f.reason} plain />
        <Cell label="Fair context" value={f.fair_context} plain />
        <Cell label="Next action" value={f.review_action} />
      </div>

      <VerdictPanel findingId={id} />

      {/* Officer decision. Stored in SQLite via PUT /api/findings/{id}/review. See docs/tasks/harsh.md. */}
      <div className="mt-4 rounded-xl bg-[#F6F6F3] p-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#454952]">Officer decision (a human decides; the audit only raises the lead)</div>
        <div className="flex flex-wrap gap-2">
          {q.data.decisions.map((d: string) => (
            <button key={d} onClick={() => (d === "release_payment" && !confirmRelease ? setConfirmRelease(true) : decide.mutate(d))} disabled={decide.isPending}
              className={`min-h-11 rounded-lg border px-4 py-2 text-[13.5px] font-semibold ${q.data.review?.decision === d ? "border-[#16181D] bg-[#16181D] text-white" : "border-[#D5D6D0] bg-white hover:border-[#16181D]"}`}>
              {d === "release_payment" && confirmRelease ? "Confirm: release payment" : DECISION_LABEL[d] ?? d}
            </button>
          ))}
          {q.data.review ? <span className="self-center text-[12px] text-[#454952]">saved {when(q.data.review.decided_at)}</span> : null}
        </div>
        <label className="mt-2 block text-[12px] font-semibold text-[#454952]">
          Reason (optional, saved with the decision)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
            className="mt-1 block min-h-10 w-full rounded-lg border border-[#D5D6D0] bg-white px-3 text-[13.5px] font-normal text-[#16181D]" />
        </label>
      </div>
      <p className="mt-2 text-[11.5px] text-[#454952]">Evidence: {String(f.evidence_ids).split("|").join(" · ")} · billed amounts from work_orders.csv</p>
    </Section>
  );
}

function Cell({ label, value, plain }: { label: string; value: any; plain?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#454952]">{label}</div>
      <div className={plain ? "" : "font-semibold"}>{value}</div>
    </div>
  );
}

function Bill({ title, tone, w, same }: { title: string; tone: string; w: any; same: Record<string, boolean> }) {
  const row = (label: string, value: any, key?: string) => (
    <div className="flex justify-between gap-3 border-b border-dashed border-[#EDEDE8] py-1 text-[13px]">
      <span className="text-[#454952]">{label}</span>
      <span className="text-right font-semibold">{value}{key && same[key] ? <span className="font-extrabold text-[#C2410C]" title="same in both bills"> =</span> : null}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-[#D5D6D0] p-3" style={{ borderTop: `5px solid ${tone}` }}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#454952]">{title}</div>
      <div className="text-[16px] font-extrabold">{w.work_order_id}</div>
      <div className="mb-1 text-[13px] font-bold" style={{ color: w.n_linked_complaints ? "#1E7B34" : "#C2410C" }}>
        {w.n_linked_complaints ? `${w.n_linked_complaints} citizen complaint(s) linked` : "No complaint linked"}
      </div>
      {row("Road", `${w.road_name} (${w.road_id})`, "road_id")}
      {row("Work type", w.work_type, "work_type")}
      {row("Method", w.repair_method, "repair_method")}
      {row("Contractor", cleanName(w.contractor_name), "contractor_id")}
      {row("Area", `${w.area_sqm} sqm`, "area_sqm")}
      {row("Assigned", when(w.assigned_at))}
      <div className="flex justify-between pt-2"><span className="text-[13px] text-[#454952]">Billed</span><span className="text-[20px] font-extrabold">{inrFull(w.cost_inr)}</span></div>
    </div>
  );
}
