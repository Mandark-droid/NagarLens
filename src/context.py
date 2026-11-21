"""Rain context for scorecards: how each contractor or ward did on heavy-rain days versus everyone else.

Context only. Nothing here changes a scorecard chip (see src/scorecard.py for the chips).
"""
import pandas as pd

HEAVY_RAIN_MM = 64.5   # IMD "heavy rain" threshold, same value used in src/scorecard.py

CONTEXT_COLS = ["heavy_rain_jobs", "heavy_rain_job_share", "on_time_heavy_rain", "peer_on_time_heavy_rain",
                "on_time_dry", "peer_on_time_dry"]


def heavy_rain_flags(t: dict) -> pd.Series:
    """True for each work order whose assigned_at date had >= 64.5 mm at the wetter of the two stations."""
    wo = t["work_orders"]
    rain = t["rainfall_daily"].groupby("date").rainfall_mm.max()
    return wo.assigned_at.dt.normalize().map(rain).ge(HEAVY_RAIN_MM)


def rain_context(t: dict, group: str) -> pd.DataFrame:
    """One row per contractor_id or ward_code, indexed by `group`.

    on_time_* is the entity's own share of jobs that met the SLA (sla_met == "Y", same as the scorecard).
    peer_on_time_* is leave-one-out: all other entities' jobs on the same kind of day (heavy rain or dry).
    Rates are NaN when the entity, or its peers, had no jobs of that kind.
    """
    if group not in ("contractor_id", "ward_code"):
        raise ValueError(f"group must be contractor_id or ward_code, not {group!r}")
    wo = t["work_orders"]
    d = pd.DataFrame({"g": wo[group], "heavy": heavy_rain_flags(t),
                      "on_time": (wo.sla_met == "Y").astype(int)})

    # Jobs and on-time counts per entity, split by heavy-rain vs dry day
    jobs = d.pivot_table(index="g", columns="heavy", values="on_time", aggfunc="count", fill_value=0)
    met = d.pivot_table(index="g", columns="heavy", values="on_time", aggfunc="sum", fill_value=0)
    jobs, met = (x.reindex(columns=[True, False], fill_value=0) for x in (jobs, met))

    def rate(num, den):
        return num / den.where(den > 0)

    out = pd.DataFrame(index=jobs.index)
    out.index.name = group
    out["heavy_rain_jobs"] = jobs[True].astype(int)
    out["heavy_rain_job_share"] = jobs[True] / (jobs[True] + jobs[False])
    out["on_time_heavy_rain"] = rate(met[True], jobs[True])
    out["peer_on_time_heavy_rain"] = rate(met[True].sum() - met[True], jobs[True].sum() - jobs[True])
    out["on_time_dry"] = rate(met[False], jobs[False])
    out["peer_on_time_dry"] = rate(met[False].sum() - met[False], jobs[False].sum() - jobs[False])
    return out[CONTEXT_COLS]
