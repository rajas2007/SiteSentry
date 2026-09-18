from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.scan import ScanHistory
from src.schemas.scan import ScanHistoryItem, ScanHistoryResponse


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
