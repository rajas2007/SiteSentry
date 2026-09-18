from pydantic import BaseModel, Field


class UnifiedThreatObject(BaseModel):
    domain: str
    domain_age_days: int | None = None
    blacklists_triggered: list[str] = Field(default_factory=list)
    total_vendor_flags: int = 0
    community_flags: int = 0
    threat_categories: list[str] = Field(default_factory=list)
    registrar_reputation: str = "unknown"
    confidence: float = 0.9
    data_completeness: bool = True
