import pytest
import pandas as pd
from src.context import rain_context
from src.data import load_all

@pytest.fixture(scope="module")
def dataset():
    return load_all()

def test_rain_context_contractors(dataset):
    df = rain_context(dataset, "contractor_id")
    # Expect one row per contractor (8 synthetic contractors)
    assert df.shape[0] == 8
    # Columns exist
    expected_cols = [
        "heavy_rain_jobs",
        "heavy_rain_job_share",
        "on_time_heavy_rain",
        "peer_on_time_heavy_rain",
        "on_time_dry",
        "peer_on_time_dry",
    ]
    for col in expected_cols:
        assert col in df.columns
    # Shares between 0 and 1
    assert df["heavy_rain_job_share"].between(0, 1).all()
    # Sum of heavy rain jobs equals total heavy‑rain jobs in dataset
    total_heavy = (
        dataset["work_orders"]["assigned_at"].dt.normalize()
        .map(dataset["rainfall_daily"].groupby("date").rainfall_mm.max())
        >= 64.5
    ).sum()
    assert df["heavy_rain_jobs"].sum() == total_heavy

def test_rain_context_wards(dataset):
    df = rain_context(dataset, "ward_code")
    # Expect one row per ward (24 synthetic wards)
    assert df.shape[0] == 24
    # Columns exist (same as above)
    for col in [
        "heavy_rain_jobs",
        "heavy_rain_job_share",
        "on_time_heavy_rain",
        "peer_on_time_heavy_rain",
        "on_time_dry",
        "peer_on_time_dry",
    ]:
        assert col in df.columns
    # Share bounds
    assert df["heavy_rain_job_share"].between(0, 1).all()
    # Total heavy‑rain jobs matches
    total_heavy = (
        dataset["work_orders"]["assigned_at"].dt.normalize()
        .map(dataset["rainfall_daily"].groupby("date").rainfall_mm.max())
        >= 64.5
    ).sum()
    assert df["heavy_rain_jobs"].sum() == total_heavy
