"use client";

import { useQuery } from "@tanstack/react-query";
import { IndianRupee, MapPinned, RotateCcw, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataBadge, ErrorBox, Loading, Pill, Section } from "@/components/bits";
import { api, qs } from "@/lib/api";
import { inr, pct } from "@/lib/format";

import { useWard } from "../providers";
import { Chakra, StatTile } from "./road-ui";

export default function RoadsPage() {
  const { ward } = useWard();
  const [q, setQ] = useState("");
  const roads = useQuery({ queryKey: ["roads", ward], queryFn: () => api(`/roads${qs({ ward })}`) });

  if (roads.isError) return <ErrorBox error={roads.error} />;
  if (!roads.data) return <Loading />;
  const tot = roads.data.totals;
  const needle = q.trim().toLowerCase();
  const rows = (roads.data.rows as any[]).filter((r) => !needle || `${r.road_name} ${r.road_id}`.toLowerCase().includes(needle));

  return (
    <div className="space-y-5">
      <section className="road-hero relative overflow-hidden rounded-3xl px-6 py-7 sm:px-10 sm:py-9">
        <div className="relative z-10 max-w-xl">
          <p className="text-[12px] font-bold uppercase tracking-widest text-white/75">Ward {ward} · June to October 2025</p>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-tight sm:text-[34px]">Did the fix last, road by road?</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/85">
            Open a road segment to see each repair this monsoon, what it was billed and whether it held.
          </p>
        </div>
        <div className="road-chakra-tilt pointer-events-none absolute -right-10 top-1/2 hidden size-56 -translate-y-1/2 text-white/85 sm:block lg:right-10">
          <Chakra className="road-chakra-spin size-full" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile tone="navy" Icon={MapPinned} label="Road segments" value={tot.segments} note={`in ward ${ward}`} />
        <StatTile tone="blue" Icon={Wrench} label="Repairs logged" value={tot.jobs.toLocaleString("en-IN")} note="work orders on these segments" />
        <StatTile tone="navy" Icon={IndianRupee} label="Billed" value={inr(tot.billed_inr)} note="work order bills, Jun to Oct 2025" />
        <StatTile tone="failed" Icon={RotateCcw} label="Failed within 30 days" value={tot.reopened.toLocaleString("en-IN")} note={`${pct(tot.reopen_rate)} of repairs`} />
      </div>
      <Section title={`Road segments in ward ${ward}`} hint="Billed amounts for June to October 2025, highest first. Failed = re-opened within 30 days."
        right={<DataBadge />}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search road name or id" aria-label="Search roads"
          className="road-control mb-3 min-h-10 w-full max-w-sm rounded-xl px-3 text-[13.5px] outline-none focus:border-[#1E4FD8]" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="text-left text-[11.5px] uppercase tracking-wide text-[#454952]">
              <tr>
                <th className="py-1">Road segment</th><th>Type</th><th className="pl-3 text-right">Repairs</th>
                <th className="pl-3 text-right">Billed</th><th className="pl-3 text-right">Failed</th><th className="pl-3 text-right">To review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.road_id} className="border-t border-[#EDEDE8]">
                  <td className="py-1.5">
                    <Link href={`/roads/${r.road_id}`} className="font-semibold text-[#1E4FD8] underline-offset-2 hover:underline">{r.road_name}</Link>{" "}
                    <span className="text-[#454952]">segment {r.segment_no} · {r.road_id}</span>
                    {r.under_dlp === "Y" ? <span className="ml-2"><Pill color="#3A2E8C" bg="#EFEDFF">under warranty</Pill></span> : null}
                  </td>
                  <td className="text-[#454952]">{r.road_type}</td>
                  <td className="whitespace-nowrap pl-3 text-right tabular-nums">{r.jobs}</td>
                  <td className="whitespace-nowrap pl-3 text-right tabular-nums">{inr(r.billed_inr)}</td>
                  <td className="whitespace-nowrap pl-3 text-right tabular-nums">
                    {r.reopened} <span className="text-[#454952]">({pct(r.reopen_rate)})</span>
                  </td>
                  <td className="whitespace-nowrap pl-3 text-right font-semibold tabular-nums text-[#C2410C]">{r.review_inr ? inr(r.review_inr) : "–"}</td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-[#454952]">No road segments match.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
