from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.schemas.analytics import AnalyticsOverviewResponse
from src.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])
analytics_service = AnalyticsService()


@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    days: Annotated[
        int,
        Query(
            ge=1,
            le=365,
            description="Number of calendar days to aggregate (1 to 365, including today)",
        ),
    ] = 30,
) -> AnalyticsOverviewResponse:
    return await analytics_service.get_overview(db=db, days=days)
