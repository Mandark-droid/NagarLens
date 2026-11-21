"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { DataBadge, ErrorBox, Loading, PageTitle, Pill, Section, SourceBadge } from "@/components/bits";
import { api, qs, RULE_COLOR } from "@/lib/api";
import { cleanName, inr, inrFull, pct, when } from "@/lib/format";

import { useWard } from "../providers";

// Follow one case: complaint(s) -> work order -> repair -> bill vs rate card -> did it hold -> audit leads.
// Every number comes from GET /api/cases/{id}; the verdict text from GET /api/cases/{id}/verdict.

const TONE: Record<string, string> = { ok: "#1E7B34", warn: "#8A5A00", flag: "#C2410C", na: "#8A8F98" };

export default function CasePage() {
  const { ward } = useWard();
  const [picked, setPicked] = useState<string | null>(null);
  // /case?wo=WO25-00020 opens that work order (used by the road history page)
  const fromUrl = useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get("wo"), () => null);
  const presets = useQuery({ queryKey: ["case-presets"], queryFn: () => api<any[]>("/cases/presets") });
  const inWard = useQuery({ queryKey: ["cases", ward], queryFn: () => api(`/cases${qs({ ward, limit: 100 })}`) });
  const id = picked ?? fromUrl ?? presets.data?.[0]?.work_order_id ?? null;
  const q = useQuery({ queryKey: ["case", id], queryFn: () => api(`/cases/${id}`), enabled: !!id });
  const verdict = useQuery({ queryKey: ["case-verdict", id], queryFn: () => api(`/cases/${id}/verdict`), enabled: !!id });

  if (presets.error) return <ErrorBox error={presets.error} />;

  return (
    <div className="space-y-5">
      <PageTitle title="Follow one rupee: from complaint to fix to verdict" sub="Pick a case. Every step shows the record behind it; billed amounts are from work orders, not payments." />

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {(presets.data ?? []).map((p: any) => (
          <button key={p.work_order_id} onClick={() => setPicked(p.work_order_id)}
            className={`min-h-10 rounded-full border px-3 py-1.5 font-semibold ${id === p.work_order_id ? "border-[#1E4FD8] bg-[#E3EBFD] text-[#17306E]" : "border-[#D5D6D0] bg-white"}`}>
            {p.label} <span className="font-normal text-[#454952]">· {p.place}</span>
          </button>
        ))}
        <label className="flex w-full flex-col items-start gap-1.5 font-semibold md:ml-auto md:w-auto md:flex-row md:items-center">
          Any work order in ward {ward}
          <select aria-label="Work order" value={inWard.data?.rows?.some((r: any) => r.work_order_id === id) ? id ?? "" : ""}
            onChange={(e) => e.target.value && setPicked(e.target.value)}
            className="min-h-10 w-full max-w-full rounded-lg border border-[#D5D6D0] bg-white px-2 py-1 font-normal md:max-w-[340px]">
            <option value="">Choose…</option>
            {(inWard.data?.rows ?? []).map((r: any) => (
              <option key={r.work_order_id} value={r.work_order_id}>
                {r.work_order_id} · {r.road_name} · {inr(r.cost_inr)}{r.flagged ? " · needs review" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {q.error ? <ErrorBox error={q.error} /> : !q.data ? <Loading label="Loading the case…" /> : <CaseView d={q.data} verdict={verdict.data} verdictLoading={verdict.isLoading} />}
    </div>
  );
}

function CaseView({ d, verdict, verdictLoading }: { d: any; verdict: any; verdictLoading: boolean }) {
  const w = d.work_order, cc = d.complaints as any[], t = d.timeline, bill = d.bill, out = d.outcome, leads = d.findings as any[];
  const channels = Array.from(new Set(cc.map((c) => c.channel))).slice(0, 2).join(", ");
  const later = out.repeat_jobs_within_30d.length;
  const onTime = w.sla_met === "Y";

  const steps: [string, string, string, string][] = [
    ["1 · Reported", cc.length ? `${cc.length} complaint${cc.length === 1 ? "" : "s"}` : "No complaint",
      cc.length ? channels : "work order raised without a citizen complaint", cc.length ? "ok" : "flag"],
    ["2 · Assigned", cleanName(w.contractor_name), `${when(w.assigned_at)} · SLA ${w.sla_hours} h`, "ok"],
    ["3 · Repaired", onTime ? "On time" : "Late", `done ${when(w.completed_at, false)} · ${Math.round(w.hours_to_complete)} h after assignment`, onTime ? "ok" : "warn"],
    ["4 · Billed", inrFull(bill.billed_inr), `${bill.cost_ratio}× the rate card`, bill.flagged ? "flag" : "ok"],
    ["5 · Did it hold?", out.held_30_days ? "Held 30 days" : "Failed within 30 days",
      out.held_30_days ? "no re-open recorded" : `re-opened within 30 days · ${later} later job${later === 1 ? "" : "s"} on this road`, out.held_30_days ? "ok" : "warn"],
    ["6 · Audit", leads.length ? `${leads.length} review lead${leads.length === 1 ? "" : "s"}` : "No flags",
      leads.length ? leads.map((f) => f.rule).join(", ") : "within normal range", leads.length ? "flag" : "ok"],
  ];

  const download = () => {
    const md = [
      `# Case file ${w.work_order_id}`, "",
      `${w.road_name} (${w.road_id}) · ward ${w.ward_code} · ${w.work_type} · ${w.repair_method}`,
      `Contractor: ${cleanName(w.contractor_name)} · billed ${inrFull(bill.billed_inr)} (${bill.cost_ratio}× the rate card; ${bill.basis})`, "",
      "## Verdict and next action", verdict?.text ?? "(not available)", "",
      "## Complaints behind this job",
      ...(cc.length ? cc.map((c) => `- ${c.complaint_id} (${c.channel}, ${when(c.received_at)}, ${c.status}): ${c.description}`) : ["- none linked"]), "",
      "## Audit leads (for review, not findings of wrongdoing)",
      ...(leads.length ? leads.map((f) => `- ${f.rule}: ${f.reason} Fair context: ${f.fair_context} Next: ${f.review_action} (to review ${inrFull(f.amount_at_risk_inr)})`) : ["- none"]), "",
      "Source: organizer's synthetic dataset. All contractors are fictional.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `case_${w.work_order_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-[20px] font-extrabold">{w.work_order_id}</span>
        <span className="text-[#454952]">{w.road_name} ({w.road_id}) · ward {w.ward_code} · {w.work_type} · {w.repair_method}</span>
        <DataBadge />
        <button onClick={download} className="ml-auto rounded-lg border border-[#D5D6D0] bg-white px-3 py-1.5 font-semibold hover:border-[#16181D]">⬇ Download case file</button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {steps.map(([n, title, sub, tone]) => (
          <div key={n} className="rounded-xl border border-[#D5D6D0] bg-white px-3 py-2.5" style={{ borderTop: `6px solid ${TONE[tone]}` }}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#454952]">{n}</div>
            <div className="mt-0.5 text-[15px] font-bold leading-snug">{title}</div>
            <div className="mt-0.5 text-[12px] text-[#2A2D33]">{sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#A9BEF0] bg-[#EEF3FD] p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[13px] font-bold">Verdict and next action</span>
          {verdict ? <SourceBadge source={verdict.source} /> : null}
        </div>
        <p className="text-[14.5px] leading-relaxed">{verdict?.text ?? (verdictLoading ? "Writing the verdict…" : "Verdict not available; the records below stand on their own.")}</p>
      </div>

      {leads.map((f) => (
        <div key={f.finding_id} className="rounded-xl border border-[#E9A988] bg-[#FFF3EC] px-4 py-3 text-[13.5px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><b style={{ color: RULE_COLOR[f.rule_id] ?? "#C2410C" }}>{f.rule}</b> <Pill>Needs review</Pill></span>
            <span>to review <b>{inrFull(f.amount_at_risk_inr)}</b></span>
          </div>
          <div className="mt-1">{f.reason}</div>
          <div><i>Fair context:</i> {f.fair_context}</div>
          <div><b>Next:</b> {f.review_action}</div>
        </div>
      ))}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="When: the SLA clock" hint={`The clock starts at the ${t.sla_clock_starts}.`}>
          <SlaClock t={t} slaHours={w.sla_hours} onTime={onTime} />
        </Section>
        <Section title="How much: bill against the rate card" hint="Normal jobs fall between 0.75× and 1.3× of the rate-card cost.">
          {([["Rate card cost", bill.expected_cost_inr, "#8A8F98", "1.00×"], ["Upper end of normal", bill.upper_normal_inr, "#B9BDC6", "1.30×"],
            ["Billed", bill.billed_inr, bill.flagged ? "#C2410C" : "#1E7B34", `${bill.cost_ratio}×`]] as [string, number, string, string][]).map(([label, v, c, note]) => (
            <div key={label} className="my-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-[13px] md:grid-cols-[140px_1fr_130px]">
              <span className="text-[#454952]">{label}</span>
              <div className="order-3 col-span-2 h-5 rounded bg-[#EFEFEA] md:order-none md:col-span-1"><div className="h-5 rounded" style={{ width: `${Math.max(2, (100 * v) / Math.max(bill.billed_inr, bill.upper_normal_inr))}%`, background: c }} /></div>
              <span className="text-right font-bold">{inrFull(v)} <span className="font-normal text-[#454952]">{note}</span></span>
            </div>
          ))}
          <p className="mt-2 text-[12.5px] text-[#454952]">{w.repair_method}: {bill.basis}. {bill.flagged ? "Above the 1.4× review line." : "Inside the normal range for the review rule."}</p>
        </Section>
      </div>

      <Section title="Complaints behind this job" hint={cc.length ? "Linked by complaint id (exact match)." : "No complaint is linked to this work order."}>
        {cc.length ? (
          <div className="space-y-1.5">
            {cc.map((c) => (
              <div key={c.complaint_id} className="rounded-lg border border-[#EDEDE8] px-3 py-2 text-[13px]">
                <div className="flex flex-wrap gap-x-3 text-[12px] text-[#454952]">
                  <b className="text-[#16181D]">{c.complaint_id}</b><span>{c.channel}</span><span>{c.language}</span><span>{when(c.received_at)}</span>
                  <span className="ml-auto font-semibold">{c.status}</span>
                </div>
                <div className="mt-0.5">{c.description}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-[13px] text-[#454952]">This work order was raised without a citizen complaint.</div>}
      </Section>

      <Section title="Every repair on this road this monsoon"
        hint={`${d.road.road_name} (${d.road.road_id}) · ${d.road_history_total.jobs} jobs · ${inr(d.road_history_total.billed_inr)} billed · ${d.road_history_total.reopened} re-opened within 30 days`}
        right={d.road.under_dlp === "Y"
          ? <Pill color="#3A2E8C" bg="#EFEDFF">Under warranty · resurfaced {when(d.road.last_resurfaced, false)}</Pill>
          : <Pill>Warranty expired · resurfaced {when(d.road.last_resurfaced, false)}</Pill>}>
        <Link href={`/roads/${d.road.road_id}`} className="mb-2 inline-block text-[13px] font-semibold text-[#1E4FD8] hover:underline">Open the full road history →</Link>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-[#454952]">
              <tr><th className="py-1">Assigned</th><th>Work order</th><th>Work type</th><th>Method</th><th>Contractor</th><th className="text-right">Billed</th><th className="pl-3">Outcome</th><th>Leads</th></tr>
            </thead>
            <tbody>
              {(d.road_history as any[]).map((h) => (
                <tr key={h.work_order_id} className={`border-t border-[#EDEDE8] ${h.is_this_case ? "bg-[#F3F6FE] font-semibold" : ""}`}>
                  <td className="py-1.5">{when(h.assigned_at, false)}</td>
                  <td>{h.work_order_id}{h.is_this_case ? " ◀ this case" : ""}</td>
                  <td>{h.work_type}</td><td>{h.repair_method}</td><td>{h.contractor}</td>
                  <td className="text-right">{inrFull(h.cost_inr)}</td>
                  <td className="pl-3" style={{ color: h.reopened_within_30d === "Y" ? "#8A5A00" : "#1E7B34" }}>{h.reopened_within_30d === "Y" ? "Failed in 30 days" : "Held"}</td>
                  <td className="text-[#C2410C]">{h.flags.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function SlaClock({ t, slaHours, onTime }: { t: any; slaHours: number; onTime: boolean }) {
  const ms = (s: string | null) => (s ? new Date(s).getTime() : null);
  const first = ms(t.first_complaint_at), assigned = ms(t.assigned_at)!, started = ms(t.work_started_at)!, done = ms(t.completed_at)!, deadline = ms(t.sla_deadline)!;
  const pts = [first, assigned, started, done, deadline].filter((v): v is number => v !== null);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = Math.max(hi - lo, 1);
  const pos = (v: number) => ((v - lo) / span) * 100;
  const seg = (a: number, b: number) => ({ left: `${pos(Math.min(a, b))}%`, width: `${Math.max(Math.abs(pos(b) - pos(a)), 0.6)}%` });
  const rows: [string, number, number, string][] = [
    ...(first !== null ? [["Complaint → assigned", first, assigned, "#9DB4EE"] as [string, number, number, string]] : []),
    ["Assigned → work started", assigned, started, "#5C82E6"],
    ["Work started → completed", started, done, "#1E4FD8"],
  ];
  return (
    <div>
      <div className="relative pb-6 pt-5">
        <div className="absolute bottom-6 top-0 border-l-2 border-dashed border-[#C2410C]" style={{ left: `calc(170px + (100% - 170px) * ${pos(deadline) / 100})` }}>
          <span className="absolute -top-0.5 left-1.5 whitespace-nowrap text-[11px] font-semibold text-[#C2410C]" style={pos(deadline) > 70 ? { left: "auto", right: 6 } : undefined}>
            SLA deadline ({slaHours} h)
          </span>
        </div>
        {rows.map(([label, a, b, color]) => (
          <div key={label} className="my-2 grid grid-cols-[170px_1fr] items-center text-[12.5px]">
            <span className="pr-2 text-[#454952]">{label}</span>
            <div className="relative h-6 rounded bg-[#F1F1EC]"><div className="absolute h-6 rounded" style={{ ...seg(a, b), background: color }} /></div>
          </div>
        ))}
        <div className="absolute bottom-0 left-[170px] right-0 flex justify-between text-[11px] text-[#454952]">
          <span>{when(new Date(lo).toISOString())}</span><span>{when(new Date(hi).toISOString())}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[12.5px] md:grid-cols-4">
        <Stamp label="First complaint" value={t.first_complaint_at ? when(t.first_complaint_at) : "none linked"} />
        <Stamp label="Assigned" value={when(t.assigned_at)} />
        <Stamp label="Completed" value={when(t.completed_at)} />
        <Stamp label="SLA deadline" value={when(t.sla_deadline)} tone={onTime ? "#1E7B34" : "#8A5A00"} sub={onTime ? "met" : "missed"} />
      </div>
      {t.hours_first_complaint_to_done !== null ? (
        <p className="mt-2 text-[12.5px] text-[#454952]">First complaint to completion: <b className="text-[#16181D]">{t.hours_first_complaint_to_done} h</b> against a {slaHours} h target ({pct(t.hours_first_complaint_to_done / slaHours)} of the SLA).</p>
      ) : null}
      {t.assigned_before_first_complaint ? (
        <p className="mt-1 rounded-lg border border-[#E8CF8A] bg-[#FFF8E6] px-3 py-1.5 text-[12.5px]">Note: this job was assigned before the first linked complaint was logged, so the first bar runs backwards in time. That happens for 284 work orders in the dataset and is not treated as a lead.</p>
      ) : null}
    </div>
  );
}

function Stamp({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-[#F6F6F3] px-2.5 py-1.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#454952]">{label}</div>
      <div className="font-semibold">{value}</div>
      {sub ? <div className="text-[11.5px] font-bold" style={{ color: tone }}>{sub}</div> : null}
    </div>
  );
}
