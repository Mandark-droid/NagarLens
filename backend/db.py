"""SQLite via SQLModel: the only state the app writes. The dataset itself is never modified.

LeadReview records a human decision on an audit lead (the officer stays in the loop). It is the hook for the
three-way verdict feature: Release payment / Hold for evidence / Return under warranty.
"""
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Field, Session, SQLModel, create_engine

DB_PATH = Path(__file__).resolve().parent / "nagarlens.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

DECISIONS = ["release_payment", "hold_for_evidence", "return_under_warranty"]


class LeadReview(SQLModel, table=True):
    finding_id: str = Field(primary_key=True)
    work_order_id: str = Field(index=True)
    decision: str
    note: str = ""
    decided_by: str = "ward officer"
    decided_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RepairFeedback(SQLModel, table=True):
    """Citizen answer to "Did this repair survive?" on the Public Repair Receipt. New data (Synthetic, NagarLens):
    never added to organizer totals. A "failed" answer on a road under DLP is recorded as a warranty case at Rs 0 to BMC."""
    id: int | None = Field(default=None, primary_key=True)
    work_order_id: str = Field(index=True)
    answer: str                      # survived | failed | unsure
    note: str = ""
    warranty_case: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
