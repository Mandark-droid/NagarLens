"""Recommended three-way verdict for audit leads. Owner: Harsh. Deterministic; Claude never chooses a verdict.

Rules (one per audit rule, applied to a single finding):
    duplicate_bill                                   -> hold_for_evidence
        documents: site records for two separate visits, geotagged before/after photos, measurement book
    dlp_paid_by_bmc, dlp_scope == "surface"          -> return_under_warranty
        documents: DLP register entry for the road
    dlp_paid_by_bmc, drainage/manhole scope          -> hold_for_evidence
        documents: the DLP contract scope (does it cover drainage/manhole work?)
    overbilled_vs_rate_card                          -> hold_for_evidence for the amount above 1.3x the rate card
        documents: measurement book, site photos; if borderline, the measurement book is checked first
    a work order with no lead                        -> release_payment

A work order caught by several rules gets one verdict, by precedence:
    return_under_warranty > hold_for_evidence > release_payment
and is counted once, at its largest amount at risk (same de-duplication as src.audit.recovery_summary).

"Release payment" is a recommendation label. The dataset has no payment records; amounts are billed amounts.
The officer decides; this module only recommends.
"""
import pandas as pd

from src.audit import DLP_SURFACE, RULE_LABEL, TOLERANCE_RATIO

DECISIONS = ["release_payment", "hold_for_evidence", "return_under_warranty"]
PRECEDENCE = {"return_under_warranty": 2, "hold_for_evidence": 1, "release_payment": 0}

DOCS_DUPLICATE = ["Site records showing two separate visits", "Geotagged before/after photos for both jobs",
                  "Measurement book entries for both jobs"]
DOCS_DLP_SURFACE = ["DLP register entry for the road (original resurfacing contractor and end date)"]
DOCS_DLP_OTHER = ["DLP contract scope: does it cover drainage and manhole work?"]
DOCS_OVERBILL = ["Measurement book entry", "Geotagged site photos", "Approval for any extra scope or rate deviation"]


def recommend(finding: dict | None) -> dict:
    """Recommend one verdict for a single audit finding (or release_payment when there is no lead)."""
    if not finding or finding.get("severity", "review") != "review":
        return {"decision": "release_payment", "rule": None,
                "reason": "No audit rule flags this work order, so the normal billing process can continue.",
                "documents": []}
    rule = finding["rule_id"]
    label = RULE_LABEL.get(rule, rule)
    if rule == "duplicate_bill":
        return {"decision": "hold_for_evidence", "rule": rule,
                "reason": f"{label}: a matching job on the same road has no complaint behind this one. "
                          "Hold until site records show two separate visits.",
                "documents": DOCS_DUPLICATE}
    if rule == "dlp_paid_by_bmc":
        if finding.get("dlp_scope") == DLP_SURFACE:
            return {"decision": "return_under_warranty", "rule": rule,
                    "reason": f"{label}: the road is still under its Defect Liability Period and this is surface work, "
                              "so the original resurfacing contractor should repair it at ₹0 to BMC.",
                    "documents": DOCS_DLP_SURFACE}
        return {"decision": "hold_for_evidence", "rule": rule,
                "reason": f"{label}: the road is under its Defect Liability Period, but drainage or manhole work may "
                          "fall outside a surfacing warranty. Hold until the DLP contract scope is checked.",
                "documents": DOCS_DLP_OTHER}
    if rule == "overbilled_vs_rate_card":
        borderline = "borderline" in str(finding.get("observed", ""))
        at_risk = int(finding.get("amount_at_risk_inr") or 0)
        reason = (f"{label}: hold ₹{at_risk:,} (the amount above {TOLERANCE_RATIO}× the rate card) until the extra "
                  "scope is documented.")
        docs = list(DOCS_OVERBILL)
        if borderline:
            reason += " Borderline case: check the measurement book first before treating it as an overcharge."
            docs = ["Measurement book entry (check this first)"] + docs[1:]
        return {"decision": "hold_for_evidence", "rule": rule, "reason": reason, "documents": docs}
    return {"decision": "hold_for_evidence", "rule": rule, "reason": f"{label}: needs review.", "documents": []}


def recommend_work_order(findings: pd.DataFrame, work_order_id: str) -> dict:
    """One verdict per work order, by precedence across all of its review leads."""
    f = findings[(findings.work_order_id == work_order_id) & (findings.severity == "review")]
    recs = [recommend(r) for r in f.to_dict("records")] or [recommend(None)]
    return max(recs, key=lambda r: PRECEDENCE[r["decision"]])


def summary(findings: pd.DataFrame) -> list[dict]:
    """Jobs and rupees per recommended verdict, each work order counted once at its largest amount at risk."""
    flags = findings[findings.severity == "review"] if "severity" in findings else findings
    if flags.empty:
        return [{"decision": d, "jobs": 0, "amount_at_risk_inr": 0} for d in DECISIONS]
    per_wo = (flags.assign(decision=[recommend(r)["decision"] for r in flags.to_dict("records")],
                           rank=lambda d: d.decision.map(PRECEDENCE))
              .groupby("work_order_id").agg(rank=("rank", "max"), amount_at_risk_inr=("amount_at_risk_inr", "max")))
    inv = {v: k for k, v in PRECEDENCE.items()}
    per_wo["decision"] = per_wo["rank"].map(inv)
    g = per_wo.groupby("decision").agg(jobs=("amount_at_risk_inr", "size"), amount_at_risk_inr=("amount_at_risk_inr", "sum"))
    return [{"decision": d, "jobs": int(g.jobs.get(d, 0)), "amount_at_risk_inr": int(g.amount_at_risk_inr.get(d, 0))}
            for d in DECISIONS]
