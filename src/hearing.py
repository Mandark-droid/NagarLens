"""Fair hearing for one audit lead. Owner: Harsh.

Claude argues both sides from the lead's own fields and evidence: the Auditor (why it needs review) and the
Fairness advocate (legitimate context and limits of the data), then a neutral summary. It never chooses the
verdict (src.verdict does) and never changes a number. Every call goes through src.ai._call, so it is cached
and has a deterministic template fallback built from reason, fair_context and review_action.
"""
import json
import re

from src import ai
from src.verdict import recommend

HEARING_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["auditor", "fairness_advocate", "neutral_summary", "evidence_to_request"],
    "properties": {
        "auditor": {"type": "array", "items": {"type": "string"}},
        "fairness_advocate": {"type": "array", "items": {"type": "string"}},
        "neutral_summary": {"type": "string"},
        "evidence_to_request": {"type": "array", "items": {"type": "string"}},
    },
}

SYSTEM = (
    "You are the fairness layer of a civic road-repair audit tool for Mumbai's BMC. You receive one audit lead with "
    "its computed figures and evidence. Write a short hearing:\n"
    "- auditor: 2-3 short points giving the strongest reasons this bill needs review, quoting the record IDs.\n"
    "- fairness_advocate: 2-3 short points giving the strongest legitimate context or data limitation.\n"
    "- neutral_summary: one or two sentences explaining the recommended verdict you are given.\n"
    "- evidence_to_request: the documents that would resolve the lead.\n"
    "Rules: use only the supplied facts. Never change, round differently or invent any number, date, ID or name. "
    "Do not choose or change the verdict. Never use the words fraud, corrupt, scam, guilty, stolen or theft, and "
    "never suggest intent or blame: a lead is a reason to check records, not a finding. Say 'billed', never 'paid'."
)

FORBIDDEN = re.compile(r"\b(fraud\w*|corrupt\w*|scam\w*|guilt\w*|stole\w*|theft|intent\w*)\b", re.I)
KEYS = list(HEARING_SCHEMA["required"])


def _payload(finding: dict, evidence: dict) -> dict:
    keep = ["finding_id", "rule_id", "work_order_id", "ward_code", "road_id", "contractor", "amount_billed_inr",
            "amount_at_risk_inr", "observed", "baseline", "evidence_ids", "reason", "fair_context", "review_action",
            "dlp_scope"]
    ev = {k: evidence[k] for k in ("match", "rate_card") if evidence.get(k)}
    wo = evidence.get("work_order") or {}
    ev["work_order"] = {k: wo.get(k) for k in ("work_type", "repair_method", "area_sqm", "assigned_at", "completed_at",
                                                "under_dlp", "last_resurfaced", "reopened_within_30d", "sla_met")}
    if evidence.get("twin"):
        tw = evidence["twin"]
        ev["twin"] = {k: tw.get(k) for k in ("work_order_id", "cost_inr", "assigned_at", "contractor", "area_sqm")}
    return {"finding": {k: finding.get(k) for k in keep}, "evidence": ev,
            "recommended_verdict": recommend(finding)}


def template(finding: dict) -> dict:
    rec = recommend(finding)
    auditor = [finding.get("reason", ""), f"Observed: {finding.get('observed')} (baseline: {finding.get('baseline')})."]
    fair = [finding.get("fair_context", ""),
            "The dataset has no payment records or site photos, so this lead is a reason to check records, not a finding."]
    return {"auditor": [a for a in auditor if a], "fairness_advocate": [f for f in fair if f],
            "neutral_summary": rec["reason"],
            "evidence_to_request": rec["documents"] or [finding.get("review_action", "")]}


def _valid(out) -> bool:
    if not isinstance(out, dict) or not all(k in out for k in KEYS):
        return False
    return not FORBIDDEN.search(json.dumps({k: out[k] for k in KEYS}, ensure_ascii=False))


def hearing(finding: dict, evidence: dict) -> tuple[dict, str]:
    """Return (hearing, source). source is 'claude', 'cache', an alternative provider name, or 'template'."""
    payload = _payload(finding, evidence)
    user = "Audit lead and evidence (all figures computed by the audit, authoritative):\n" + json.dumps(
        payload, ensure_ascii=False, default=str, indent=1)
    out, source = ai._call("hearing", payload, SYSTEM, user, schema=HEARING_SCHEMA, max_tokens=900)
    if out is not None and _valid(out):
        return {k: out[k] for k in KEYS}, source
    return template(finding), "template"
