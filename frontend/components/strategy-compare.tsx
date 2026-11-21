"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useQuery } from "@tanstack/react-query";
import { Scale } from "lucide-react";

import { DataBadge, ErrorBox, Loading, Pill, Section } from "@/components/bits";
import { api, qs, wardPath } from "@/lib/api";
import { inr, pct } from "@/lib/format";

// Strategy comparison (feature owner: Aditya): the same budget spent three ways.
// Same issues, same cost estimates, same crews, same warranty routing: only the funding order differs.
// It reports coverage counts from the dataset. It does not forecast accidents or savings.

const TONE: Record<string, string> = { most_complaints: "#6A6F78", highest_severity: "#8A5A00", nagarlens_risk: "#1E4FD8" };

// label, key, how to print, and whether a higher number is the better one (null = neither is "better")
const ROWS: [string, string, (v: number) => string, boolean | null][] = [
  ["Issues funded", "issues_funded", String, true],
  ["Planned cost (estimate)", "total_inr", inr, null],
  ["Of the ward's 10 highest-risk issues", "top_risk_issues", (v) => `${v} of 10`, true],
  ["Average risk score of funded issues", "avg_risk_score", (v) => v.toFixed(1), true],
  ["Summed risk covered", "risk_covered", (v) => v.toFixed(0), true],
  ["Share of the ward's total risk", "risk_covered_share", (v) => pct(v), true],
  ["On hospital ambulance roads", "hospital_road_issues", String, true],
  ["On roads serving schools", "school_road_issues", String, true],
  ["At flood hotspots", "flood_hotspot_issues", String, true],
  ["On bus routes", "bus_route_issues", String, true],
  ["High-severity defects", "high_severity_issues", String, true],
  ["Citizen complaints addressed", "complaints_addressed", String, true],
];

export default function StrategyCompare({ ward, budget, weights }: { ward: string; budget?: number | null; weights?: Record<string, number> }) {
  const q = useQuery({
    queryKey: ["strategies", ward, budget ?? null, weights ?? null],
    queryFn: () => api(`${wardPath(ward)}/strategies${qs({ budget_inr: budget ?? undefined, ...(weights ?? {}) })}`),
    placeholderData: (prev: any) => prev,
  });
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading label="Comparing strategies…" />;
  const d = q.data;
  const rows: any[] = d.strategies ?? [];

  return (
    <Section
      title="Is the risk plan better? The same budget spent three ways"
      hint={`${inr(d.budget_inr)} for ward ${d.ward_code}. ${d.note}`}
      right={<DataBadge />}
    >
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#454952]">{d.note}</p>
      ) : (
        <>
          {d.identical ? (
            <p className="mb-3 rounded-lg border border-[#E8CF8A] bg-[#FFF8E6] px-3 py-2 text-[13px]">
              <b>No difference at this budget.</b> {d.note}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]" role="table" aria-label="Strategy comparison">
              <thead>
                <tr className="text-left align-bottom">
                  <th className="w-[34%] py-2 pr-3 text-[11.5px] font-bold uppercase tracking-wide text-[#454952]">
                    <Scale className="mr-1 inline size-4" aria-hidden />
                    What the budget covers
                  </th>
                  {rows.map((s) => (
                    <th key={s.key} className="px-3 py-2" style={{ borderTop: `4px solid ${TONE[s.key] ?? "#6A6F78"}` }}>
                      <div className="text-[14px] font-extrabold" style={{ color: TONE[s.key] }}>{s.label}</div>
                      <div className="text-[11.5px] font-normal leading-snug text-[#454952]">{s.rule}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, key, fmt, higherBetter]) => {
                  const vals = rows.map((s) => Number(s[key] ?? 0));
                  const best = higherBetter === null ? null : Math.max(...vals);
                  const allSame = vals.every((v) => v === vals[0]);
                  return (
                    <tr key={key} className="border-t border-[#EDEDE8]">
                      <td className="py-1.5 pr-3 text-[#2A2D33]">{label}</td>
                      {rows.map((s, i) => {
                        const lead = best !== null && !allSame && vals[i] === best;
                        return (
                          <td key={s.key} className="px-3 py-1.5">
                            <span className={lead ? "rounded-md bg-[#E5F4E4] px-2 py-0.5 font-extrabold text-[#1E5B1F]" : "font-semibold"}>
                              {fmt(vals[i])}
                            </span>
                            {lead ? <span className="sr-only"> (highest)</span> : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] text-[#454952]">
            Green marks the highest value in a row. All three send the same {rows[0].warranty_routed} issue(s) to the warranty contractor at ₹0 to BMC.
          </p>

          {d.summary?.length ? (
            <div className="mt-3 rounded-xl bg-[#F3F6FE] px-4 py-3 text-[13.5px] leading-relaxed">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#17306E]">What the numbers say, including where the risk plan loses</div>
              <ul className="list-disc space-y-1 pl-5">{d.summary.map((line: string) => <li key={line}>{line}</li>)}</ul>
            </div>
          ) : null}

          {d.only_in_nagarlens?.length ? (
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#454952]">Only the risk plan funds these</div>
              <div className="space-y-1.5">
                {d.only_in_nagarlens.map((x: any) => (
                  <div key={x.issue_id} className="rounded-lg border border-[#D5D6D0] bg-white px-3 py-2 text-[13px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <b>{x.road_name}</b> · {x.category_reported}
                        {x.locality_text ? ` · ${x.locality_text}` : ""}
                      </span>
                      <span className="font-semibold">
                        risk {x.risk_score.toFixed(1)} · {inr(x.est_cost_inr)} <span className="font-normal text-[#454952]">estimate</span>
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {String(x.why).split("; ").map((w) => <Pill key={w} color="#17306E" bg="#EEF3FD">{w}</Pill>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <details className="mt-3 text-[12px] text-[#454952]">
            <summary className="cursor-pointer font-semibold">How this comparison is kept fair</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{(d.assumptions ?? []).map((a: string) => <li key={a}>{a}</li>)}</ul>
          </details>
        </>
      )}
    </Section>
  );
}
