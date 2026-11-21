"""Evidence-request letters for audit leads. Deterministic templates: every id, date and amount is copied from
the finding and evidence returned by GET /api/findings/{finding_id}. A letter is a request, never a notice."""
from datetime import date, timedelta

REPLY_DAYS = 7
CLOSING = "This is a request for information, not a finding of wrongdoing."
LETTER_RULES = ("duplicate_bill", "overbilled_vs_rate_card", "dlp_paid_by_bmc")


def _inr(x) -> str:
    return f"₹{float(x):,.0f}"


def _day(iso) -> str:
    return str(iso)[:10] if iso else "date not recorded"


def _road(wo: dict) -> str:
    return f"{wo.get('road_name')} ({wo.get('road_id')}), ward {wo.get('ward_code')}"


def _job(wo: dict) -> str:
    return (f"Work order {wo['work_order_id']}: {wo.get('work_type')} by {wo.get('repair_method')}, "
            f"assigned {_day(wo.get('assigned_at'))}, {wo.get('area_sqm')} sqm, billed {_inr(wo['cost_inr'])}")


def draft_letter(finding: dict, evidence: dict, today: date | None = None) -> str:
    """Markdown letter for one finding. `finding` and `evidence` are the API's finding and evidence dicts."""
    rule = finding["rule_id"]
    if rule not in LETTER_RULES:
        raise ValueError(f"No letter template for rule {rule!r}")
    wo = evidence["work_order"]
    contractor = finding.get("contractor") or wo.get("contractor_name")
    contractor = contractor if "(synthetic)" in str(contractor) else f"{contractor} (synthetic)"
    reply_by = (today or date.today()) + timedelta(days=REPLY_DAYS)

    if rule == "duplicate_bill":
        twin = evidence.get("twin")
        to = contractor
        subject = f"Request for evidence of two separate visits: {wo['work_order_id']}"
        lines = [f"Two work orders on {_road(wo)} describe the same repair and were billed for similar amounts:", "",
                 f"- {_job(wo)}"]
        if twin:
            m = evidence.get("match", {})
            lines += [f"- {_job(twin)}", "",
                      f"They were assigned {m.get('days_apart')} day(s) apart and their billed amounts differ by "
                      f"{m.get('cost_difference', 0) * 100:.1f}%. Work order {wo['work_order_id']} has no linked "
                      "citizen complaint."]
        lines += ["", "To confirm these were two separate visits, please send:",
                  "1. Site records (attendance or vehicle log) for each visit.",
                  "2. Geotagged, dated photographs of the repaired location from each visit.",
                  "3. The measurement book entries for both work orders."]

    elif rule == "overbilled_vs_rate_card":
        rc = evidence["rate_card"]
        to = contractor
        subject = f"Request for measurement book and site photos: {wo['work_order_id']}"
        lines = [f"{_job(wo)}, on {_road(wo)}.", "",
                 f"- Billed: {_inr(rc['billed_inr'])} ({rc['cost_ratio']}× the rate card)",
                 f"- Rate-card cost: {_inr(rc['expected_cost_inr'])} ({rc['basis']})",
                 f"- Upper end of normal ({rc['tolerance_ratio']}×): {_inr(rc['tolerance_inr'])}",
                 f"- Difference to review: {_inr(finding['amount_at_risk_inr'])}", "",
                 "The job may have had extra scope that the record does not show. To confirm the billed quantity, "
                 "please send:",
                 "1. The measurement book for this job.",
                 "2. Dated site photographs before, during and after the repair."]

    else:  # dlp_paid_by_bmc
        road = evidence.get("road", {})
        resurfaced = _day(road.get("last_resurfaced"))
        if finding.get("dlp_scope") == "surface":
            to = "The original resurfacing contractor\n**Copy:** Holder of the DLP register, Roads Department"
            subject = f"Warranty claim under the Defect Liability Period: {wo['work_order_id']}"
            lines = [f"{_road(wo)} was last resurfaced on {resurfaced} and is still within its Defect Liability "
                     "Period.", "",
                     f"- {_job(wo)}, carried out by {contractor} and billed to BMC.", "",
                     "This is surface work that a resurfacing warranty normally covers. We ask the original "
                     "resurfacing contractor to:",
                     "1. Confirm whether this defect falls within the warranty.",
                     "2. If it does, rectify it or reimburse the billed amount under the DLP terms."]
        else:
            to = "Holder of the DLP register, Roads Department"
            subject = f"Request to confirm DLP coverage: {wo['work_order_id']}"
            lines = [f"{_road(wo)} was last resurfaced on {resurfaced} and is still within its Defect Liability "
                     "Period.", "",
                     f"- {_job(wo)}, carried out by {contractor} and billed to BMC.", "",
                     f"This was {str(wo.get('work_type')).lower()} work, which a resurfacing warranty may not cover. "
                     "Please confirm:",
                     "1. Whether the DLP contract for this road covers this kind of work.",
                     "2. If it does, the contractor responsible for rectification."]

    evidence_ids = " · ".join(str(finding["evidence_ids"]).split("|"))
    return "\n".join([
        f"# {subject}", "",
        f"**To:** {to}",
        f"**Contractor on record:** {contractor}",
        f"**Reference:** audit lead {finding['finding_id']} (needs review, synthetic data)", "",
        *lines, "",
        f"**Evidence ids:** {evidence_ids}",
        f"**Please reply by:** {reply_by.isoformat()} ({REPLY_DAYS} days from this letter)", "",
        "---", "",
        CLOSING, ""])
