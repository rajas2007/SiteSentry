import pytest

from src.engines.decision.engine import DecisionEngine
from src.engines.security.engine import SecurityEngine
from src.schemas.analysis import PageAnalysisRequest, PageFeatures


@pytest.fixture
def base_features():
    return PageFeatures(
        hasPasswordField=False,
        hasLoginForm=False,
        formCount=0,
        externalLinkCount=5,
        iframeCount=0,
        scriptCount=10,
        imageCount=2,
        suspiciousKeywords=[],
        pageTextLength=500,
        hasHttps=True,
        hostnameLength=15,
        subdomainCount=0,
    )


def test_security_engine_normal_https(base_features):
    req = PageAnalysisRequest(
        url="https://example.com",
        title="Example",
        hostname="example.com",
        features=base_features,
    )
    engine = SecurityEngine()
    res = engine.analyze(req)
    assert res["score"] == 100
    assert res["threat_category"] == "safe"


def test_security_engine_http_login(base_features):
    base_features.hasHttps = False
    base_features.hasPasswordField = True
    req = PageAnalysisRequest(
        url="http://example.com",
        title="Login",
        hostname="example.com",
        features=base_features,
    )
    engine = SecurityEngine()
    res = engine.analyze(req)
    assert res["score"] < 50
    assert res["threat_category"] == "credential_theft"


def test_security_engine_suspicious_keywords(base_features):
    base_features.suspiciousKeywords = ["verify", "urgent", "account"]
    req = PageAnalysisRequest(
        url="https://example.com",
        title="Example",
        hostname="example.com",
        features=base_features,
    )
    engine = SecurityEngine()
    res = engine.analyze(req)
    assert res["score"] == 85  # 100 - 15
    assert res["threat_category"] == "safe"  # still >= 80


def test_decision_engine_boundaries():
    engine = DecisionEngine()

    # Low risk (>=80)
    res_80 = engine.generate_decision({"score": 80, "threat_category": "safe"})
    assert res_80["severity"] == "low"
    assert res_80["decision"]["ui"]["color"] == "emerald"

    # Medium risk (50-79)
    res_79 = engine.generate_decision({"score": 79, "threat_category": "elevated_risk"})
    assert res_79["severity"] == "medium"
    assert res_79["decision"]["ui"]["color"] == "amber"

    res_50 = engine.generate_decision({"score": 50, "threat_category": "elevated_risk"})
    assert res_50["severity"] == "medium"

    # High risk (<50)
    res_49 = engine.generate_decision(
        {"score": 49, "threat_category": "credential_theft"}
    )
    assert res_49["severity"] == "high"
    assert res_49["decision"]["ui"]["color"] == "rose"
