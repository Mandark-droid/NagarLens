import type { LucideIcon } from "lucide-react";

import "./road-ui.css";

// blue and navy are neutral; the other tones carry the app-wide meaning (amber failed, orange review, purple warranty).
export type Tone = "blue" | "navy" | "failed" | "review" | "warranty";

/** Raised, tinted headline number with an icon chip. Display only: the value arrives already computed by the API. */
export function StatTile({ label, value, note, tone, Icon }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone: Tone; Icon: LucideIcon }) {
  return (
    <div className="road-tile flex items-start gap-3 rounded-2xl p-4" data-tone={tone}>
      <span className="road-chip grid size-11 shrink-0 place-items-center rounded-xl">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[26px] font-extrabold leading-tight tracking-tight text-[#16181D]">{value}</div>
        <div className="text-[13.5px] font-semibold text-[#16181D]">{label}</div>
        {note ? <div className="mt-0.5 text-[12px] text-[#454952]">{note}</div> : null}
      </div>
    </div>
  );
}
