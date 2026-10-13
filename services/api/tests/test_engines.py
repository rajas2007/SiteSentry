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


from src.engines.score_fusion.engine import ScoreFusionEngine


def test_security_engine_normal_https(base_features):
    req = PageAnalysisRequest(
        url="https://example.com",
        title="Example",
        hostname="example.com",
        features=base_features,
    )
    engine = SecurityEngine()
    signals = engine.analyze(req)
    signal_ids = [s["id"] for s in signals]
    assert "https_enabled" in signal_ids
    assert "multiple_subdomains" not in signal_ids


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
    signals = engine.analyze(req)
    signal_ids = [s["id"] for s in signals]
    assert "no_https" in signal_ids
    assert "insecure_login" in signal_ids


def test_security_engine_suspicious_keywords(base_features):
    base_features.suspiciousKeywords = ["verify", "urgent", "account"]
    req = PageAnalysisRequest(
        url="https://example.com",
        title="Example",
        hostname="example.com",
        features=base_features,
    )
    engine = SecurityEngine()
    signals = engine.analyze(req)
    signal_ids = [s["id"] for s in signals]
    assert "suspicious_keywords" in signal_ids


def test_score_fusion_engine_clean():
    engine = ScoreFusionEngine()
    signals = [
        {"id": "https_enabled", "description": "Connection is encrypted (HTTPS)"}
    ]
    res = engine.fuse(signals)
    assert res["score"] == 100
    assert res["threat_category"] == "safe"
    assert res["confidence"] == 0.9


def test_score_fusion_engine_suspicious():
    engine = ScoreFusionEngine()
    signals = [
        {"id": "no_https", "description": "Connection is unencrypted (HTTP)"},
        {"id": "suspicious_keywords", "description": "Keywords detected"},
    ]
    res = engine.fuse(signals)
    assert res["score"] == 55  # 100 - 30 - 15
    assert res["threat_category"] == "elevated_risk"


def test_score_fusion_engine_high_risk():
    engine = ScoreFusionEngine()
    signals = [
        {"id": "no_https", "description": "Connection is unencrypted (HTTP)"},
        {"id": "insecure_login", "description": "Login without HTTPs"},
    ]
    res = engine.fuse(signals)
    assert res["score"] == 30  # 100 - 30 - 40
    assert res["threat_category"] == "credential_theft"


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


def test_security_engine_legitimate_login_routine_keywords(base_features):
    # Routine terms (login, password, account) on HTTPS must NOT trigger suspicious_login
    base_features.hasPasswordField = True
    base_features.hasLoginForm = True
    base_features.suspiciousKeywords = ["login", "password", "account", "sign in"]
    req = PageAnalysisRequest(
        url="https://legit-bank.com/login",
        title="Account Login",
        hostname="legit-bank.com",
        features=base_features,
    )
    engine = SecurityEngine()
    signals = engine.analyze(req)
    signal_ids = [s["id"] for s in signals]

    assert "has_login" in signal_ids
    assert "suspicious_login" not in signal_ids
    assert "insecure_login" not in signal_ids

    # Verify score fusion gives 100 for legitimate login
    fusion = ScoreFusionEngine()
    res = fusion.fuse(signals)
    assert res["score"] == 100
    assert res["threat_category"] == "safe"


def test_security_engine_insecure_http_login(base_features):
    # HTTP + password/login form must trigger insecure_login and no_https
    base_features.hasHttps = False
    base_features.hasPasswordField = True
    base_features.hasLoginForm = True
    base_features.suspiciousKeywords = ["login", "password"]
    req = PageAnalysisRequest(
        url="http://insecure-site.com/login",
        title="Insecure Login",
        hostname="insecure-site.com",
        features=base_features,
    )
    engine = SecurityEngine()
    signals = engine.analyze(req)
    signal_ids = [s["id"] for s in signals]

    assert "no_https" in signal_ids
    assert "insecure_login" in signal_ids
    assert "suspicious_login" not in signal_ids

    fusion = ScoreFusionEngine()
    res = fusion.fuse(signals)
    # 100 - 30 (no_https) - 40 (insecure_login) = 30
    assert res["score"] == 30
    assert res["threat_category"] == "credential_theft"


def test_security_engine_coercive_urgency_login(base_features):
    # Coercive phishing language (urgent, suspended) with login form triggers suspicious_login
    base_features.hasPasswordField = True
    base_features.hasLoginForm = True
    base_features.suspiciousKeywords = ["login", "password", "urgent", "suspended"]
    req = PageAnalysisRequest(
        url="https://phish-login.com",
        title="Urgent: Account Suspended",
        hostname="phish-login.com",
        features=base_features,
    )
    engine = SecurityEngine()
    signals = engine.analyze(req)
    signal_ids = [s["id"] for s in signals]

    assert "suspicious_login" in signal_ids
    assert "has_login" not in signal_ids

    fusion = ScoreFusionEngine()
    res = fusion.fuse(signals)
    # 100 - 20 (suspicious_login) = 80
    assert res["score"] == 80
    assert res["threat_category"] == "safe"


def test_security_engine_suspicious_keywords_without_login(base_features):
    # Suspicious keywords without login form triggers suspicious_keywords
    base_features.hasPasswordField = False
    base_features.hasLoginForm = False
    base_features.suspiciousKeywords = ["urgent", "suspended", "verify"]
    req = PageAnalysisRequest(
        url="https://scam-notice.com",
        title="Notice",
        hostname="scam-notice.com",
        features=base_features,
    )
    engine = SecurityEngine()
    signals = engine.analyze(req)
    signal_ids = [s["id"] for s in signals]

    assert "suspicious_keywords" in signal_ids
    assert "suspicious_login" not in signal_ids
    assert "has_login" not in signal_ids


def test_security_engine_clean_page(base_features):
    # Clean page with no keywords and no login form
    req = PageAnalysisRequest(
        url="https://example.com",
        title="Clean Page",
        hostname="example.com",
        features=base_features,
    )
    engine = SecurityEngine()
    signals = engine.analyze(req)
    signal_ids = [s["id"] for s in signals]

    assert signal_ids == ["https_enabled"]
    fusion = ScoreFusionEngine()
    res = fusion.fuse(signals)
    assert res["score"] == 100
    assert res["threat_category"] == "safe"


def test_decision_engine_incomplete_data_degrades_low_risk():
    # Incomplete threat intel degrades what would be low risk (score >= 80) into medium / warn / amber / inconclusive
    engine = DecisionEngine()
    res = engine.generate_decision(
        {"score": 100, "threat_category": "safe", "data_completeness": False}
    )
    assert res["severity"] == "medium"
    assert res["decision"]["action"] == "warn"
    assert res["decision"]["ui"]["color"] == "amber"
    assert res["threat_category"] == "inconclusive"
    assert any("Threat intelligence checks could not be completed" in r for r in res["recommendations"])


def test_decision_engine_incomplete_data_preserves_confirmed_threats():
    # If a threat was confirmed (score < 50), incomplete data must NOT downgrade it to warn
    engine = DecisionEngine()
    res = engine.generate_decision(
        {"score": 10, "threat_category": "phishing", "data_completeness": False}
    )
    assert res["severity"] == "high"
    assert res["decision"]["action"] == "block"
    assert res["decision"]["ui"]["color"] == "rose"
    assert res["threat_category"] == "phishing"


def test_decision_engine_virustotal_one_vendor_flag():
    # VT flags 1 vendor (score 90). Must NOT be 'allow' / 'low' despite score >= 80.
    engine = DecisionEngine()
    res = engine.generate_decision({
        "score": 90,
        "threat_category": "malicious_domain",
        "data_completeness": True,
        "has_confirmed_threat": True,
    })
    assert res["severity"] == "medium"
    assert res["decision"]["action"] == "warn"
    assert res["decision"]["ui"]["color"] == "amber"
    assert res["threat_category"] == "malicious_domain"
    assert any("Security vendors flagged potential threats" in r for r in res["recommendations"])


def test_decision_engine_virustotal_two_vendor_flags():
    # VT flags 2 vendors (score 80). Must NOT be 'allow' / 'low'.
    engine = DecisionEngine()
    res = engine.generate_decision({
        "score": 80,
        "threat_category": "malicious_domain",
        "data_completeness": True,
        "has_confirmed_threat": True,
    })
    assert res["severity"] == "medium"
    assert res["decision"]["action"] == "warn"
    assert res["decision"]["ui"]["color"] == "amber"
    assert res["threat_category"] == "malicious_domain"
    assert any("Security vendors flagged potential threats" in r for r in res["recommendations"])


def test_decision_engine_confirmed_phishing_result():
    # Confirmed phishing (score 10). Must evaluate to block / high / rose.
    engine = DecisionEngine()
    res = engine.generate_decision({
        "score": 10,
        "threat_category": "phishing",
        "data_completeness": True,
        "has_confirmed_threat": True,
    })
    assert res["severity"] == "high"
    assert res["decision"]["action"] == "block"
    assert res["decision"]["ui"]["color"] == "rose"
    assert res["threat_category"] == "phishing"
    assert any("Leave site immediately" in r for r in res["recommendations"])


def test_decision_engine_confirmed_phishing_score_100():
    # Confirmed phishing with score 100 must NOT be downgraded to warn/medium or allow/low.
    engine = DecisionEngine()
    res = engine.generate_decision({
        "score": 100,
        "threat_category": "phishing",
        "data_completeness": True,
        "has_confirmed_threat": True,
    })
    assert res["severity"] == "high"
    assert res["decision"]["action"] == "block"
    assert res["decision"]["ui"]["color"] == "rose"
    assert res["threat_category"] == "phishing"
    assert any("Leave site immediately" in r for r in res["recommendations"])


def test_decision_engine_confirmed_malware_score_90():
    # Confirmed malware with score 90 must evaluate to block / high / rose.
    engine = DecisionEngine()
    res = engine.generate_decision({
        "score": 90,
        "threat_category": "malware",
        "data_completeness": True,
        "has_confirmed_threat": True,
    })
    assert res["severity"] == "high"
    assert res["decision"]["action"] == "block"
    assert res["decision"]["ui"]["color"] == "rose"
    assert res["threat_category"] == "malware"
    assert any("Leave site immediately" in r for r in res["recommendations"])


def test_decision_engine_clean_complete_scan():
    # Clean complete scan (score 100, data complete, no threat). Must evaluate to allow / low / emerald.
    engine = DecisionEngine()
    res = engine.generate_decision({
        "score": 100,
        "threat_category": "safe",
        "data_completeness": True,
        "has_confirmed_threat": False,
    })
    assert res["severity"] == "low"
    assert res["decision"]["action"] == "allow"
    assert res["decision"]["ui"]["color"] == "emerald"
    assert res["threat_category"] == "safe"
    assert any("Safe to browse" in r for r in res["recommendations"])


def test_decision_engine_inconclusive_scan_without_confirmed_threats():
    # Inconclusive scan with no threats (score 100, data incomplete). Must evaluate to warn / medium / inconclusive.
    engine = DecisionEngine()
    res = engine.generate_decision({
        "score": 100,
        "threat_category": "safe",
        "data_completeness": False,
        "has_confirmed_threat": False,
    })
    assert res["severity"] == "medium"
    assert res["decision"]["action"] == "warn"
    assert res["decision"]["ui"]["color"] == "amber"
    assert res["threat_category"] == "inconclusive"
    assert any("Threat intelligence checks could not be completed" in r for r in res["recommendations"])


def test_decision_engine_incomplete_scan_with_confirmed_threat_preserved():
    # Incomplete scan where VT flagged 1 vendor (score 90, incomplete data).
    # Confirmed threat must NOT be overwritten by 'inconclusive'.
    engine = DecisionEngine()
    res = engine.generate_decision({
        "score": 90,
        "threat_category": "malicious_domain",
        "data_completeness": False,
        "has_confirmed_threat": True,
    })
    assert res["severity"] == "medium"
    assert res["decision"]["action"] == "warn"
    assert res["decision"]["ui"]["color"] == "amber"
    assert res["threat_category"] == "malicious_domain"
    assert any("Security vendors flagged potential threats" in r for r in res["recommendations"])
    assert any("Threat intelligence checks could not be completed" in r for r in res["recommendations"])
