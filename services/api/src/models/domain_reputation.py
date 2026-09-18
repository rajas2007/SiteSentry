from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import Base


class DomainReputation(Base):
    __tablename__ = "domain_reputation"

    domain: Mapped[str] = mapped_column(
        String(255),
        primary_key=True,
    )
    security_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    privacy_score: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    trust_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    last_scanned: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    aggregated_findings: Mapped[list[Any]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
