from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.scan import ScanHistory
from src.schemas.analytics import (
    AnalyticsOverviewResponse,
    DailyTimelinePoint,
    ThreatCategoryStat,
)


def _to_utc_date(dt: datetime) -> date:
    """Extract UTC calendar date from timezone-aware or naive datetime."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).date()
    return dt.date()


class AnalyticsService:
    @staticmethod
    async def get_overview(
        db: AsyncSession,
        days: int = 30,
    ) -> AnalyticsOverviewResponse:
        """
        Calculates aggregate statistics over actual persisted ScanHistory records
        for the past N calendar days (including today).
        """
        now_utc = datetime.now(timezone.utc)
        today = now_utc.date()
        start_date = today - timedelta(days=days - 1)
        cutoff = datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc)

        # 1. Scalar summary metrics
        stmt_scalars = select(
            func.count(ScanHistory.id).label("total"),
            func.count(
                case(
                    (
                        or_(
                            ScanHistory.verdict == "block",
                            ScanHistory.severity == "high",
                        ),
                        ScanHistory.id,
                    ),
                    else_=None,
                )
            ).label("threats_blocked"),
            func.avg(ScanHistory.final_trust_score).label("avg_trust"),
            func.count(
                case(
                    (
                        ScanHistory.threat_category == "privacy_abuse",
                        ScanHistory.id,
                    ),
                    else_=None,
                )
            ).label("privacy_violations"),
        ).where(ScanHistory.scanned_at >= cutoff)

        result_scalars = await db.execute(stmt_scalars)
        scalar_row = result_scalars.one()

        total_scans: int = scalar_row.total or 0
        threats_blocked: int = scalar_row.threats_blocked or 0
        raw_avg: float | None = scalar_row.avg_trust
        average_trust_score: float = (
            round(float(raw_avg), 1) if raw_avg is not None else 0.0
        )
        privacy_violations: int = scalar_row.privacy_violations or 0

        # 2. Risk distribution
        risk_dist: dict[str, int] = {"low": 0, "medium": 0, "high": 0}
        stmt_risk = (
            select(ScanHistory.severity, func.count(ScanHistory.id))
            .where(ScanHistory.scanned_at >= cutoff)
            .group_by(ScanHistory.severity)
        )
        result_risk = await db.execute(stmt_risk)
        for severity_val, count in result_risk.all():
            sev_key = (severity_val or "unknown").lower()
            risk_dist[sev_key] = risk_dist.get(sev_key, 0) + count

        # 3. Verdict distribution
        verdict_dist: dict[str, int] = {"allow": 0, "warn": 0, "block": 0}
        stmt_verdict = (
            select(ScanHistory.verdict, func.count(ScanHistory.id))
            .where(ScanHistory.scanned_at >= cutoff)
            .group_by(ScanHistory.verdict)
        )
        result_verdict = await db.execute(stmt_verdict)
        for verdict_val, count in result_verdict.all():
            verd_key = (verdict_val or "unknown").lower()
            verdict_dist[verd_key] = verdict_dist.get(verd_key, 0) + count

        # 4. Threat categories
        stmt_categories = (
            select(ScanHistory.threat_category, func.count(ScanHistory.id))
            .where(ScanHistory.scanned_at >= cutoff)
            .group_by(ScanHistory.threat_category)
            .order_by(func.count(ScanHistory.id).desc())
        )
        result_categories = await db.execute(stmt_categories)
        threat_categories: list[ThreatCategoryStat] = []
        for cat_val, count in result_categories.all():
            pct = (
                round((count / total_scans) * 100.0, 1) if total_scans > 0 else 0.0
            )
            threat_categories.append(
                ThreatCategoryStat(
                    category=cat_val or "unknown",
                    count=count,
                    percentage=pct,
                )
            )

        # 5. Timeline - continuous daily buckets including zero-count days
        timeline_map: dict[str, dict[str, Any]] = {
            (start_date + timedelta(days=i)).strftime("%Y-%m-%d"): {
                "date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "total": 0,
                "safe": 0,
                "blocked": 0,
            }
            for i in range(days)
        }

        stmt_timeline = (
            select(
                ScanHistory.scanned_at,
                ScanHistory.verdict,
                ScanHistory.severity,
            )
            .where(ScanHistory.scanned_at >= cutoff)
            .order_by(ScanHistory.scanned_at.asc())
        )
        result_timeline = await db.execute(stmt_timeline)
        for scanned_at_val, verd, sev in result_timeline.all():
            d_str = _to_utc_date(scanned_at_val).strftime("%Y-%m-%d")
            if d_str in timeline_map:
                timeline_map[d_str]["total"] += 1
                if (verd or "").lower() == "allow":
                    timeline_map[d_str]["safe"] += 1
                if (verd or "").lower() == "block" or (sev or "").lower() == "high":
                    timeline_map[d_str]["blocked"] += 1

        timeline = [DailyTimelinePoint(**point) for point in timeline_map.values()]

        return AnalyticsOverviewResponse(
            period_days=days,
            total_scans=total_scans,
            threats_blocked=threats_blocked,
            average_trust_score=average_trust_score,
            privacy_violations=privacy_violations,
            risk_distribution=risk_dist,
            verdict_distribution=verdict_dist,
            threat_categories=threat_categories,
            timeline=timeline,
        )
