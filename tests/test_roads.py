"""Road history API: totals must reconcile with the dataset, and one road page must add up to itself."""
import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_road_list_covers_every_road_and_reconciles(client, t, findings):
    rows = client.get("/api/roads").json()["rows"]
    wo = t["work_orders"]
    assert len(rows) == 291 == len(t["roads"])
    assert sum(r["jobs"] for r in rows) == len(wo)
    assert sum(r["billed_inr"] for r in rows) == int(wo.cost_inr.sum())
    assert sum(r["reopened"] for r in rows) == int((wo.reopened_within_30d == "Y").sum())
    # each flagged work order is counted once, under its largest lead
    once = findings.sort_values("amount_at_risk_inr", ascending=False).drop_duplicates("work_order_id")
    assert sum(r["review_inr"] for r in rows) == int(once.amount_at_risk_inr.sum())
    assert sum(r["review_jobs"] for r in rows) == findings.work_order_id.nunique()
    assert [r["billed_inr"] for r in rows] == sorted((r["billed_inr"] for r in rows), reverse=True)


def test_road_list_filters_by_ward(client, t):
    body = client.get("/api/roads", params={"ward": "F/N"}).json()
    assert body["data_layer"] == "synthetic_organizer"
    assert {r["ward_code"] for r in body["rows"]} == {"F/N"}
    assert len(body["rows"]) == int((t["roads"].ward_code == "F/N").sum())


def test_kurla_andheri_road_page(client, t):
    d = client.get("/api/roads/RD0220").json()
    wo = t["work_orders"][t["work_orders"].road_id == "RD0220"]
    assert d["road"]["road_name"] == "Kurla Andheri Road" and d["road"]["under_dlp"] == "Y"
    assert d["totals"]["jobs"] == 35 == len(d["work_orders"])
    assert d["totals"]["billed_inr"] == int(wo.cost_inr.sum()) == sum(w["cost_inr"] for w in d["work_orders"])
    assert d["totals"]["reopened"] == 6 == sum(w["reopened_within_30d"] == "Y" for w in d["work_orders"])
    assert sum(m["billed_inr"] for m in d["monthly"]) == d["totals"]["billed_inr"]
    assert sum(m["jobs"] for m in d["monthly"]) == 35
    assert sum(p["jobs"] for p in d["by_work_type"]) == 35
    assert len(d["complaints"]) == int(wo.n_linked_complaints.sum())
    assert d["findings"] and all(x["road_id"] == "RD0220" for x in d["findings"])
    assert all(o["road_id"] != "RD0220" for o in d["other_segments"])


def test_repeat_is_the_same_problem_within_30_days_of_the_previous_repair(client):
    orders = client.get("/api/roads/RD0220").json()["work_orders"]
    by_id = {w["work_order_id"]: w for w in orders}
    seen = set()
    for w in orders:                                   # assigned order
        prev = w["previous_work_order_id"]
        if w["work_type"] not in seen:
            assert prev is None and w["is_repeat"] is False
        else:
            assert by_id[prev]["work_type"] == w["work_type"]
            assert w["is_repeat"] == (w["days_since_previous"] <= 30)
        seen.add(w["work_type"])


def test_road_without_repairs_still_has_a_page(client):
    quiet = next(r for r in client.get("/api/roads").json()["rows"] if r["jobs"] == 0)
    d = client.get(f"/api/roads/{quiet['road_id']}").json()
    assert d["work_orders"] == [] and d["monthly"] == [] and d["totals"]["billed_inr"] == 0
    assert quiet["reopen_rate"] is None


def test_unknown_road_is_404(client):
    assert client.get("/api/roads/RD9999").status_code == 404
