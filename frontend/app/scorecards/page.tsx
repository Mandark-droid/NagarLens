"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { DataBadge, ErrorBox, Loading, PageTitle, PeerChip, Section } from "@/components/bits";
import { RainContext } from "@/components/rain-context";
import { api } from "@/lib/api";
import { inr, pct } from "@/lib/format";

export default function ScorecardsPage() {
  const [kind, setKind] = useState<"contractors" | "wards">("contractors");
  const q = useQuery({ queryKey: ["scorecards", kind], queryFn: () => api(`/scorecards/${kind}`) });
  const tiers = useQuery({ queryKey: ["sla-tiers"], queryFn: () => api("/scorecards/sla-tiers") });
  const ctx = useQuery({ queryKey: ["scorecard-context", kind], queryFn: () => api(`/scorecards/${kind}/context`) });
  const ctxBy = new Map((ctx.data?.rows ?? []).map((c: any) => [c.contractor_id ?? c.ward_code, c]));
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;

  return (
    <div className="space-y-5">
      <PageTitle title="Who is responsible? Fair, like-for-like scorecards" sub="Each contractor and ward is compared with what everyone else achieves on the same mix of jobs." />
      <div className="rounded-xl border border-[#A9BEF0] bg-[#EEF3FD] px-4 py-3 text-[13.5px]">
        <b>System problem, not a contractor problem:</b> 24-hour SLAs are missed on almost every job by everyone, and warranty-period billing
        is spread across all eight contractors. Those are process gaps, so they never count against one contractor.
      </div>
      <div className="flex gap-2">
        {(["contractors", "wards"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold capitalize ${kind === k ? "border-[#1E4FD8] bg-[#E3EBFD] text-[#17306E]" : "border-[#D5D6D0] bg-white"}`}>{k}</button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {q.data.rows.map((r: any) => (
          <div key={r.contractor_id ?? r.ward_code} className="rounded-2xl border border-[#D5D6D0] bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[16px] font-extrabold">{kind === "wards" ? `Ward ${r.ward_code} · ${r.ward_name}` : r.contractor}</div>
                <div className="text-[12.5px] text-[#454952]">{r.jobs} repairs · {inr(r.billed_inr)} billed · {r.durability_tier}{r.small_sample ? " · small sample" : ""}</div>
              </div>
              <DataBadge />
            </div>
            <div className="my-3 flex gap-2">
              <PeerChip label="Speed" value={r.speed_chip} />
              <PeerChip label="Durability" value={r.durability_chip} />
              <PeerChip label="Cost" value={r.cost_chip} />
            </div>
            <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-3">
              <Versus label="On time" actual={r.on_time_rate} expected={r.expected_on_time_rate} verdict={r.speed_chip} />
              <Versus label="Re-opened in 30 days" actual={r.reopen_rate} expected={r.expected_reopen_rate} verdict={r.durability_chip} />
              <Versus label="Bills above 1.4× rate card" actual={r.over_rate_card_share} expected={r.peer_over_rate_card_share} verdict={r.cost_chip} />
            </div>
            <RainContext row={ctxBy.get(r.contractor_id ?? r.ward_code)} />
            {r.improve ? <p className="mt-3 rounded-lg bg-[#F6F6F3] px-3 py-2 text-[13.5px]"><b>One thing to improve:</b> {r.improve}</p> : null}
            <details className="mt-2 text-[13.5px] leading-relaxed"><summary className="min-h-9 cursor-pointer py-1 font-semibold text-[#1E4FD8]">Read the full scorecard</summary><p className="mt-1">{r.text}</p></details>
          </div>
        ))}
      </div>

      {tiers.data ? (
        <Section title="On time within each SLA tier: urgent jobs are late for everyone" hint="Share of jobs finished inside the SLA. Darker = more often on time.">
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-center text-[13px]">
            <thead><tr><th className="text-left">Contractor</th>{tiers.data.tiers.map((t: number) => <th key={t} className="whitespace-nowrap py-1">{t} h</th>)}</tr></thead>
            <tbody>
              {tiers.data.rows.map((row: any) => (
                <tr key={row.contractor} className={row.contractor === "All contractors" ? "border-t-2 border-[#16181D] font-bold" : ""}>
                  <td className="py-1 pr-3 text-left">{row.contractor}</td>
                  {row.cells.map((c: any) => (
                    <td key={c.sla_hours} className="p-0.5">
                      <div className="rounded py-1.5" title={`${c.jobs} jobs`} style={{ background: `rgba(30,79,216,${0.04 + 0.56 * c.on_time_rate})`, color: "#16181D" }}>{pct(c.on_time_rate)}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table></div>
          <div aria-label="Legend" className="mt-3 flex items-center justify-end gap-2 text-[12.5px] text-[#2A2D33]">
            <span>Share finished inside the SLA:</span>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <span key={v} className="flex flex-col items-center">
                <span className="inline-block h-3 w-9 rounded-sm" style={{ background: `rgba(30,79,216,${0.04 + 0.56 * v})` }} />
                <span className="text-[11px] text-[#454952]">{Math.round(v * 100)}%</span>
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="How the comparison is made fair">
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-[#2A2D33]">{q.data.method.map((m: string) => <li key={m}>{m}</li>)}</ul>
      </Section>
    </div>
  );
}

// Colour follows the chip verdict (same 3-point / 2-SE test), so a number never contradicts its chip.
const VERDICT_TONE: Record<string, [string, string]> = {
  "better than peers": ["#1E7B34", "▲ "],
  "below peers": ["#8A5A00", "▼ "],
  "in line with peers": ["#2A2D33", ""],
};
function Versus({ label, actual, expected, verdict }: { label: string; actual: number; expected: number; verdict?: string }) {
  const [tone, mark] = VERDICT_TONE[verdict ?? ""] ?? VERDICT_TONE["in line with peers"];
  return (
    <div className="rounded-lg bg-[#F6F6F3] px-2.5 py-2">
      <div className="text-[11px] text-[#454952]">{label}</div>
      <div className="text-[18px] font-extrabold" style={{ color: tone }}><span aria-hidden>{mark}</span>{pct(actual)}</div>
      <div className="text-[11px] text-[#454952]">peers on same mix: {pct(expected)}</div>
    </div>
  );
}
