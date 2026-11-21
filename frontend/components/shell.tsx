"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useWard } from "@/app/providers";
import { api } from "@/lib/api";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

// The navigation follows the brief's questions. Add a page: create app/<route>/page.tsx and add it here.
export const NAV = [
  { href: "/", label: "Where did the money go?" },
  { href: "/case", label: "Follow one case" },
  { href: "/roads", label: "Road history" },
  { href: "/audit", label: "What doesn't add up?" },
  { href: "/scorecards", label: "Who is responsible?" },
  { href: "/next-rupee", label: "Where should the next rupee go?" },
  { href: "/ask", label: "Ask about my complaint" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { ward, setWard } = useWard();
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api("/overview") });
  const wards = useQuery({ queryKey: ["wards"], queryFn: () => api("/wards") });
  const health = useQuery({ queryKey: ["health"], queryFn: () => api("/health") });
  const o = overview.data;
  const w = wards.data?.rows?.find((r: any) => r.ward_code === ward);

  return (
    <div className="min-h-screen text-[#16181D]">
      <header className="mx-auto max-w-[1280px] px-5 pt-5">
        {/* Hero: the whole pitch on first paint. Illustration generated with Codex (public/hero.png). */}
        <div
          className="nl-hero relative overflow-hidden rounded-3xl bg-[#0E1B4D] px-7 py-6 text-[#F6F6F3]"
          style={{
            backgroundImage:
              "linear-gradient(90deg,#0E1B4D 0%,#13267A 52%,rgba(19,38,122,.62) 72%,rgba(19,38,122,.08) 100%),url(/hero.png)",
            backgroundSize: "cover",
            backgroundPosition: "right center",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-y-1 text-[13px] font-semibold tracking-wide text-[#D3D9EE]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" width={34} height={34} className="mr-2 h-[34px] w-[34px] rounded-lg bg-white p-0.5" />
              <span className="text-[17px] font-extrabold text-white">Nagar</span>
              <span className="text-[17px] font-extrabold text-[#FF9B6A]">Lens</span>
              <span className="w-full md:ml-2 md:w-auto">Follow every rupee from a complaint to a fix that held</span>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 text-[12px] md:w-auto">
              <span className="whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1">
                {health.data?.ai_available ? `AI: ${health.data.ai_engine}` : "AI offline: cached answers + templates"}
              </span>
              <label className="flex min-h-9 w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold text-[#16181D] md:w-auto">
                Ward
                <select value={ward} onChange={(e) => setWard(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none md:max-w-[210px]" aria-label="Ward">
                  {(wards.data?.rows ?? [{ ward_code: "L", ward_name: "Kurla" }]).map((r: any) => (
                    <option key={r.ward_code} value={r.ward_code}>
                      {r.ward_code} · {r.ward_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-7 gap-y-3">
            <Stat label="All wards · billed for 2025 monsoon road repairs" value={o ? inr(o.billed_inr) : "…"} />
            <span aria-hidden className="hidden pb-1 text-[26px] text-[#9AA6CF] md:inline">→</span>
            <Stat label="All wards · needs a second look (3 rules, counted once)" value={o ? inr(o.review.total_at_risk_inr) : "…"} tone="#FF9B6A" />
            <span aria-hidden className="hidden pb-1 text-[26px] text-[#9AA6CF] md:inline">→</span>
            <div>
              <div className="text-[12px] text-[#D3D9EE]">
                {w ? `Ward ${ward}: ${inr(w.total_review_inr)} to review, then reinvest by risk` : "Recover, then reinvest by risk"}
              </div>
              <Link
                href="/next-rupee"
                className="mt-1 inline-flex min-h-11 items-center rounded-xl bg-[#7FD99A] px-4 text-[18px] font-extrabold text-[#0F2A17] hover:bg-[#9BE5B0]"
              >
                See the next-rupee plan →
              </Link>
            </div>
          </div>
          <div className="mt-3 text-[11.5px] text-[#D3D9EE]">
            Synthetic organizer data · all contractors fictional · leads for review, not accusations
          </div>
        </div>
        <nav aria-label="Pages" className="nl-nav mt-4 flex flex-nowrap gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
                  active ? "bg-[#1E4FD8] text-white shadow-[0_8px_16px_-8px_rgb(30_79_216/0.8)]" : "text-[#3A3F4A] hover:bg-white hover:text-[#16181D]",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-[1280px] px-5 py-5">{children}</main>
      <footer className="mx-auto max-w-[1280px] px-5 pb-8 text-[12px] text-[#454952]">
        NagarLens · Team 11 · Claude Impact Lab Mumbai · Dataset: “Follow the Rupee: Mumbai Monsoon Roads” (synthetic, CC BY 4.0). Do not
        use this to judge any real person, contractor or department.
      </footer>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[12px] text-[#D3D9EE]">{label}</div>
      <div className="text-[30px] font-extrabold leading-tight" style={{ color: tone ?? "#FFFFFF" }}>
        {value}
      </div>
    </div>
  );
}
