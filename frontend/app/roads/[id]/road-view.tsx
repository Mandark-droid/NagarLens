"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList, IndianRupee, RotateCcw, ShieldAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

import { DataBadge, ErrorBox, Loading, PageTitle, Pill, Section } from "@/components/bits";
import { api } from "@/lib/api";
import { cleanName, inr, inrFull, pct, when } from "@/lib/format";

import { StatTile } from "../road-ui";

// Same meaning as everywhere else: green = held, amber = failed, orange = needs review, purple = warranty.
const HELD = "#1E7B34", FAILED = "#B07A00", FAILED_TEXT = "#8A5A00";
const DAY_MS = 86_400_000;
const day = (ts: number | string) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const month = (ts: number | string) => new Date(ts).toLocaleDateString("en-IN", { month: "short" });
const gap = (w: any) => (w.days_since_previous < 0 ? "while the previous repair was still open" : `${Math.round(w.days_since_previous)} days after the previous repair`);

export default function RoadView() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ["road", id], queryFn: () => api(`/roads/${id}`) });

  if (q.isError) return <ErrorBox error={q.error} />;
  if (!q.data) return <Loading />;
  const d = q.data, r = d.road, tot = d.totals;
  const orders = d.work_orders as any[], leads = d.findings as any[], complaints = d.complaints as any[];
  const warranty = r.under_dlp === "Y";

  return (
    <div className="space-y-5">
      <Link href="/roads" className="road-control inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-semibold text-[#1E4FD8]">← All roads in the ward</Link>
      <PageTitle title={r.road_name}
        sub={`Segment ${r.segment_no} · ${r.road_id} · ward ${r.ward_code} · ${r.road_type} · ${r.surface} · ${r.lanes} lanes · ${r.length_m} m`} />
      <div className="flex flex-wrap items-center gap-2">
        {warranty
          ? <Pill color="#3A2E8C" bg="#EFEDFF">Under warranty · resurfaced {when(r.last_resurfaced, false)}</Pill>
          : <Pill>Warranty expired · resurfaced {when(r.last_resurfaced, false)}</Pill>}
        {r.bus_route === "Y" ? <Pill>BEST bus route</Pill> : null}
        <DataBadge />
      </div>

      {warranty ? (
        <div className="road-tile flex items-start gap-3 rounded-2xl p-4 text-[13.5px] text-[#2A2466]" data-tone="warranty">
          <span className="road-chip grid size-9 shrink-0 place-items-center rounded-xl"><ShieldAlert className="size-5" aria-hidden /></span>
          <div>
            <b>This segment is still in its warranty (defect liability) period.</b> Repairs here are normally done by the original
            contractor at no cost to BMC. {inrFull(tot.billed_inr)} was billed on it this monsoon; the leads below show which jobs to check.
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile tone="blue" Icon={Wrench} label="Repairs this monsoon" value={tot.jobs} note={`${tot.sla_met} finished within SLA`} />
        <StatTile tone="navy" Icon={IndianRupee} label="Billed" value={inr(tot.billed_inr)} note="work order bills, Jun to Oct 2025" />
        <StatTile tone="failed" Icon={RotateCcw} label="Failed within 30 days" value={tot.reopened}
          note={tot.jobs ? `${pct(tot.reopened / tot.jobs)} of repairs · ${inr(tot.reopened_billed_inr)} billed for them` : "no repairs"} />
        <StatTile tone="review" Icon={ClipboardList} label="Needs review" value={tot.review_inr ? inr(tot.review_inr) : "–"}
          note={`${tot.review_jobs} jobs with an audit lead, counted once`} />
      </div>

      {orders.length === 0 ? (
        <Section title="No repairs logged" hint="No work order names this segment between June and October 2025."><span /></Section>
      ) : (
        <>
          <Section title="Every repair on this segment"
            hint="One mark per work order, on the day it was completed. Marks close together in a row are the same problem repaired again.">
            <Timeline orders={orders} lanes={(d.by_work_type as any[]).map((p) => p.work_type)} />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Billed each month" hint="By completion month, split by whether the repair held.">
              <ChartLegend items={[["Billed for repairs that held", HELD, "square"], ["Billed for repairs that failed within 30 days", FAILED, "square"]]} />
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={(d.monthly as any[]).map((m) => ({ ...m, held_billed_inr: m.billed_inr - m.reopened_billed_inr, label: month(`${m.month}-01T00:00:00`) }))} barSize={26}>
                  <defs>
                    {/* Same hues as the legend; the lighter left edge gives the bars a rounded, lit look. */}
                    <linearGradient id="road-held" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={HELD} stopOpacity={0.8} /><stop offset="0.45" stopColor={HELD} /></linearGradient>
                    <linearGradient id="road-failed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={FAILED} stopOpacity={0.8} /><stop offset="0.45" stopColor={FAILED} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EDEDE8" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickFormatter={(v) => (v ? inr(v) : "0")} width={62} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "#F1F1EC" }} formatter={(v: any, n: any) => [inrFull(Number(v)), n]}
                    labelFormatter={(l: any, p: any) => `${l} · ${p?.[0]?.payload?.jobs ?? 0} repairs, ${p?.[0]?.payload?.reopened ?? 0} failed`} />
                  <Bar dataKey="held_billed_inr" name="Held" stackId="b" fill="url(#road-held)" stroke="#fff" strokeWidth={2} isAnimationActive={false} />
                  <Bar dataKey="reopened_billed_inr" name="Failed within 30 days" stackId="b" fill="url(#road-failed)" radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={2} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="By problem" hint="A repeat is a repair assigned within 30 days of the previous repair of the same problem here.">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11.5px] uppercase tracking-wide text-[#454952]">
                  <tr><th className="py-1">Problem</th><th className="pl-3 text-right">Repairs</th><th className="pl-3 text-right">Failed</th><th className="pl-3 text-right">Repeats</th><th className="pl-3 text-right">Billed</th></tr>
                </thead>
                <tbody>
                  {(d.by_work_type as any[]).map((p) => (
                    <tr key={p.work_type} className="border-t border-[#EDEDE8]">
                      <td className="py-1.5 font-semibold">{p.work_type}</td>
                      <td className="pl-3 text-right tabular-nums">{p.jobs}</td><td className="pl-3 text-right tabular-nums">{p.reopened}</td>
                      <td className="pl-3 text-right tabular-nums">{p.repeat_jobs}</td><td className="pl-3 text-right tabular-nums">{inrFull(p.billed_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>

          <Section title="Context for a fair reading" hint="Repeat failures are context, not blame. These are the conditions this segment works under.">
            <div className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="Traffic" value={d.traffic ? `${Number(d.traffic.peak_hour_vehicles).toLocaleString("en-IN")} vehicles in the peak hour · congestion ${d.traffic.congestion_index_0_10}/10` : "No traffic record"} />
              <Fact label="Flood hotspots within 500 m" value={d.flood_hotspots_nearby.length ? (d.flood_hotspots_nearby as any[]).map((h) => `${h.name} (${h.distance_m} m)`).join(", ") : "None"} />
              <Fact label="Hospitals and schools using this road" value={d.facilities.length ? (d.facilities as any[]).map((f) => f.name).join(", ") : "None listed"} />
              <Fact label="Accidents on record (2024 to 2025)" value={d.accidents.total ? `${d.accidents.total}: ${Object.entries(d.accidents.by_cause).map(([k, v]) => `${v} ${k}`).join(", ")}` : "None"} />
            </div>
          </Section>

          <Section title="Repair log" hint="Open a work order to follow its case from complaint to verdict. Rate card = standard rate × area, or the flat rate per job.">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[980px] text-[12.5px]">
                <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-[#454952]">
                  <tr><th className="py-1">Completed</th><th>Work order</th><th>Problem and method</th><th>Contractor</th><th className="text-right">Billed</th>
                    <th className="pl-3 text-right">vs rate card</th><th className="pl-3">On time</th><th>Outcome</th><th className="pl-3">Same problem before</th><th className="pl-3">Leads</th></tr>
                </thead>
                <tbody>
                  {orders.map((w) => (
                    <tr key={w.work_order_id} className="border-t border-[#EDEDE8] align-top">
                      <td className="whitespace-nowrap py-1.5">{day(w.completed_at)}</td>
                      <td><Link href={`/case?wo=${w.work_order_id}`} className="font-semibold text-[#1E4FD8] hover:underline">{w.work_order_id}</Link></td>
                      <td>{w.work_type}<div className="text-[#454952]">{w.repair_method} · {w.area_sqm} sqm</div></td>
                      <td>{w.contractor}</td>
                      <td className="text-right tabular-nums">{inrFull(w.cost_inr)}</td>
                      <td className="pl-3 text-right tabular-nums">{Number(w.cost_ratio).toFixed(1)}×</td>
                      <td className="pl-3">{w.sla_met === "Y" ? "Yes" : "No"} <span className="text-[#454952]">({w.sla_hours} h)</span></td>
                      <td className="whitespace-nowrap font-semibold" style={{ color: w.reopened_within_30d === "Y" ? FAILED_TEXT : HELD }}>
                        {w.reopened_within_30d === "Y" ? "◆ Failed in 30 days" : "● Held"}
                      </td>
                      <td className="pl-3 text-[#454952]">{w.previous_work_order_id ? <>{w.is_repeat ? <b className="text-[#16181D]">Repeat: </b> : null}{gap(w)}</> : "First repair of this problem"}</td>
                      <td className="pl-3 text-[#C2410C]">{w.flags.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`Leads on this road (${leads.length})`} hint="Each lead needs a second look with the evidence named. A lead is a question for the ward office, not a conclusion.">
            {leads.length ? (
              <div className="max-h-[420px] space-y-2 overflow-auto">
                {leads.map((f) => (
                  <div key={f.finding_id} className="rounded-lg border border-[#EDEDE8] p-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill color="#7A2A08" bg="#FFF3EC">{f.rule}</Pill>
                      <Link href={`/case?wo=${f.work_order_id}`} className="font-semibold text-[#1E4FD8] hover:underline">{f.work_order_id}</Link>
                      <span className="text-[#454952]">{cleanName(f.contractor)} · billed {inrFull(f.amount_billed_inr)} · to review {inrFull(f.amount_at_risk_inr)}</span>
                    </div>
                    <p className="mt-1">{f.reason}</p>
                    {f.fair_context ? <p className="text-[#454952]">Fair context: {f.fair_context}</p> : null}
                  </div>
                ))}
              </div>
            ) : <div className="text-[13px] text-[#454952]">No audit lead names a work order on this segment.</div>}
          </Section>

          <Section title={`Complaints behind this work (${complaints.length})`} hint="Linked to a work order on this segment by an exact complaint id.">
            {complaints.length ? (
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full min-w-[720px] text-[12.5px]">
                  <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-[#454952]">
                    <tr><th className="py-1">Received</th><th>Complaint</th><th>Channel</th><th>Reported as</th><th>Work order</th><th className="text-right">Upvotes</th></tr>
                  </thead>
                  <tbody>
                    {complaints.map((c) => (
                      <tr key={c.complaint_id} className="border-t border-[#EDEDE8]">
                        <td className="whitespace-nowrap py-1.5">{day(c.received_at)}</td><td>{c.complaint_id}</td><td>{c.channel}</td><td>{c.category_reported}</td>
                        <td><Link href={`/case?wo=${c.work_order_id}`} className="text-[#1E4FD8] hover:underline">{c.work_order_id}</Link></td>
                        <td className="text-right tabular-nums">{c.upvotes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-[13px] text-[#454952]">No complaint is linked to a work order on this segment.</div>}
          </Section>
        </>
      )}

      {d.other_segments.length ? (
        <Section title={`Other segments of ${r.road_name}`}>
          <div className="flex flex-wrap gap-2">
            {(d.other_segments as any[]).map((s) => (
              <Link key={s.road_id} href={`/roads/${s.road_id}`} className="road-control min-h-10 rounded-full px-3 py-1.5 text-[13px] font-semibold">
                Segment {s.segment_no} · ward {s.ward_code} · {s.road_id}
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#EDEDE8] p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#454952]">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function ChartLegend({ items }: { items: [string, string, "square" | "circle" | "diamond"][] }) {
  return (
    <div aria-label="Legend" className="mb-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-[#2A2D33]">
      {items.map(([label, color, shape]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 ${shape === "circle" ? "rounded-full" : shape === "diamond" ? "rotate-45 scale-[0.8]" : "rounded-sm"}`} style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// One lane per problem type. Shape and colour both carry the outcome (circle = held, diamond = failed).
function Timeline({ orders, lanes }: { orders: any[]; lanes: string[] }) {
  const pts = orders.map((w) => ({ ...w, ts: new Date(w.completed_at).getTime(), lane: lanes.indexOf(w.work_type) }));
  const first = new Date(Math.min(...pts.map((p) => p.ts))), last = new Date(Math.max(...pts.map((p) => p.ts)));
  const months = (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 1;
  const ticks = Array.from({ length: months }, (_, i) => new Date(first.getFullYear(), first.getMonth() + i, 1).getTime());
  const domain = [ticks[0] - 2 * DAY_MS, new Date(last.getFullYear(), last.getMonth() + 1, 1).getTime()];
  return (
    <div>
      <ChartLegend items={[["Repair held", HELD, "circle"], ["Failed within 30 days", FAILED, "diamond"]]} />
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <ResponsiveContainer width="100%" height={56 + lanes.length * 40}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#EDEDE8" vertical={false} />
              <XAxis type="number" dataKey="ts" domain={domain} ticks={ticks} tickFormatter={month} fontSize={11} tickLine={false} />
              <YAxis type="number" dataKey="lane" domain={[-0.5, lanes.length - 0.5]} ticks={lanes.map((_, i) => i)} tickFormatter={(i) => lanes[i] ?? ""}
                reversed width={170} interval={0} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip cursor={false} isAnimationActive={false} content={<Tip />} />
              <Scatter name="Repair held" data={pts.filter((p) => p.reopened_within_30d !== "Y")} isAnimationActive={false}
                shape={(p: any) => <circle cx={p.cx} cy={p.cy} r={5} fill={HELD} stroke="#fff" strokeWidth={2} />} />
              <Scatter name="Failed within 30 days" data={pts.filter((p) => p.reopened_within_30d === "Y")} isAnimationActive={false}
                shape={(p: any) => <rect x={p.cx - 5} y={p.cy - 5} width={10} height={10} transform={`rotate(45 ${p.cx} ${p.cy})`} fill={FAILED} stroke="#fff" strokeWidth={2} />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: any }[] }) {
  const w = payload?.[0]?.payload;
  if (!active || !w) return null;
  return (
    <div className="rounded-lg border border-[#D5D6D0] bg-white px-3 py-2 text-[12px] shadow-md">
      <div className="font-bold">{w.work_type} · {w.work_order_id}</div>
      <div>Completed {day(w.completed_at)} · {w.repair_method}</div>
      <div>{w.contractor} · billed {inrFull(w.cost_inr)}</div>
      <div className="font-semibold" style={{ color: w.reopened_within_30d === "Y" ? FAILED_TEXT : HELD }}>{w.reopened_within_30d === "Y" ? "Failed within 30 days" : "Held"}</div>
      {w.is_repeat ? <div>Repeat: {gap(w)}</div> : null}
    </div>
  );
}
