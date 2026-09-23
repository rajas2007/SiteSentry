from typing import Literal

from pydantic import BaseModel, Field


class PrivacyFinding(BaseModel):
    category: str = Field(description="e.g., 'Privacy Abuse', 'Tracking'")
    severity: Literal["low", "medium", "high", "critical"]
    feature_trigger: str
    raw_value: bool | int | str
    internal_code: str


class PrivacyAssessment(BaseModel):
    engine: str = "PrivacyIntelligence"
    status: Literal["success", "unavailable", "unknown", "error"] = "success"
    findings: list[PrivacyFinding] = []


class LLMPrivacyResponse(BaseModel):
    data_sold: bool = Field(description="Does the policy state they sell data?")
    data_shared_third_party: bool = Field(
        description="Do they share data with third party marketing partners?"
    )
    explanation: str = Field(description="Brief explanation of findings")
