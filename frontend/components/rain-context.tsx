/* eslint-disable @typescript-eslint/no-explicit-any */
import { pct } from "@/lib/format";

// Context line under a scorecard. Row comes from GET /api/scorecards/{kind}/context; nothing is computed here.
// A job counts as heavy rain when the wetter of the two stations had at least 64.5 mm on its assigned date.
export function RainContext({ row }: { row?: any }) {
  if (!row) return null;
  return (
    <p className="mt-2 text-[12.5px] text-[#454952]">
      <b className="text-[#2A2D33]">Context:</b> {row.heavy_rain_jobs} jobs on heavy-rain days ({pct(row.heavy_rain_job_share)} of jobs):{" "}
      {pct(row.on_time_heavy_rain)} on time, others on the same days {pct(row.peer_on_time_heavy_rain)}. Dry days:{" "}
      {pct(row.on_time_dry)} on time, others {pct(row.peer_on_time_dry)}.
    </p>
  );
}
