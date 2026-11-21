"""Strategy comparison endpoint: the same ward budget spent three ways. Feature owner: Aditya.

GET /api/wards/{ward}/strategies wraps src/strategies.compare unchanged. Ward codes may contain "/" (e.g. "F/N").
"""
from fastapi import APIRouter, HTTPException, Query

from src.strategies import compare

from ..deps import DATA_LAYER, state

router = APIRouter(tags=["strategies"])


@router.get("/wards/{ward:path}/strategies")
def ward_strategies(ward: str,
                    budget_inr: int | None = Query(None, ge=0, description="Defaults to the same budget as the plan"),
                    severity: int | None = Query(None, ge=0, le=10), flood: int | None = Query(None, ge=0, le=10),
                    traffic: int | None = Query(None, ge=0, le=10), facilities: int | None = Query(None, ge=0, le=10),
                    accidents: int | None = Query(None, ge=0, le=10), repeat: int | None = Query(None, ge=0, le=10),
                    complaints: int | None = Query(None, ge=0, le=10), social: int | None = Query(None, ge=0, le=10)):
    s = state()
    if ward not in set(s["t"]["wards"].ward_code):
        raise HTTPException(404, f"Unknown ward {ward!r}")
    given = dict(severity=severity, flood=flood, traffic=traffic, facilities=facilities, accidents=accidents,
                 repeat=repeat, complaints=complaints, social=social)
    out = compare(s["t"], ward, budget_inr, s["findings"], {k: v for k, v in given.items() if v is not None})
    return {**out, "data_layer": DATA_LAYER}
