from typing import Any, Literal

from pydantic import BaseModel, HttpUrl, field_validator

from src.utils.url import InvalidURLError, sanitize_url


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
    privacy_policy_text: str | None = None
    third_party_cookie_count: int = 0

    @field_validator("url", mode="before")
    @classmethod
    def sanitize_request_url(cls, v: Any) -> str:
        """Sanitize incoming URL to establish canonical AnalysisURL boundary.

        Strips authority credentials, fragments, and masks sensitive query parameters.
        Rejects malformed, dangerous, or unsupported schemes via ValueError (HTTP 422).
        """
        if isinstance(v, (str, HttpUrl)):
            try:
                return sanitize_url(str(v))
            except InvalidURLError as e:
                raise ValueError(str(e)) from None
        return str(v)


class DecisionUI(BaseModel):
    color: Literal["emerald", "amber", "rose", "slate"]


class Decision(BaseModel):
    action: Literal["allow", "warn", "block"]
    severity: Literal["low", "medium", "high"]
    ui: DecisionUI


class ProviderStatusResponse(BaseModel):
    provider: str
    status: Literal["clean", "detected", "unavailable", "skipped_privacy"]
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
