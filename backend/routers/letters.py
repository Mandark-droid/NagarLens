"""Evidence-request letter for one audit lead, built from the same finding and evidence the audit page shows."""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from src.letters import LETTER_RULES, draft_letter

from ..db import get_session
from ..deps import DATA_LAYER
from .audit import finding as get_finding

router = APIRouter(tags=["letters"])


@router.get("/findings/{finding_id}/letter")
def get_letter(finding_id: str, session: Session = Depends(get_session)):
    result = get_finding(finding_id, session)   # raises 404 for an unknown id
    f = result["finding"]
    if f["rule_id"] not in LETTER_RULES:
        raise HTTPException(404, f"No letter for {f['rule']} leads")
    return {"markdown": draft_letter(f, result["evidence"]), "source": "template", "data_layer": DATA_LAYER}
