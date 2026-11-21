"""Recommended verdict, fair hearing and receipt feedback (docs/tasks/harsh.md)."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from backend.db import DECISIONS, get_session
from src.audit import DLP_OTHER, DLP_SURFACE, recovery_summary
from src.hearing import FORBIDDEN, KEYS, hearing, template
from src.verdict import recommend, recommend_work_order, summary


def test_every_finding_gets_a_known_decision(findings_all):
    for r in findings_all.to_dict("records"):
        assert recommend(r)["decision"] in DECISIONS


def test_rule_mappings():
    assert recommend({"rule_id": "duplicate_bill", "severity": "review"})["decision"] == "hold_for_evidence"
    assert recommend({"rule_id": "dlp_paid_by_bmc", "severity": "review", "dlp_scope": DLP_SURFACE})["decision"] == "return_under_warranty"
    assert recommend({"rule_id": "dlp_paid_by_bmc", "severity": "review", "dlp_scope": DLP_OTHER})["decision"] == "hold_for_evidence"
    over = recommend({"rule_id": "overbilled_vs_rate_card", "severity": "review", "observed": "1.45x rate card (borderline)",
                      "amount_at_risk_inr": 1000})
    assert over["decision"] == "hold_for_evidence" and "measurement book first" in over["reason"].lower()
    assert recommend(None)["decision"] == "release_payment"
    assert recommend({"rule_id": "reopened_fix", "severity": "informational"})["decision"] == "release_payment"


def test_documents_listed_for_every_hold_or_warranty(findings):
    for r in findings.to_dict("records"):
        rec = recommend(r)
        assert rec["documents"], r["finding_id"]


def test_summary_counts_each_work_order_once_and_adds_up(findings):
    rows = summary(findings)
    assert {r["decision"] for r in rows} == set(DECISIONS)
    total = sum(r["amount_at_risk_inr"] for r in rows)
    assert total == recovery_summary(findings)["total_at_risk_inr"] == 32_224_600
    assert sum(r["jobs"] for r in rows) == findings.work_order_id.nunique()


def test_work_order_precedence(findings):
    multi = findings.groupby("work_order_id").rule_id.nunique()
    wo = multi[multi > 1].index
    for w in wo:
        rules = set(findings[findings.work_order_id == w].rule_id)
        dec = recommend_work_order(findings, w)["decision"]
        surface = ((findings.work_order_id == w) & (findings.rule_id == "dlp_paid_by_bmc") & (findings.dlp_scope == DLP_SURFACE)).any()
        assert dec == ("return_under_warranty" if surface else "hold_for_evidence"), (w, rules)
    assert recommend_work_order(findings, "NO-SUCH-WO")["decision"] == "release_payment"


def test_demo_lead_is_a_duplicate_on_hold(findings):
    row = findings[findings.finding_id == "AUD-0112"].iloc[0].to_dict()
    assert row["work_order_id"] == "WO25-02485" and row["rule_id"] == "duplicate_bill"
    assert recommend(row)["decision"] == "hold_for_evidence"


def test_template_hearing_is_complete_and_neutral(findings):
    for r in findings.to_dict("records"):
        h = template(r)
        assert all(h[k] for k in KEYS)
        assert not FORBIDDEN.search(str(h))


def test_hearing_falls_back_without_claude(findings, monkeypatch):
    from src import ai
    monkeypatch.setattr(ai, "_call", lambda *a, **k: (None, None))
    row = findings.iloc[0].to_dict()
    out, source = hearing(row, {})
    assert source == "template" and set(out) == set(KEYS)


def test_hearing_rejects_blame_language(findings, monkeypatch):
    from src import ai
    bad = {"auditor": ["This is fraud."], "fairness_advocate": ["x"], "neutral_summary": "x", "evidence_to_request": ["x"]}
    monkeypatch.setattr(ai, "_call", lambda *a, **k: (bad, "claude"))
    _, source = hearing(findings.iloc[0].to_dict(), {})
    assert source == "template"


@pytest.fixture(scope="module")
def client():
    from backend.main import app
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def _session():
        with Session(engine) as s:
            yield s
    app.dependency_overrides[get_session] = _session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_api_verdict_hearing_summary(client):
    v = client.get("/api/findings/AUD-0112/verdict").json()
    assert v["recommended"]["decision"] == "hold_for_evidence" and v["data_layer"] == "synthetic_organizer"
    h = client.get("/api/findings/AUD-0112/hearing").json()
    assert set(KEYS) <= set(h) and h["source"]
    s = client.get("/api/verdicts/summary").json()
    assert sum(r["amount_at_risk_inr"] for r in s["rows"]) == 32_224_600
    assert client.get("/api/findings/NOPE/verdict").status_code == 404


def test_api_receipt_feedback_creates_warranty_case_on_dlp_road(client, t):
    wo = t["work_orders"]
    dlp_wo = wo[wo.under_dlp == "Y"].iloc[0].work_order_id
    other = wo[wo.under_dlp != "Y"].iloc[0].work_order_id
    r = client.post(f"/api/receipts/{dlp_wo}/feedback", json={"answer": "failed", "note": "pothole is back"}).json()
    assert r["feedback"]["warranty_case"] is True and "₹0 to BMC" in r["message"]
    assert r["data_layer"] == "synthetic_nagarlens"
    r2 = client.post(f"/api/receipts/{other}/feedback", json={"answer": "failed"}).json()
    assert r2["feedback"]["warranty_case"] is False
    assert client.post(f"/api/receipts/{other}/feedback", json={"answer": "maybe"}).status_code == 422
