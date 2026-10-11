from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.scan import ScanHistory
from src.schemas.scan import ScanHistoryItem, ScanHistoryResponse, DetailedScanHistoryResponse


class HistoryService:
    @staticmethod
    async def get_history(
        db: AsyncSession,
        limit: int = 20,
        offset: int = 0,
        domain: str | None = None,
    ) -> ScanHistoryResponse:
        # Build query
        stmt = select(ScanHistory)
        count_stmt = select(func.count(ScanHistory.id))

        if domain:
            stmt = stmt.where(ScanHistory.domain == domain)
            count_stmt = count_stmt.where(ScanHistory.domain == domain)

        # Get total count
        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one_or_none() or 0

        # Execute paginated query
        stmt = stmt.order_by(ScanHistory.scanned_at.desc()).offset(offset).limit(limit)
        result = await db.execute(stmt)
        scans = result.scalars().all()

        items = [
            ScanHistoryItem(
                id=scan.id,
                url=scan.full_url,
                domain=scan.domain,
                score=scan.final_security_score,
                severity=scan.severity,
                verdict=scan.verdict,
                threat_category=scan.threat_category,
                scanned_at=scan.scanned_at,
            )
            for scan in scans
        ]

        return ScanHistoryResponse(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    async def get_scan_by_id(db: AsyncSession, scan_id: str) -> DetailedScanHistoryResponse | None:
        scan = await db.get(ScanHistory, scan_id)
        if not scan:
            return None

        report = scan.full_report or {}

        # safely handle legacy records where keys might be missing
        return DetailedScanHistoryResponse(
            id=scan.id,
            url=scan.full_url,
            domain=scan.domain,
            score=scan.final_security_score,
            severity=scan.severity,
            verdict=scan.verdict,
            threat_category=scan.threat_category,
            scanned_at=scan.scanned_at,
            confidence=report.get("confidence", 0.0),
            recommendations=report.get("recommendations", []),
            factors=report.get("factors", []),
            decision=report.get("decision", {
                "action": scan.verdict,
                "severity": scan.severity,
                "ui": {"color": "slate"}
            }),
            threat_intelligence=report.get("threat_intelligence", None),
        )
