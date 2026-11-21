import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Small shared building blocks. Colour meaning is the same everywhere:
// green = held, amber = failed, orange = needs review, purple = warranty, blue = neutral accent.

export function Kpi({ label, value, sub, tone, icon: Icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; icon?: LucideIcon }) {
  // Pastel tile tinted by its meaning colour; the value stays in dark ink so it reads on every tint.
  return (
    <div className="nl-tile flex flex-col gap-2 rounded-2xl px-4 py-3.5 sm:flex-row sm:items-start sm:gap-3" style={{ "--tile": tone ?? "#1E4FD8" } as React.CSSProperties}>
      {Icon ? (
        <span className="nl-chip mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[#3A3F4A]">{label}</div>
        <div className="whitespace-nowrap text-[24px] font-extrabold leading-tight tracking-tight text-[#16181D] sm:text-[26px]">{value}</div>
        {sub ? <div className="text-[12px] text-[#3A3F4A]">{sub}</div> : null}
      </div>
    </div>
  );
}

// Every number carries its data layer. Today the only layer is the organizer's synthetic dataset.
export function DataBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-full bg-[#E4E4DE] px-2.5 py-0.5 text-[11px] font-bold text-[#2A2D33]", className)}>
      Synthetic (organizer)
    </span>
  );
}

const CHIP_TONE: Record<string, string> = {
  "better than peers": "border-[#1E7B34] text-[#1E5B1F] bg-[#E5F4E4]",
  "in line with peers": "border-[#B9BDC6] text-[#2A2D33] bg-[#F1F1EC]",
  "below peers": "border-[#B07A00] text-[#7A4B00] bg-[#F9EEDA]",
};

export function PeerChip({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("flex-1 rounded-lg border px-3 py-2 text-[13px]", CHIP_TONE[value] ?? CHIP_TONE["in line with peers"])}>
      <div className="text-[11px] font-bold uppercase tracking-wide">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export function Pill({ children, color = "#2A2D33", bg = "#E4E4DE" }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ color, background: bg }}>
      {children}
    </span>
  );
}

export function SourceBadge({ source }: { source?: string }) {
  const claude = source === "claude" || source === "cache";
  return (
    <Pill color={claude ? "#17306E" : "#454952"} bg={claude ? "#E3EBFD" : "#EDEDE8"}>
      {claude ? "Written by Claude" : "Template (Claude offline)"}
    </Pill>
  );
}

export function Section({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="nl-card rounded-3xl p-5 sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-extrabold tracking-tight text-[#16181D]">{title}</h2>
          {hint ? <p className="text-[12.5px] text-[#454952]">{hint}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="nl-card animate-pulse rounded-3xl p-6 text-sm text-[#454952]">{label}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-[#E9A988] bg-[#FFF3EC] p-4 text-sm text-[#7A2A08]">
      <b>Could not reach the API.</b> Start it with{" "}
      <code className="rounded bg-white px-1">.venv/Scripts/python -m uvicorn backend.main:app --port 8000</code> from the repo root.
      <div className="mt-1 opacity-80">{String((error as Error)?.message ?? error)}</div>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-[28px] font-extrabold tracking-tight text-[#16181D]">{title}</h1>
      {sub ? <p className="text-[13.5px] text-[#454952]">{sub}</p> : null}
    </div>
  );
}
