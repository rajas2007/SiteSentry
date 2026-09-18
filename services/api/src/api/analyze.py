from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.schemas.analysis import PageAnalysisRequest, PageAnalysisResponse
from src.schemas.scan import ScanHistoryResponse
from src.services.history_service import HistoryService
from src.services.scan_service import ScanService

router = APIRouter(prefix="/api/v1", tags=["Analysis"])

scan_service = ScanService()
history_service = HistoryService()


@router.post("/analyze", response_model=PageAnalysisResponse)
async def analyze_page(
    request: PageAnalysisRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PageAnalysisResponse:
    return await scan_service.analyze_page(request, db=db)


@router.get("/history", response_model=ScanHistoryResponse)
async def get_scan_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    domain: Annotated[str | None, Query()] = None,
) -> ScanHistoryResponse:
    return await history_service.get_history(
        db=db,
        limit=limit,
        offset=offset,
        domain=domain,
    )
