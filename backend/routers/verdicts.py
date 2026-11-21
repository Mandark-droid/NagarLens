"""Recommended verdict, fair hearing and Public Repair Receipt feedback. Owner: Harsh (docs/tasks/harsh.md).

The verdict is rule based (src/verdict.py); the hearing only explains it (src/hearing.py, Claude or template).
The officer still decides through PUT /findings/{finding_id}/review.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from src.hearing import hearing
from src.verdict import recommend, summary

from ..db import LeadReview, RepairFeedback, get_session
from ..deps import DATA_LAYER, state
from . import audit as audit_router

router = APIRouter(tags=["verdicts"])
NAGARLENS_LAYER = "synthetic_nagarlens"   # citizen feedback is new data, never part of organizer totals


def _finding(finding_id: str) -> dict:
    f = state()["informational"]
    hit = f[f.finding_id == finding_id]
    if hit.empty:
        raise HTTPException(404, f"Unknown finding {finding_id}")
    return hit.iloc[0].to_dict()


@router.get("/verdicts/summary")
def verdict_summary(ward: str | None = None):
    f = state()["findings"]
    if ward:
        f = f[f.ward_code == ward]
    return {"rows": summary(f), "data_layer": DATA_LAYER}


@router.get("/findings/{finding_id}/verdict")
def verdict(finding_id: str, session: Session = Depends(get_session)):
    row = _finding(finding_id)
    review = session.get(LeadReview, finding_id)
    return {"finding_id": finding_id, "work_order_id": row["work_order_id"], "recommended": recommend(row),
            "review": review.model_dump(mode="json") if review else None, "data_layer": DATA_LAYER}


@router.get("/findings/{finding_id}/hearing")
def fair_hearing(finding_id: str, session: Session = Depends(get_session)):
    detail = audit_router.finding(finding_id, session)   # same evidence the audit page shows
    out, source = hearing(detail["finding"], detail["evidence"])
    return out | {"source": source, "finding_id": finding_id, "data_layer": DATA_LAYER}


class FeedbackIn(BaseModel):
    answer: str = Field(pattern="^(survived|failed|unsure)$")
    note: str = Field(default="", max_length=500)


def _feedback_counts(session: Session, work_order_id: str) -> dict:
    rows = session.exec(select(RepairFeedback).where(RepairFeedback.work_order_id == work_order_id)).all()
    return {"survived": sum(r.answer == "survived" for r in rows), "failed": sum(r.answer == "failed" for r in rows),
            "unsure": sum(r.answer == "unsure" for r in rows),
            "warranty_cases": [f"WC-{r.work_order_id}-{r.id}" for r in rows if r.warranty_case]}


@router.get("/receipts/{work_order_id}/feedback")
def receipt_feedback(work_order_id: str, session: Session = Depends(get_session)):
    return _feedback_counts(session, work_order_id) | {"data_layer": NAGARLENS_LAYER}


@router.post("/receipts/{work_order_id}/feedback")
def add_receipt_feedback(work_order_id: str, body: FeedbackIn, session: Session = Depends(get_session)):
    wo = state()["t"]["work_orders"]
    hit = wo[wo.work_order_id == work_order_id]
    if hit.empty:
        raise HTTPException(404, f"Unknown work order {work_order_id}")
    under_dlp = hit.iloc[0].under_dlp == "Y"
    fb = RepairFeedback(work_order_id=work_order_id, answer=body.answer, note=body.note.strip(),
                        warranty_case=body.answer == "failed" and under_dlp)
    session.add(fb)
    session.commit()
    session.refresh(fb)
    if fb.warranty_case:
        msg = (f"Warranty case WC-{work_order_id}-{fb.id} recorded at ₹0 to BMC: the road is under its Defect Liability "
               "Period, so the ward checks the DLP register and claims from the original resurfacing contractor.")
    elif body.answer == "failed":
        msg = "Thank you. The failed repair is recorded for the ward engineer to inspect."
    else:
        msg = "Thank you. Your answer is recorded."
    return {"feedback": fb.model_dump(mode="json"), "message": msg, "data_layer": NAGARLENS_LAYER,
            "counts": _feedback_counts(session, work_order_id)}
