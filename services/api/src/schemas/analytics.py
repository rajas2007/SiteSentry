from pydantic import BaseModel, ConfigDict, Field


class ThreatCategoryStat(BaseModel):
    category: str
    count: int
    percentage: float = Field(
        ...,
        description="Percentage of total scans in period, rounded to one decimal place",
    )


class DailyTimelinePoint(BaseModel):
    date: str = Field(..., description="Date formatted as YYYY-MM-DD")
    total: int = Field(..., description="Total scans on this date")
    safe: int = Field(
        ...,
        description="Scans on this date where verdict is allow",
    )
    blocked: int = Field(
        ...,
        description="Scans on this date where verdict is block or severity is high",
    )


class AnalyticsOverviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    period_days: int = Field(
        ...,
        description="Number of calendar days included in the analytics window (including today)",
    )
    total_scans: int = Field(..., description="Total scans evaluated in the period")
    threats_blocked: int = Field(
        ...,
        description="Scans where verdict is block OR severity is high (deduplicated)",
    )
    average_trust_score: float = Field(
        ...,
        description="Average final trust score across scans in period, rounded to one decimal",
    )
    privacy_violations: int = Field(
        ...,
        description="Scans where persisted threat_category is privacy_abuse",
    )
    risk_distribution: dict[str, int] = Field(
        ...,
        description="Count of scans per severity level (low, medium, high, and any unknown)",
    )
    verdict_distribution: dict[str, int] = Field(
        ...,
        description="Count of scans per verdict action (allow, warn, block, and any unknown)",
    )
    threat_categories: list[ThreatCategoryStat] = Field(
        ...,
        description="Distribution of persisted threat categories in the period",
    )
    timeline: list[DailyTimelinePoint] = Field(
        ...,
        description="Continuous daily activity buckets for the requested window",
    )
