import pytest

from src.engines.privacy.engine import PrivacyIntelligenceEngine
from src.engines.privacy.extractor import PrivacyPolicyExtractor
from src.engines.privacy.llm_provider import PrivacyAnalysisProvider
from src.engines.privacy.schemas import LLMPrivacyResponse


class MockPrivacyProvider(PrivacyAnalysisProvider):
    def __init__(self, response: LLMPrivacyResponse | None = None):
        self.response = response

    async def analyze_policy(self, text: str) -> LLMPrivacyResponse | None:
        return self.response


def test_extractor_no_relevant_text():
    text = "Welcome to our homepage. We have great products."
    assert PrivacyPolicyExtractor.extract_relevant_text(text) is None


def test_extractor_with_relevant_text():
    text = "Welcome. We sell your data to third party marketing affiliates. Buy now."
    extracted = PrivacyPolicyExtractor.extract_relevant_text(text)
    assert extracted is not None
    assert "sell your data" in extracted


@pytest.mark.asyncio
async def test_privacy_engine_empty_policy():
    engine = PrivacyIntelligenceEngine(provider=MockPrivacyProvider())
    result = await engine.analyze(raw_page_text=None, third_party_cookie_count=0)
    assert result.status == "success"
    assert len(result.findings) == 0


@pytest.mark.asyncio
async def test_privacy_engine_tracking_cookies():
    engine = PrivacyIntelligenceEngine(provider=MockPrivacyProvider())
    result = await engine.analyze(raw_page_text=None, third_party_cookie_count=15)
    assert result.status == "success"
    assert len(result.findings) == 1
    assert result.findings[0].category == "Tracking"
    assert result.findings[0].severity == "high"


@pytest.mark.asyncio
async def test_privacy_engine_llm_sold_data():
    mock_response = LLMPrivacyResponse(
        data_sold=True, data_shared_third_party=False, explanation="They sell data"
    )
    engine = PrivacyIntelligenceEngine(provider=MockPrivacyProvider(mock_response))
    text = "We sell your data."
    result = await engine.analyze(raw_page_text=text, third_party_cookie_count=0)
    assert result.status == "success"
    assert len(result.findings) == 1
    assert result.findings[0].internal_code == "PRIV-POL-SALE"
    assert result.findings[0].severity == "critical"


@pytest.mark.asyncio
async def test_privacy_engine_llm_unavailable():
    # Returns None simulating timeout or missing key
    engine = PrivacyIntelligenceEngine(provider=MockPrivacyProvider(None))
    text = "We share data with third party marketing affiliates."
    result = await engine.analyze(raw_page_text=text, third_party_cookie_count=0)
    assert result.status == "unavailable"
    # Even if unavailable, engine doesn't crash
    assert len(result.findings) == 0
