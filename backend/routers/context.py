"""Rain context under each scorecard: on-time share on heavy-rain days versus dry days, with peers."""
from fastapi import APIRouter, HTTPException

from src.context import rain_context

from ..deps import DATA_LAYER, records, state

router = APIRouter(tags=["context"])
GROUP = {"contractors": "contractor_id", "wards": "ward_code"}


@router.get("/scorecards/{kind}/context")
def get_context(kind: str):
    if kind not in GROUP:
        raise HTTPException(404, f"Unknown scorecard kind {kind}; use contractors or wards")
    df = rain_context(state()["t"], GROUP[kind])
    return {"rows": records(df.reset_index()), "data_layer": DATA_LAYER}
