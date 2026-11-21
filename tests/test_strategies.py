"""Strategy comparison: same budget three ways. Every strategy stays in budget and the comparison is fair."""
import pytest

from src.strategies import STRATEGIES, compare

WARDS = ["L", "E", "F/N", "K/W"]
BUDGETS = [200_000, 500_000, 1_000_000]


@pytest.fixture(scope="module")
def results(t, findings):
    return {(w, b): compare(t, w, b, findings) for w in WARDS for b in BUDGETS}


@pytest.mark.parametrize("ward", WARDS)
@pytest.mark.parametrize("budget", BUDGETS)
def test_every_strategy_stays_within_budget(results, ward, budget):
    d = results[(ward, budget)]
    assert [s["key"] for s in d["strategies"]] == list(STRATEGIES)
    for s in d["strategies"]:
        assert s["total_inr"] <= budget
        assert s["total_inr"] + s["unallocated_inr"] == budget
        assert s["issues_funded"] == len(s["funded_issue_ids"]) == len(set(s["funded_issue_ids"]))
        assert s["issues_funded"] <= d["crew_jobs"]


@pytest.mark.parametrize("ward", WARDS)
@pytest.mark.parametrize("budget", BUDGETS)
def test_the_comparison_is_fair(results, ward, budget):
    """Same candidates, same warranty routing: only the funding order differs."""
    d = results[(ward, budget)]
    rows = d["strategies"]
    assert len({s["warranty_routed"] for s in rows}) == 1
    assert len({s["issues_funded"] + s["issues_deferred"] for s in rows}) == 1     # same fundable set
    assert rows[0]["issues_funded"] + rows[0]["issues_deferred"] == d["fundable"]
    for s in rows:
        assert 0 <= s["risk_covered_share"] <= 1
        assert s["top_risk_issues"] <= min(d["top_n"], s["issues_funded"])


@pytest.mark.parametrize("ward", WARDS)
@pytest.mark.parametrize("budget", BUDGETS)
def test_risk_plan_starts_with_the_highest_risk_issue(t, findings, results, ward, budget):
    """What the risk plan guarantees: it funds in risk order, so the highest-risk issue that fits the budget is
    always funded. It does NOT guarantee the most top-10 issues: at tight budgets complaints-first can fund more of
    them because potholes are cheap (ward E at Rs 2 lakh: 6 against 2). The panel shows those counts as they are."""
    from src.budget import DEFAULT_WEIGHTS, open_issues, road_risk
    d = results[(ward, budget)]
    risk = road_risk(t, open_issues(t, ward), DEFAULT_WEIGHTS)
    fits = risk[risk.est_cost_inr.notna() & (risk.under_dlp != "Y") & (risk.est_cost_inr <= budget)]
    funded = {s["key"]: s["funded_issue_ids"] for s in d["strategies"]}["nagarlens_risk"]
    if len(fits):
        assert fits.sort_values(["risk_score", "issue_id"], ascending=[False, True]).issue_id.iloc[0] in funded


def test_summed_risk_is_not_always_highest_for_the_risk_plan(results):
    """Known and shown on screen, not hidden: complaints-first buys more cheap jobs, so its SUMMED risk can be
    higher (ward L at Rs 5 lakh is one case). The panel states this trade-off in its summary."""
    d = results[("L", 500_000)]
    by = {s["key"]: s for s in d["strategies"]}
    assert by["most_complaints"]["issues_funded"] > by["nagarlens_risk"]["issues_funded"]
    assert by["most_complaints"]["risk_covered"] > by["nagarlens_risk"]["risk_covered"]
    assert by["nagarlens_risk"]["avg_risk_score"] > by["most_complaints"]["avg_risk_score"]
    assert any("Complaints-first funds more issues" in line for line in d["summary"])


def test_same_list_when_the_budget_does_not_bind(t, findings):
    d = compare(t, "E", 5_000_000, findings)
    assert d["identical"] and not d["budget_binds"] and d["only_in_nagarlens"] == []
    assert "Lower the budget" in d["note"]
    assert len({tuple(sorted(s["funded_issue_ids"])) for s in d["strategies"]}) == 1


def test_only_in_nagarlens_is_really_only_there(results):
    for d in results.values():
        by = {s["key"]: set(s["funded_issue_ids"]) for s in d["strategies"]}
        for item in d["only_in_nagarlens"]:
            assert item["issue_id"] in by["nagarlens_risk"]
            assert item["issue_id"] not in by["most_complaints"] | by["highest_severity"]
            assert item["why"]


def test_default_budget_matches_the_plan(t, findings):
    from src.budget import default_budget
    d = compare(t, "L", None, findings)
    assert d["budget_inr"] == default_budget(t, "L", findings)[0]
