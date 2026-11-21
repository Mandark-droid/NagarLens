"""Strategy comparison: the same ward budget spent three ways. Feature owner: Aditya (idea from RaastaIQ).

All three strategies use the same open issues, the same cost estimates and methods (from road_risk), the same
budget, the same crew cap and the same warranty routing. Only the ORDER in which issues are funded differs:

    most_complaints   loudest first: number of complaints, then upvotes
    highest_severity  worst defect type first: severity, then number of complaints
    nagarlens_risk    the Next Rupee plan: risk score (severity, flood, traffic, hospitals/schools, accidents,
                      repeat failures, complaints, social posts)

The comparison reports coverage counts and sums of columns that already exist in road_risk(). It does not estimate
accidents prevented, lives saved or rupees saved: the dataset cannot support those numbers.
"""
import pandas as pd

from .budget import DEFAULT_WEIGHTS, PLAN_DAYS, allocate, default_budget, open_issues, road_risk

STRATEGIES = {"most_complaints": "Most complaints first",
              "highest_severity": "Highest severity first",
              "nagarlens_risk": "NagarLens risk plan"}
RULE = {"most_complaints": "Fund the issues with the most complaints, then the most upvotes.",
        "highest_severity": "Fund the most dangerous defect types first (cave-ins, open manholes), then by complaints.",
        "nagarlens_risk": "Fund by risk score: severity, flood, traffic, hospitals and schools, accidents, repeat failures."}
ORDER = {"most_complaints": (["complaints", "upvotes", "issue_id"], [False, False, True]),
         "highest_severity": (["severity", "complaints", "issue_id"], [False, False, True]),
         "nagarlens_risk": (["risk_score", "issue_id"], [False, True])}
HIGH_SEVERITY = 4     # waterlogging and above (road cave-in and open manhole are 5)
TOP_N = 10


def _measures(selected: list[dict], plan: dict, fundable_risk: float, top_ids: set) -> dict:
    return {
        "issues_funded": len(selected),
        "issues_deferred": len(plan["deferred"]),
        "warranty_routed": len(plan["dlp_routed"]),            # same for every strategy: routed before the budget
        "total_inr": int(plan["total_inr"]),                    # estimate: rate card x median historical area
        "unallocated_inr": int(plan["unallocated_inr"]),
        "risk_covered": round(float(sum(s["risk_score"] for s in selected)), 1),
        "risk_covered_share": round(float(sum(s["risk_score"] for s in selected)) / fundable_risk, 3) if fundable_risk else 0.0,
        "avg_risk_score": round(float(sum(s["risk_score"] for s in selected)) / len(selected), 1) if selected else 0.0,
        "top_risk_issues": len(top_ids & {s["issue_id"] for s in selected}),
        "hospital_road_issues": sum(1 for s in selected if s["hospitals"] > 0),
        "school_road_issues": sum(1 for s in selected if round(s["schools"]) > 0),
        "flood_hotspot_issues": sum(1 for s in selected if s["nearest_hotspot"]),
        "bus_route_issues": sum(1 for s in selected if s["bus_route"] == "Y"),
        "high_severity_issues": sum(1 for s in selected if s["severity"] >= HIGH_SEVERITY),
        "complaints_addressed": int(sum(s["complaints"] for s in selected)),
        "funded_issue_ids": [s["issue_id"] for s in selected],
    }


def compare(t: dict, ward: str, budget_inr: int | None, findings: pd.DataFrame, weights: dict | None = None) -> dict:
    """Spend the same budget three ways and report what each covers. Every strategy stays within the budget."""
    w = t["wards"].set_index("ward_code")
    default_inr, default_reason = default_budget(t, ward, findings)
    budget = int(default_inr if budget_inr is None else budget_inr)
    crew_jobs = int(w.engineering_crews[ward]) * PLAN_DAYS
    weights = {**DEFAULT_WEIGHTS, **(weights or {})}
    base = {"ward_code": ward, "budget_inr": budget, "default_budget_inr": int(default_inr),
            "default_budget_reason": default_reason, "crew_jobs": crew_jobs, "weights": weights}
    risk = road_risk(t, open_issues(t, ward), weights)
    if risk.empty:
        return {**base, "strategies": [], "candidates": 0, "fundable": 0, "backlog_inr": 0, "budget_binds": False,
                "identical": True, "overlap": [], "only_in_nagarlens": [], "summary": [], "top_n": TOP_N,
                "note": "No open issues in this ward.",
                "assumptions": []}

    fundable = risk[risk.est_cost_inr.notna() & (risk.under_dlp != "Y")]
    fundable_risk = float(fundable.risk_score.sum())
    top_ids = set(fundable.sort_values(["risk_score", "issue_id"], ascending=[False, True]).head(TOP_N).issue_id)
    rows, funded, plans = [], {}, {}
    for key, label in STRATEGIES.items():
        cols, asc = ORDER[key]
        plan = allocate(risk.sort_values(cols, ascending=asc, kind="mergesort"), budget, crew_jobs)
        plans[key] = plan
        funded[key] = {s["issue_id"] for s in plan["selected"]}
        rows.append({"key": key, "label": label, "rule": RULE[key], **_measures(plan["selected"], plan, fundable_risk, top_ids)})

    binds = any(r["issues_deferred"] > 0 for r in rows)
    identical = funded["most_complaints"] == funded["highest_severity"] == funded["nagarlens_risk"]
    others = funded["most_complaints"] | funded["highest_severity"]
    # What the risk plan funds that neither simpler rule does, with the reasons, so the difference is inspectable.
    only = [{"issue_id": s["issue_id"], "road_name": s["road_name"], "category_reported": s["category_reported"],
             "locality_text": s.get("locality_text"), "risk_score": float(s["risk_score"]),
             "est_cost_inr": int(s["est_cost_inr"]), "complaints": int(s["complaints"]), "why": s["why"]}
            for s in plans["nagarlens_risk"]["selected"] if s["issue_id"] not in others]
    if identical and not binds:
        note = ("The budget covers every fundable issue, so all three strategies fund the same list. "
                "Lower the budget to see how the order changes what gets fixed.")
    elif identical:
        note = "At this budget the three strategies happen to fund the same issues."
    else:
        note = "Same budget, same costs, same crews. Only the order of funding differs."
    by = {r["key"]: r for r in rows}
    n, c, sv = by["nagarlens_risk"], by["most_complaints"], by["highest_severity"]
    summary = []
    if not identical:   # say what the risk plan gains AND what it gives up, from the numbers above only
        summary.append(f"The risk plan funds {n['top_risk_issues']} of the ward's {TOP_N} highest-risk issues; "
                       f"complaints-first funds {c['top_risk_issues']} and severity-first {sv['top_risk_issues']}.")
        if c["issues_funded"] > n["issues_funded"]:
            summary.append(f"Complaints-first funds more issues ({c['issues_funded']} against {n['issues_funded']}) because it "
                           f"picks cheaper jobs, so its summed risk is {'higher' if c['risk_covered'] > n['risk_covered'] else 'lower'} "
                           f"({c['risk_covered']:.0f} against {n['risk_covered']:.0f}) while its average risk per funded issue is "
                           f"{'lower' if c['avg_risk_score'] < n['avg_risk_score'] else 'higher'} "
                           f"({c['avg_risk_score']:.1f} against {n['avg_risk_score']:.1f}).")
        if sv["issues_funded"] < n["issues_funded"]:
            summary.append(f"Severity-first spends the budget on fewer, costlier jobs ({sv['issues_funded']} issues).")
    return {**base, "strategies": rows, "summary": summary, "candidates": int(len(risk)), "fundable": int(len(fundable)),
            "backlog_inr": int(fundable.est_cost_inr.sum()), "budget_binds": binds, "identical": identical,
            "overlap": sorted(funded["most_complaints"] & funded["highest_severity"] & funded["nagarlens_risk"]),
            "only_in_nagarlens": only, "top_n": TOP_N, "note": note,
            "assumptions": ["All three strategies use the same issues, cost estimates, repair methods, budget, crew cap "
                            "and warranty routing. Only the funding order differs.",
                            "Cost = rate card x median historical repair area for the chosen method (estimate).",
                            "Risk covered = sum of the risk scores (0 to 100 each) of the funded issues; a coverage "
                            "measure, not a forecast of accidents or savings.",
                            f"Top-risk issues = how many of the ward's {TOP_N} highest-risk fundable issues are funded.",
                            "Hospital, school, flood-hotspot and bus-route counts come from the organizer's facilities, "
                            "flood_hotspots and roads tables."]}
