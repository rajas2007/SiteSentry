import logging

from src.engines.privacy.extractor import PrivacyPolicyExtractor
from src.engines.privacy.llm_provider import (
    OpenAIPrivacyProvider,
    PrivacyAnalysisProvider,
)
from src.engines.privacy.schemas import PrivacyAssessment, PrivacyFinding

logger = logging.getLogger(__name__)


class PrivacyIntelligenceEngine:
    """
    Analyzes privacy policies and tracking behavior to protect users
    against data exploitation.
    """

    def __init__(self, provider: PrivacyAnalysisProvider | None = None) -> None:
        self.provider = provider or OpenAIPrivacyProvider()
        self.extractor = PrivacyPolicyExtractor()

    async def analyze(
        self,
        raw_page_text: str | None = None,
        third_party_cookie_count: int = 0,
    ) -> PrivacyAssessment:
        findings: list[PrivacyFinding] = []

        # 1. Tracker & Cookie Analysis
        if third_party_cookie_count > 10:
            findings.append(
                PrivacyFinding(
                    category="Tracking",
                    severity="high",
                    feature_trigger="third_party_cookie_count",
                    raw_value=third_party_cookie_count,
                    internal_code="PRIV-TRK-EXCESS",
                )
            )

        # 2. Privacy Policy AI Analysis
        relevant_text = self.extractor.extract_relevant_text(raw_page_text)

        from typing import Literal

        status: Literal["success", "unavailable", "unknown", "error"] = "success"

        if relevant_text:
            llm_response = await self.provider.analyze_policy(relevant_text)
            if llm_response:
                if llm_response.data_sold:
                    findings.append(
                        PrivacyFinding(
                            category="Privacy Abuse",
                            severity="critical",
                            feature_trigger="policy_data_sold",
                            raw_value=True,
                            internal_code="PRIV-POL-SALE",
                        )
                    )
                if llm_response.data_shared_third_party:
                    findings.append(
                        PrivacyFinding(
                            category="Data Sharing",
                            severity="high",
                            feature_trigger="policy_data_shared_third_party",
                            raw_value=True,
                            internal_code="PRIV-POL-SHARE",
                        )
                    )
            else:
                # LLM failed or API key missing
                status = "unavailable"
        else:
            if raw_page_text:
                # No relevant privacy info found in text
                pass

        return PrivacyAssessment(
            status=status,
            findings=findings,
        )
