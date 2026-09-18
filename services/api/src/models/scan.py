import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )
    domain: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    full_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    final_security_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    final_privacy_score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    final_trust_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    threat_category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    verdict: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    severity: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    full_report: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
    )
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True,
    )
