"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownUp, HardHat, ListChecks, ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";

import StrategyCompare from "@/components/strategy-compare";

import { DataBadge, ErrorBox, Kpi, Loading, PageTitle, Pill, Section } from "@/components/bits";
import { api, qs, wardPath } from "@/lib/api";
import { inr, inrFull } from "@/lib/format";

import { useWard } from "../providers";

const WEIGHTS: [string, string][] = [
  ["severity", "Severity"],
  ["flood", "Flood"],
  ["traffic", "Traffic"],
  ["facilities", "Hospitals & schools"],
  ["accidents", "Accidents"],
  ["repeat", "Repeat failures"],
  ["complaints", "Complaints"],
  ["social", "Social posts"],
];

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  funded: { label: "Funded", color: "#1E5B1F", bg: "#E5F4E4" },
  deferred: { label: "Deferred", color: "#7A4B00", bg: "#F9EEDA" },
  warranty: { label: "Warranty: ₹0 to BMC", color: "#3A2E8C", bg: "#EFEDFF" },
  excluded: { label: "Excluded", color: "#3B3F47", bg: "#EDEDE8" },
};

const MATCH: Record<string, string> = {
  gps: "GPS match",
  "road named": "road named in text (segment uncertain)",
};

type Overrides = { ward: string; budget?: number; weights?: Record<string, number> };

export default function NextRupeePage() {
  const { ward } = useWard();
  // User changes apply to one ward only: switching ward goes back to that ward's defaults.
  const [ov, setOv] = useState<Overrides>({ ward });
  const mine = ov.ward === ward ? ov : { ward };

  const plan = useQuery({
    queryKey: ["plan", ward, mine.budget ?? null, mine.weights ?? null],
    queryFn: () => api(`${wardPath(ward)}/plan${qs({ budget_inr: mine.budget, ...(mine.weights ?? {}) })}`),
    placeholderData: keepPreviousData,
  });

  if (plan.error) return <ErrorBox error={plan.error} />;
  if (!plan.data) return <Loading />;
  const d = plan.data;
  const stale = d.ward_code !== ward; // previous ward's plan shown while the new one loads
  const budget = mine.budget ?? d.budget_inr;
  const weights: Record<string, number> = mine.weights ?? d.weights;
  const changed = mine.budget !== undefined || mine.weights !== undefined;

  const setBudget = (v: number) => setOv({ ...mine, ward, budget: Math.max(0, Math.round(v)) });
  const setWeight = (k: string, v: number) => setOv({ ...mine, ward, weights: { ...weights, [k]: v } });

  const exportCsv = () => {
    const cols = ["issue_id", "road_id", "road_name", "category_reported", "locality_text", "risk_score", "method", "est_cost_inr", "match_class", "why"];
    const cell = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [cols.join(","), ...d.selected.map((s: any) => cols.map((c) => cell(s[c])).join(","))];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `next_rupee_plan_ward_${ward.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-5 ${stale || plan.isFetching ? "opacity-85 transition-opacity" : ""}`}>
      <PageTitle
        title={`Where should ward ${ward}'s next rupee go?`}
        sub="Open complaints are merged into issues, matched to a road and ranked by public risk. Costs are estimates from the rate card."
      />

      <div className="rounded-xl border border-[#9CCFA0] bg-[#EAF6EA] px-4 py-3 text-[13.5px]">
        <b>Recover first, then reinvest.</b> Default budget {inr(d.default_budget_inr)}: {d.default_budget_reason}.
      </div>

      <Section title="Budget and risk weights" hint="Move a weight to see how sensitive the ranking is. 0 ignores a signal, 10 counts it most." right={<DataBadge />}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="text-[12.5px] font-semibold text-[#454952]">
            Budget to allocate (₹)
            <input
              type="number"
              min={0}
              step={100000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value) || 0)}
              className="mt-1 block w-44 rounded-lg border border-[#D5D6D0] bg-white px-3 py-1.5 text-[15px] font-bold text-[#16181D]"
            />
          </label>
          <div className="flex flex-wrap gap-1.5 pb-0.5" aria-label="Budget presets">
            {[500000, 1000000, 2000000].map((v) => (
              <button key={v} type="button" onClick={() => setBudget(v)}
                className={`min-h-9 rounded-full border px-3 text-[12.5px] font-semibold ${budget === v ? "border-[#1E4FD8] bg-[#E3EBFD] text-[#17306E]" : "border-[#D5D6D0] bg-white"}`}>
                {inr(v)}
              </button>
            ))}
          </div>
          <div className="pb-1.5 text-[13px] text-[#454952]">
            = {inr(budget)} · {inr(d.unallocated_inr)} left
            {changed ? (
              <button onClick={() => setOv({ ward })} className="ml-3 font-semibold text-[#1E4FD8] underline">
                reset to default
              </button>
            ) : (
              <span className="ml-2">(default)</span>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 md:grid-cols-4 xl:grid-cols-8">
          {WEIGHTS.map(([k, label]) => (
            <label key={k} className="text-[12px] font-semibold text-[#454952]">
              <span className="flex justify-between">
                {label} <span className="text-[#1E4FD8]">{weights[k] ?? 0}</span>
              </span>
              <input type="range" min={0} max={10} step={1} value={weights[k] ?? 0} onChange={(e) => setWeight(k, Number(e.target.value))}
                aria-valuetext={`${label}: ${weights[k] ?? 0} of 10`} className="h-6 w-full accent-[#1E4FD8]" />
              <span className="flex justify-between text-[10.5px] font-normal text-[#6A6F78]"><span>ignore</span><span>most</span></span>
            </label>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi icon={Wallet} label="Planned (estimate)" value={inr(d.total_inr)} sub={`of ${inr(d.budget_inr)} · ${inr(d.unallocated_inr)} left`} tone="#1E7B34" />
        <Kpi icon={ListChecks} label="Issues funded" value={d.selected.length} sub={`${d.deferred.length} deferred`} />
        <Kpi icon={ShieldCheck} label="Sent to warranty" value={d.dlp_routed.length} sub="₹0 to BMC" tone="#5B4BC4" />
        <Kpi icon={ArrowDownUp} label="Ranked by risk, not volume" value={`${d.top10_differ_from_complaint_ranking} of top 10`} sub="would rank lower by complaint count alone" />
        <Kpi icon={HardHat} tone="#16298A" label="Crew capacity" value={`${d.crew_jobs} jobs`} sub={`in ${d.plan_days} days`} />
      </div>

      {/* Strategy comparison (Aditya's feature): the same budget and weights, funded in three different orders. */}
      <StrategyCompare ward={ward} budget={d.budget_inr} weights={mine.weights} />

      <Group title="Funded, in priority order" items={d.selected} open note={`${inr(d.total_inr)} estimated`} status="funded" budget={d.budget_inr} />
      {[["Deferred", d.deferred, "over budget or over crew capacity after higher-risk items", "deferred"],
        ["Sent to the warranty contractor", d.dlp_routed, "road under its Defect Liability Period: repaired at ₹0 to BMC", "warranty"],
        ["Excluded issues", d.excluded, "shown with the reason, never dropped", "excluded"]]
        .filter(([, items]: any) => items.length)
        .map(([title, items, note, status]: any) => <Group key={title} title={title} items={items} note={note} status={status} />)}
      {[["Deferred", d.deferred], ["Sent to warranty", d.dlp_routed], ["Excluded", d.excluded]].some(([, i]: any) => !i.length) ? (
        <p className="text-[13px] text-[#454952]">
          None: {[["Deferred", d.deferred], ["Sent to warranty", d.dlp_routed], ["Excluded", d.excluded]].filter(([, i]: any) => !i.length).map(([t]: any) => t).join(" · ")}
        </p>
      ) : null}

      <details className="rounded-2xl border border-[#D5D6D0] bg-white p-5">
        <summary className="cursor-pointer text-[16px] font-bold">
          Complaints not placed in the plan <span className="font-normal text-[#454952]">· {d.excluded_complaints.length}</span>
        </summary>
        <p className="mt-1 text-[12.5px] text-[#454952]">Nothing is dropped silently: each open complaint that did not become an issue is listed with why.</p>
        <table className="mt-3 w-full text-[13px]">
          <thead className="text-left text-[11.5px] uppercase tracking-wide text-[#454952]">
            <tr>
              <th className="py-1">Complaint</th>
              <th>Category</th>
              <th>Locality</th>
              <th>Description</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {d.excluded_complaints.map((c: any) => (
              <tr key={c.complaint_id} className="border-t border-[#EDEDE8] align-top">
                <td className="py-1.5 pr-2 font-semibold">{c.complaint_id}</td>
                <td className="pr-2">{c.category}</td>
                <td className="pr-2">{c.locality}</td>
                <td className="pr-2 text-[#454952]">{c.description}</td>
                <td className="font-semibold text-[#7A4B00]">{c.reason}</td>
              </tr>
            ))}
            {d.excluded_complaints.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-2 text-[#454952]">Every open complaint in this ward was placed.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </details>

      <Section
        title="Assumptions"
        right={
          <button onClick={exportCsv} disabled={!d.selected.length} className="rounded-lg border border-[#D5D6D0] bg-white px-3 py-1.5 text-[13px] font-semibold hover:border-[#16181D] disabled:opacity-50">
            ⬇ Export plan (CSV)
          </button>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-[#2A2D33]">
          {d.assumptions.map((a: string) => (
            <li key={a}>{a}</li>
          ))}
          <li>Total open backlog outside warranty: {inr(d.backlog_inr)} (estimate).</li>
        </ul>
        <p className="mt-3 text-[13px] font-semibold">A recommendation for the ward officer, not a funding approval.</p>
      </Section>
    </div>
  );
}

function Group({ title, items, note, open, status, budget }: { title: string; items: any[]; note?: string; open?: boolean; status?: string; budget?: number }) {
  // Running total after each funded item, computed up front (no mutation during render).
  const runningTotals = items.reduce<number[]>((acc, it) => [...acc, (acc.at(-1) ?? 0) + (Number(it.est_cost_inr) || 0)], []);
  const running = runningTotals.at(-1) ?? 0;
  return (
    <details open={open} className="rounded-2xl border border-[#D5D6D0] bg-white p-5">
      <summary className="cursor-pointer text-[16px] font-bold">
        {title} <span className="font-normal text-[#454952]">· {items.length}{note ? ` · ${note}` : ""}</span>
      </summary>
      <div className="mt-3 space-y-2">
        {items.map((it, i) => (
          <IssueCard key={it.issue_id} it={it} rank={i + 1} hidePill={it.status === status} running={budget != null ? runningTotals[i] : undefined} />
        ))}
        {budget != null && items.length ? (
          <div className="flex items-center gap-2 pt-1 text-[12.5px] font-semibold text-[#9A3208]">
            <span className="h-0.5 flex-1 border-t-2 border-dashed border-[#C2410C]" />
            Budget line: {inr(running)} of {inr(budget)} used{running < budget ? ` · ${inr(budget - running)} left` : ""}
            <span className="h-0.5 flex-1 border-t-2 border-dashed border-[#C2410C]" />
          </div>
        ) : null}
      </div>
    </details>
  );
}

function IssueCard({ it, rank, hidePill, running }: { it: any; rank: number; hidePill?: boolean; running?: number }) {
  const st = STATUS[it.status] ?? STATUS.excluded;
  const score = Math.max(0, Math.min(100, Number(it.risk_score) || 0));
  const chips = String(it.why ?? "").split("; ").filter(Boolean);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#EDEDE8] bg-white px-3.5 py-2.5 sm:flex-row sm:gap-3">
      <div className="shrink-0 sm:w-7 sm:pt-0.5 sm:text-center"><span className="text-[18px] font-extrabold text-[#6A6F78]">{rank}</span></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[14.5px] font-bold">{it.road_name ?? "Road not identified"}</span>
          <span className="text-[13px] text-[#454952]">· {it.category_reported} · {it.locality_text}</span>
          {hidePill ? null : <Pill color={st.color} bg={st.bg}>{st.label}</Pill>}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.slice(0, 3).map((c) => (
            <span key={c} className="rounded-full border border-[#C9D7F5] bg-[#EEF3FD] px-2 py-0.5 text-[11.5px] text-[#17306E]">{c}</span>
          ))}
          {chips.length > 3 ? <span title={chips.slice(3).join(" · ")} className="rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold text-[#17306E]">+{chips.length - 3} more</span> : null}
        </div>
        <div className="mt-1.5 text-[12.5px] text-[#454952]">
          {it.method ? (
            <>
              <b className="text-[#16181D]">{it.method}</b>
              {it.method_why ? ` · ${it.method_why}` : ""} ·{" "}
            </>
          ) : null}
          {MATCH[it.match_class] ?? it.match_class ?? "no road match"}
        </div>
        {it.reason ? <div className="mt-1 text-[12.5px] font-semibold text-[#7A4B00]">{it.reason}</div> : null}
      </div>
      <div className="w-full shrink-0 sm:w-36 sm:text-right">
        <div className="text-[11.5px] font-bold text-[#454952]">Risk {score.toFixed(1)} / 100</div>
        <div className="mt-1 h-2 rounded bg-[#EFEFEA]" title="Risk score, 0 to 100, normalised across the city">
          <div className="h-2 rounded bg-[#1E4FD8]" style={{ width: `${score}%` }} />
        </div>
        <div className="mt-2 text-[16px] font-extrabold">{it.est_cost_inr != null ? inrFull(it.est_cost_inr) : "–"}</div>
        <div className="text-[11px] text-[#454952]">estimate{running != null ? ` · running ${inr(running)}` : ""}</div>
      </div>
    </div>
  );
}
