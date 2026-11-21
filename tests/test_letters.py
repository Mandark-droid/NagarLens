from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from src.audit import FLAG_RULES
from src.letters import CLOSING

BANNED = ["legal notice", "fraud", "penalty", "blacklist"]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def flag_findings(client):
    rows = client.get("/api/findings?limit=3000").json()["rows"]
    flags = [r for r in rows if r["rule_id"] in FLAG_RULES]
    assert {r["rule_id"] for r in flags} == set(FLAG_RULES)
    return flags


def test_every_flag_finding_has_a_letter(client, flag_findings):
    for f in flag_findings:
        r = client.get(f"/api/findings/{f['finding_id']}/letter")
        assert r.status_code == 200, f["finding_id"]
        body = r.json()
        md = body["markdown"]
        assert body["data_layer"] == "synthetic_organizer" and body["source"] == "template"
        assert f["work_order_id"] in md
        assert f"₹{f['amount_billed_inr']:,}" in md
        assert "(synthetic)" in md
        assert md.rstrip().endswith(CLOSING)
        assert "Please reply by" in md and "Evidence ids" in md
        lower = md.lower()
        assert not [w for w in BANNED if w in lower], f["finding_id"]
        assert " paid" not in lower


def test_letter_cites_rule_specific_amounts(client, flag_findings):
    by_rule = {r: next(f for f in flag_findings if f["rule_id"] == r) for r in FLAG_RULES}
    over = client.get(f"/api/findings/{by_rule['overbilled_vs_rate_card']['finding_id']}").json()["evidence"]
    md = client.get(f"/api/findings/{by_rule['overbilled_vs_rate_card']['finding_id']}/letter").json()["markdown"]
    assert f"₹{over['rate_card']['expected_cost_inr']:,}" in md and "measurement book" in md

    dup = client.get(f"/api/findings/{by_rule['duplicate_bill']['finding_id']}").json()["evidence"]
    md = client.get(f"/api/findings/{by_rule['duplicate_bill']['finding_id']}/letter").json()["markdown"]
    assert dup["twin"]["work_order_id"] in md and "Geotagged" in md


def test_dlp_letter_depends_on_scope(client, flag_findings):
    dlp = [f for f in flag_findings if f["rule_id"] == "dlp_paid_by_bmc"]
    for f in dlp:
        md = client.get(f"/api/findings/{f['finding_id']}/letter").json()["markdown"]
        if f["dlp_scope"] == "surface":
            assert "original resurfacing contractor" in md and "Warranty claim" in md
        else:
            assert "confirm DLP coverage" in md


def test_reply_by_is_deterministic():
    from src.letters import draft_letter
    f = {"rule_id": "dlp_paid_by_bmc", "finding_id": "X", "contractor": "A (synthetic)", "dlp_scope": "surface",
         "evidence_ids": "WO-1", "amount_at_risk_inr": 100}
    e = {"work_order": {"work_order_id": "WO-1", "cost_inr": 100, "road_name": "R", "road_id": "R1",
                        "ward_code": "A", "work_type": "Pothole", "repair_method": "m", "area_sqm": 1,
                        "assigned_at": "2026-07-01T00:00:00"}, "road": {"last_resurfaced": "2025-01-01"}}
    assert "2026-01-08" in draft_letter(f, e, today=date(2026, 1, 1))


def test_unknown_finding_is_404(client):
    assert client.get("/api/findings/NOPE/letter").status_code == 404
