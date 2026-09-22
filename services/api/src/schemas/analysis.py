from typing import Literal

from pydantic import BaseModel, HttpUrl


class PageFeatures(BaseModel):
    hasPasswordField: bool
    hasLoginForm: bool
    formCount: int
    externalLinkCount: int
    iframeCount: int
    scriptCount: int
    imageCount: int
    suspiciousKeywords: list[str]
    pageTextLength: int
    hasHttps: bool
    hostnameLength: int
    subdomainCount: int


class PageAnalysisRequest(BaseModel):
    url: HttpUrl
    title: str
    hostname: str
    features: PageFeatures


class DecisionUI(BaseModel):
    color: Literal["emerald", "amber", "rose", "slate"]


class Decision(BaseModel):
    action: Literal["allow", "warn", "block"]
    severity: Literal["low", "medium", "high"]
    ui: DecisionUI


class ProviderStatusResponse(BaseModel):
    provider: str
    status: Literal["clean", "detected", "unavailable"]
    categories: list[str]
    summary: str


class ThreatIntelligenceResponse(BaseModel):
    sources: list[ProviderStatusResponse]


class PageAnalysisResponse(BaseModel):
    analysis_id: str
    score: int
    severity: Literal["low", "medium", "high"]
    confidence: float
    threat_category: str
    recommendations: list[str]
    factors: list[str]
    decision: Decision
    threat_intelligence: ThreatIntelligenceResponse | None = None
