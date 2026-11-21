"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation } from "@tanstack/react-query";
import { Activity, ArrowDownUp, FileText, Gauge, IndianRupee, MapPin, RotateCcw, Wrench } from "lucide-react";
import { useState } from "react";

import { DataBadge, Kpi, PageTitle, Section, SourceBadge } from "@/components/bits";
import { api } from "@/lib/api";
import { cleanName, inr, inrFull, when } from "@/lib/format";

const EXAMPLES: [string, string][] = [
  ["मराठी", "माझी तक्रार BMC25-001690 चं काय झालं?"],
  ["हिन्दी", "मेरी शिकायत BMC25-001690 का क्या हुआ?"],
  ["English", "What happened to complaint BMC25-001690?"],
  ["Hinglish", "Meri complaint BMC25-001690 ka kya hua, road theek hua ya nahi?"],
];

export default function AskPage() {
  const [q, setQ] = useState(EXAMPLES[0][1]);
  const ask = useMutation({
    mutationFn: (question: string) => api("/ask", { method: "POST", body: JSON.stringify({ question }) }),
  });
  const submit = (question = q) => {
    if (question.trim()) ask.mutate(question.trim());
  };
  const d = ask.data;
  const w = d?.work_order;
  const o = d?.open_issue;

  return (
    <div className="space-y-5">
      <PageTitle
        title="What happened to my complaint?"
        sub="Ask in Marathi, Hindi, Hinglish or English. The answer comes back in your language, using only the linked records."
      />

      <Section title="Your question" hint="Include your complaint number · तक्रार क्रमांक लिहा · शिकायत नंबर लिखें · e.g. BMC25-001690" right={<DataBadge />}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Your question"
            className="min-h-11 min-w-0 flex-1 basis-60 rounded-lg border border-[#D5D6D0] bg-white px-3 py-2 text-[16px]"
          />
          <button type="submit" disabled={ask.isPending} className="min-h-11 rounded-lg bg-[#1E4FD8] px-5 py-2 text-[14px] font-bold text-white disabled:opacity-60">
            {ask.isPending ? "Asking…" : "Ask"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-[#454952]">
          Try:
          {EXAMPLES.map(([lang, text]) => (
            <button
              key={lang}
              type="button"
              onClick={() => setQ(text)}
              className="min-h-11 rounded-full border border-[#D5D6D0] bg-white px-3.5 py-1.5 text-left font-semibold text-[#16181D] hover:border-[#1E4FD8]"
            >
              {lang} <span className="font-normal text-[#454952]">· {text}</span>
            </button>
          ))}
        </div>
      </Section>

      {ask.error ? (
        <div className="rounded-xl border border-[#E9A988] bg-[#FFF3EC] p-4 text-sm text-[#7A2A08]">
          <b>{String((ask.error as Error).message).replace(/^\d+:\s*/, "")}</b>
          <div className="mt-1 opacity-80">Include your complaint number, e.g. BMC25-001690.</div>
        </div>
      ) : null}

      {d && !ask.error ? (
        <>
          <div className="rounded-2xl border border-[#A9BEF0] bg-[#EEF3FD] p-5">
            <SourceBadge source={d.source} />
            <p lang={d.language === "mr" ? "mr" : d.language === "hi" ? "hi" : "en"} className="mt-2 whitespace-pre-line text-[18px] leading-relaxed text-[#16181D]">{d.answer}</p>
            {d.status_note ? <p className="mt-3 border-t border-[#C9D7F5] pt-2 text-[13.5px] text-[#2A2D33]">{d.status_note}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi icon={FileText} label="Complaint" value={d.complaint.complaint_id} sub={`${when(d.complaint.received_at, false)} · ${d.complaint.channel}`} />
            <Kpi icon={Activity} label="Status" value={d.status} sub={d.complaint.category_reported} />
            {w ? (
              <>
                <Kpi icon={Wrench} label="Work order" value={w.work_order_id} sub={`${w.repair_method} · ${cleanName(w.contractor_name)}`} />
                <Kpi icon={IndianRupee} tone="#16298A" label="Billed" value={inr(w.cost_inr)} sub={`rate card ${inrFull(Math.round(w.expected_cost_inr))}`} />
                <Kpi
                  icon={RotateCcw}
                  label="Outcome"
                  value={w.reopened_within_30d === "Y" ? "Re-opened" : "Held"}
                  sub={`${w.sla_met === "Y" ? "on time" : "late"} · ${w.sla_hours} h SLA`}
                  tone={w.reopened_within_30d === "Y" ? "#8A5A00" : "#1E7B34"}
                />
              </>
            ) : (
              <div className="col-span-2 md:col-span-3">
                <Kpi icon={Wrench} label="Work order" value="Not linked to a work order yet" sub="No repair job has been recorded against this complaint" />
              </div>
            )}
          </div>

          {o ? (
            <Section title="Where it stands in the ward's repair plan" hint="Open complaints are matched to a road and ranked by public risk (candidate match, not an exact link).">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Kpi icon={MapPin} label="Road" value={o.road_name ?? o.road_id ?? "–"} sub={o.match_note} />
                <Kpi icon={ArrowDownUp} label="Priority" value={o.rank ? `${o.rank} of ${o.of}` : "–"} sub={`in the ward ${o.ward_code ?? ""} plan`} tone="#1E4FD8" />
                <Kpi icon={Gauge} label="Risk score" value={o.risk_score != null ? Number(o.risk_score).toFixed(1) : "–"} sub="0 to 100" />
              </div>
              {o.why ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {String(o.why).split("; ").filter(Boolean).map((c) => (
                    <span key={c} className="rounded-full border border-[#C9D7F5] bg-[#EEF3FD] px-2 py-0.5 text-[11.5px] text-[#17306E]">{c}</span>
                  ))}
                </div>
              ) : null}
            </Section>
          ) : null}

          <Section title="What you told BMC">
            <p className="text-[14px] leading-relaxed">{d.complaint.description}</p>
            <p className="mt-1 text-[12px] text-[#454952]">
              Ward {d.complaint.ward_code ?? "not recorded"} · language {d.complaint.language}
              {d.complaint.resolved_at ? ` · resolved ${when(d.complaint.resolved_at)}` : ""}
            </p>
          </Section>
        </>
      ) : null}
    </div>
  );
}
