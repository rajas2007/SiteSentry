from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScanHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    url: str
    domain: str
    score: int
    severity: str
    verdict: str
    threat_category: str
    scanned_at: datetime


class ScanHistoryResponse(BaseModel):
    items: list[ScanHistoryItem]
    total: int
    limit: int
    offset: int

class DetailedScanHistoryResponse(ScanHistoryItem):
    confidence: float
    recommendations: list[str]
    factors: list[str]
    decision: dict
    threat_intelligence: dict | None = None
