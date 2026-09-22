from src.engines.score_fusion.engine import ScoreFusionEngine
from src.engines.threat_intelligence.schemas import ProviderStatus, UnifiedThreatObject


def test_score_fusion_threat_intel_detected():
    engine = ScoreFusionEngine()
    signals = [
        {"id": "https_enabled", "description": "Connection is encrypted (HTTPS)"}
    ]

    ti = UnifiedThreatObject(
        domain="example.com",
        total_vendor_flags=5,
        blacklists_triggered=[],
        threat_categories=["Malicious Domain"],
        sources=[
            ProviderStatus(
                provider="VirusTotal",
                status="detected",
                categories=["Malicious Domain"],
            )
        ],
    )

    res = engine.fuse(signals, threat_intel=ti)
    # penalty = 5 * 10 = 50
    assert res["score"] == 50
    assert res["threat_category"] == "malicious_domain"


def test_score_fusion_threat_intel_clean():
    engine = ScoreFusionEngine()
    signals = [
        {"id": "https_enabled", "description": "Connection is encrypted (HTTPS)"}
    ]

    ti = UnifiedThreatObject(
        domain="example.com",
        total_vendor_flags=0,
        blacklists_triggered=[],
        threat_categories=[],
        sources=[
            ProviderStatus(provider="VirusTotal", status="clean", categories=[]),
            ProviderStatus(
                provider="Google Safe Browsing", status="clean", categories=[]
            ),
        ],
    )

    res = engine.fuse(signals, threat_intel=ti)
    assert res["score"] == 100
    assert res["threat_category"] == "safe"


def test_score_fusion_threat_intel_unavailable():
    engine = ScoreFusionEngine()
    signals = [
        {"id": "https_enabled", "description": "Connection is encrypted (HTTPS)"}
    ]

    ti = UnifiedThreatObject(
        domain="example.com",
        total_vendor_flags=0,
        blacklists_triggered=[],
        threat_categories=[],
        sources=[
            ProviderStatus(provider="VirusTotal", status="unavailable", categories=[]),
            ProviderStatus(
                provider="Google Safe Browsing", status="unavailable", categories=[]
            ),
        ],
    )

    res = engine.fuse(signals, threat_intel=ti)
    assert res["score"] == 100
    assert res["threat_category"] == "safe"


def test_score_fusion_double_counting():
    engine = ScoreFusionEngine()
    signals = [
        {"id": "no_https", "description": "Connection is unencrypted (HTTP)"},  # -30
        {"id": "insecure_login", "description": "Login without HTTPs"},  # -40
    ]

    ti = UnifiedThreatObject(
        domain="example.com",
        total_vendor_flags=15,  # 15 * 10 = 150 -> max penalty 50
        blacklists_triggered=["Google Safe Browsing"],  # sets score to min(10, score)
        threat_categories=["Phishing", "Malware"],
        sources=[],
    )

    res = engine.fuse(signals, threat_intel=ti)
    # signals bring it to 30. vendor flags penalty max 50 -> 0. blacklists max 10 -> 0.
    assert res["score"] == 0
    assert res["threat_category"] == "phishing"


def test_score_fusion_clamp():
    engine = ScoreFusionEngine()
    # Apply lots of penalties
    signals = [
        {"id": "no_https", "description": "Connection is unencrypted (HTTP)"},  # -30
        {"id": "long_hostname", "description": "Long hostname"},  # -10
        {"id": "multiple_subdomains", "description": "Subdomains"},  # -10
        {"id": "insecure_login", "description": "Login without HTTPs"},  # -40
        {"id": "suspicious_login", "description": "Suspicious keywords"},  # -20
    ]
    # Total penalties = -110. Score would be -10. Clamped to 0.
    res = engine.fuse(signals)
    assert res["score"] == 0
