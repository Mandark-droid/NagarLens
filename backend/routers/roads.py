"""Road history: every repair on one road segment, what it cost and whether the fix lasted."""
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from src.data import haversine_m

from ..deps import DATA_LAYER, RULE_LABEL, clean_contractor, record, records, state
from .cases import C_COLS

router = APIRouter(tags=["roads"])

REPEAT_WINDOW_DAYS = 30     # same window as the dataset's reopened_within_30d flag
HOTSPOT_RADIUS_M = 500
ROAD_COLS = ["road_id", "road_name", "segment_no", "ward_code", "road_type", "surface", "lanes", "length_m",
             "start_lat", "start_lon", "end_lat", "end_lon", "last_resurfaced", "under_dlp", "bus_route"]
WO_COLS = ["work_order_id", "assigned_at", "completed_at", "work_type", "repair_method", "contractor_id", "area_sqm",
           "cost_inr", "expected_cost_inr", "cost_ratio", "sla_hours", "sla_met", "reopened_within_30d",
           "n_linked_complaints", "engineer_remark"]


def _review_by_work_order(findings: pd.DataFrame) -> pd.DataFrame:
    """One row per flagged work order (its largest lead), so a job with two leads is counted once."""
    return findings.sort_values("amount_at_risk_inr", ascending=False).drop_duplicates("work_order_id")


@router.get("/roads")
def roads(ward: str | None = None, limit: int = Query(300, le=500)):
    """Road segments with their repair totals, highest billed first."""
    s = state()
    rd, wo = s["t"]["roads"], s["t"]["work_orders"]
    by = wo.groupby("road_id").agg(jobs=("work_order_id", "count"), billed_inr=("cost_inr", "sum"),
                                   reopened=("reopened_within_30d", lambda x: int((x == "Y").sum())))
    review = _review_by_work_order(s["findings"]).groupby("road_id").agg(
        review_inr=("amount_at_risk_inr", "sum"), review_jobs=("work_order_id", "count"))
    out = rd[["road_id", "road_name", "segment_no", "ward_code", "road_type", "surface", "under_dlp", "bus_route"]].merge(
        by, on="road_id", how="left").merge(review, on="road_id", how="left")
    counts = ["jobs", "billed_inr", "reopened", "review_inr", "review_jobs"]
    out[counts] = out[counts].fillna(0).round().astype(int)
    out["reopen_rate"] = (out.reopened / out.jobs).where(out.jobs > 0)
    if ward:
        out = out[out.ward_code == ward]
    out = out.sort_values(["billed_inr", "road_id"], ascending=[False, True]).head(limit)
    return {"data_layer": DATA_LAYER, "rows": records(out)}


@router.get("/roads/{road_id}")
def road(road_id: str):
    s = state()
    t, f = s["t"], s["findings"]
    rd = t["roads"]
    hit = rd[rd.road_id == road_id]
    if hit.empty:
        raise HTTPException(404, f"Unknown road {road_id}")
    r = hit.iloc[0]

    wo = t["work_orders"]
    hist = wo[wo.road_id == road_id].sort_values(["assigned_at", "work_order_id"])
    fr = f[f.road_id == road_id]
    flags = fr.groupby("work_order_id").rule_id.apply(lambda x: [RULE_LABEL[k] for k in x])

    h = hist[WO_COLS].copy()
    h["contractor"] = hist.contractor_name.map(clean_contractor)
    h["flags"] = h.work_order_id.map(flags).apply(lambda v: v if isinstance(v, list) else [])
    # Repeat = the same problem on this segment, assigned within 30 days of the previous repair being completed
    # (a negative gap means the previous job was still open). Context for the reader, never an audit flag.
    same = hist.groupby("work_type")
    h["previous_work_order_id"] = same.work_order_id.shift(1)
    h["days_since_previous"] = ((hist.assigned_at - same.completed_at.shift(1)).dt.total_seconds() / 86400).round(1)
    h["is_repeat"] = h.days_since_previous <= REPEAT_WINDOW_DAYS

    monthly = []
    if len(hist):
        m = hist.completed_at.dt.to_period("M")
        failed = hist.reopened_within_30d == "Y"
        for p in pd.period_range(m.min(), m.max(), freq="M"):
            g, gf = hist[m == p], hist[(m == p) & failed]
            monthly.append({"month": str(p), "billed_inr": int(g.cost_inr.sum()), "jobs": int(len(g)),
                            "reopened": int(len(gf)), "reopened_billed_inr": int(gf.cost_inr.sum())})

    c = t["complaints"]
    cc = c[c.work_order_id.isin(hist.work_order_id)].sort_values("received_at")
    acc = t["accidents"][t["accidents"].road_id == road_id]
    fac = t["facilities"][t["facilities"].ambulance_entry_road == road_id]
    tr = t["traffic"][t["traffic"].road_id == road_id]
    hs = t["flood_hotspots"].copy()
    hs["distance_m"] = [round(haversine_m(r.mid_lat, r.mid_lon, a, b)) for a, b in zip(hs.lat, hs.lon)]
    hs = hs[hs.distance_m <= HOTSPOT_RADIUS_M].sort_values("distance_m")
    siblings = rd[(rd.road_name == r.road_name) & (rd.road_id != road_id)].sort_values(["ward_code", "segment_no"])

    failed_all = hist.reopened_within_30d == "Y"
    return {
        "data_layer": DATA_LAYER,
        "road": record(r[ROAD_COLS]),
        "traffic": record(tr.iloc[0]) if len(tr) else None,
        "facilities": records(fac[["facility_id", "type", "name", "beds_or_students", "emergency_services"]]),
        "flood_hotspots_nearby": records(hs[["hotspot_id", "name", "distance_m", "flood_threshold_mm_per_day"]]),
        "accidents": {"total": int(len(acc)), "by_cause": acc.probable_cause.value_counts().to_dict(),
                      "by_severity": acc.severity.value_counts().to_dict()},
        "totals": {"jobs": int(len(hist)), "billed_inr": int(hist.cost_inr.sum()), "reopened": int(failed_all.sum()),
                   "reopened_billed_inr": int(hist[failed_all].cost_inr.sum()),
                   "repeat_jobs": int(h.is_repeat.sum()), "sla_met": int((hist.sla_met == "Y").sum()),
                   "review_inr": int(_review_by_work_order(fr).amount_at_risk_inr.sum()),
                   "review_jobs": int(fr.work_order_id.nunique())},
        "by_work_type": [{"work_type": k, "jobs": int(len(g)), "billed_inr": int(g.cost_inr.sum()),
                          "reopened": int((g.reopened_within_30d == "Y").sum()),
                          "repeat_jobs": int(h.loc[g.index, "is_repeat"].sum())}
                         for k, g in sorted(hist.groupby("work_type"), key=lambda kv: -len(kv[1]))],
        "work_orders": records(h),
        "complaints": records(cc[C_COLS]),
        "findings": records(fr.assign(rule=fr.rule_id.map(RULE_LABEL))),
        "monthly": monthly,
        "other_segments": records(siblings[["road_id", "segment_no", "ward_code"]]),
    }
