"""Tests for the ML Feature Extraction pipeline."""

from src.engines.machine_learning.engine import MLFeatureExtractor
from src.engines.machine_learning.schemas import (
    FEATURE_ORDER,
    FEATURE_SCHEMA_VERSION,
    MLFeatureVector,
)
from src.engines.threat_intelligence.schemas import ProviderStatus, UnifiedThreatObject
from src.schemas.analysis import PageAnalysisRequest, PageFeatures

# -- helpers ----------------------------------------------------------


def _clean_features() -> PageFeatures:
    return PageFeatures(
        hasPasswordField=False,
        hasLoginForm=False,
        formCount=0,
        externalLinkCount=5,
        iframeCount=0,
        scriptCount=3,
        imageCount=2,
        suspiciousKeywords=[],
        pageTextLength=500,
        hasHttps=True,
        hostnameLength=11,
        subdomainCount=0,
    )


def _clean_request() -> PageAnalysisRequest:
    return PageAnalysisRequest(
        url="https://example.com",
        title="Example",
        hostname="example.com",
        features=_clean_features(),
    )


def _clean_signals() -> list[dict[str, str]]:
    return [{"id": "https_enabled", "description": "Connection is encrypted (HTTPS)"}]


# -- 1. Clean page produces a valid feature vector --------------------


def test_clean_page_produces_valid_vector():
    ext = MLFeatureExtractor()
    vec = ext.extract(_clean_request(), _clean_signals())

    assert isinstance(vec, MLFeatureVector)
    assert vec.has_https is True
    assert vec.hostname_length == 11
    assert vec.subdomain_count == 0
    assert vec.has_password_field is False
    assert vec.has_login_form is False
    assert vec.form_count == 0
    assert vec.external_link_count == 5
    assert vec.iframe_count == 0
    assert vec.script_count == 3
    assert vec.image_count == 2
    assert vec.suspicious_keyword_count == 0
    assert vec.page_text_length == 500

    # All security signals false for a clean page
    assert vec.signal_no_https is False
    assert vec.signal_long_hostname is False
    assert vec.signal_multiple_subdomains is False
    assert vec.signal_insecure_login is False
    assert vec.signal_suspicious_login is False
    assert vec.signal_has_login is False
    assert vec.signal_suspicious_keywords is False


# -- 2. HTTP page -----------------------------------------------------


def test_http_page():
    feat = _clean_features()
    feat.hasHttps = False
    req = PageAnalysisRequest(
        url="http://example.com",
        title="Example",
        hostname="example.com",
        features=feat,
    )
    signals = [{"id": "no_https", "description": "Connection is unencrypted (HTTP)"}]

    vec = MLFeatureExtractor().extract(req, signals)

    assert vec.has_https is False
    assert vec.signal_no_https is True


# -- 3. Login / password signals --------------------------------------


def test_login_password_signals():
    feat = _clean_features()
    feat.hasPasswordField = True
    feat.hasLoginForm = True
    feat.hasHttps = False
    feat.suspiciousKeywords = ["verify", "urgent"]
    req = PageAnalysisRequest(
        url="http://phish.example.com",
        title="Login",
        hostname="phish.example.com",
        features=feat,
    )
    signals = [
        {"id": "no_https", "description": "No HTTPS"},
        {"id": "insecure_login", "description": "Insecure login"},
        {"id": "suspicious_login", "description": "Suspicious login keywords"},
    ]

    vec = MLFeatureExtractor().extract(req, signals)

    assert vec.has_password_field is True
    assert vec.has_login_form is True
    assert vec.signal_insecure_login is True
    assert vec.signal_suspicious_login is True
    assert vec.suspicious_keyword_count == 2


# -- 4. Subdomain signals --------------------------------------------


def test_subdomain_signals():
    feat = _clean_features()
    feat.subdomainCount = 4
    feat.hostnameLength = 40
    req = PageAnalysisRequest(
        url="https://a.b.c.d.example.com",
        title="Deep",
        hostname="a.b.c.d.example.com",
        features=feat,
    )
    signals = [
        {"id": "https_enabled", "description": "HTTPS"},
        {"id": "long_hostname", "description": "Long hostname"},
        {"id": "multiple_subdomains", "description": "Multiple subdomains"},
    ]

    vec = MLFeatureExtractor().extract(req, signals)

    assert vec.subdomain_count == 4
    assert vec.hostname_length == 40
    assert vec.signal_long_hostname is True
    assert vec.signal_multiple_subdomains is True


# -- 5. Suspicious keywords signal -----------------------------------


def test_suspicious_keywords_signal():
    feat = _clean_features()
    feat.suspiciousKeywords = ["verify", "urgent", "account"]
    req = PageAnalysisRequest(
        url="https://example.com",
        title="Example",
        hostname="example.com",
        features=feat,
    )
    signals = [
        {"id": "https_enabled", "description": "HTTPS"},
        {"id": "suspicious_keywords", "description": "Suspicious keywords"},
    ]

    vec = MLFeatureExtractor().extract(req, signals)

    assert vec.suspicious_keyword_count == 3
    assert vec.signal_suspicious_keywords is True


# -- 6. VT detected --------------------------------------------------


def test_vt_detected():
    ti = UnifiedThreatObject(
        domain="bad.com",
        total_vendor_flags=7,
        blacklists_triggered=["VirusTotal"],
        threat_categories=["Malware"],
        sources=[
            ProviderStatus(
                provider="VirusTotal",
                status="detected",
                categories=["Malware"],
            ),
            ProviderStatus(
                provider="Google Safe Browsing",
                status="clean",
                categories=[],
            ),
        ],
    )

    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals(), ti)

    assert vec.vt_available is True
    assert vec.vt_detection_count == 7
    assert vec.ti_blacklist_count == 1
    assert vec.ti_category_count == 1
    assert vec.gsb_available is True
    assert vec.gsb_detected is False


# -- 7. VT unavailable != VT clean ------------------------------------


def test_vt_unavailable():
    ti = UnifiedThreatObject(
        domain="example.com",
        total_vendor_flags=0,
        data_completeness=False,
        sources=[
            ProviderStatus(
                provider="VirusTotal",
                status="unavailable",
                categories=[],
            ),
            ProviderStatus(
                provider="Google Safe Browsing",
                status="clean",
                categories=[],
            ),
        ],
    )

    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals(), ti)

    assert vec.vt_available is False
    assert vec.vt_detection_count == 0
    assert vec.ti_data_complete is False

    # Compare with a genuinely clean VT result
    ti_clean = UnifiedThreatObject(
        domain="example.com",
        total_vendor_flags=0,
        data_completeness=True,
        sources=[
            ProviderStatus(provider="VirusTotal", status="clean", categories=[]),
            ProviderStatus(
                provider="Google Safe Browsing", status="clean", categories=[]
            ),
        ],
    )

    vec_clean = MLFeatureExtractor().extract(
        _clean_request(), _clean_signals(), ti_clean
    )

    assert vec_clean.vt_available is True
    assert vec_clean.vt_detection_count == 0
    assert vec_clean.ti_data_complete is True

    # Critical: unavailable and clean must be distinguishable
    assert vec.vt_available != vec_clean.vt_available


# -- 8. GSB detected and GSB unavailable ------------------------------


def test_gsb_detected():
    ti = UnifiedThreatObject(
        domain="bad.com",
        blacklists_triggered=["Google Safe Browsing"],
        threat_categories=["Phishing"],
        sources=[
            ProviderStatus(
                provider="Google Safe Browsing",
                status="detected",
                categories=["Phishing"],
            ),
            ProviderStatus(provider="VirusTotal", status="clean", categories=[]),
        ],
    )

    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals(), ti)

    assert vec.gsb_available is True
    assert vec.gsb_detected is True
    assert vec.ti_blacklist_count == 1


def test_gsb_unavailable():
    ti = UnifiedThreatObject(
        domain="example.com",
        data_completeness=False,
        sources=[
            ProviderStatus(
                provider="Google Safe Browsing",
                status="unavailable",
                categories=[],
            ),
            ProviderStatus(provider="VirusTotal", status="clean", categories=[]),
        ],
    )

    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals(), ti)

    assert vec.gsb_available is False
    assert vec.gsb_detected is False

    # Clean GSB for comparison
    ti_clean = UnifiedThreatObject(
        domain="example.com",
        sources=[
            ProviderStatus(
                provider="Google Safe Browsing", status="clean", categories=[]
            ),
            ProviderStatus(provider="VirusTotal", status="clean", categories=[]),
        ],
    )

    vec_clean = MLFeatureExtractor().extract(
        _clean_request(), _clean_signals(), ti_clean
    )

    assert vec_clean.gsb_available is True
    assert vec_clean.gsb_detected is False

    # Critical: unavailable and clean must be distinguishable
    assert vec.gsb_available != vec_clean.gsb_available


# -- 9. Feature schema version ----------------------------------------


def test_feature_schema_version():
    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals())
    assert vec.feature_schema_version == "v1"
    assert vec.feature_schema_version == FEATURE_SCHEMA_VERSION


# -- 10-11. No raw HTML, no passwords/form values --------------------


def test_no_raw_html_or_passwords():
    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals())
    dumped = vec.model_dump()

    for value in dumped.values():
        if isinstance(value, str):
            assert "<html" not in value.lower()
            assert "<script" not in value.lower()
            assert "password" not in value.lower()


# -- 12-13. No final score, severity, decision in output --------------


def test_no_score_leakage():
    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals())
    dumped = vec.model_dump()
    field_names = set(dumped.keys())

    # Target / leakage fields must not exist
    assert "score" not in field_names
    assert "severity" not in field_names
    assert "confidence" not in field_names
    assert "threat_category" not in field_names
    assert "action" not in field_names
    assert "decision" not in field_names
    assert "color" not in field_names
    assert "recommendations" not in field_names
    assert "factors" not in field_names


# -- 14. Determinism - same input -> identical output ------------------


def test_determinism():
    ext = MLFeatureExtractor()
    ti = UnifiedThreatObject(
        domain="example.com",
        total_vendor_flags=3,
        blacklists_triggered=["VirusTotal"],
        threat_categories=["Malware"],
        sources=[
            ProviderStatus(
                provider="VirusTotal", status="detected", categories=["Malware"]
            ),
            ProviderStatus(
                provider="Google Safe Browsing", status="clean", categories=[]
            ),
        ],
    )

    vec_a = ext.extract(_clean_request(), _clean_signals(), ti)
    vec_b = ext.extract(_clean_request(), _clean_signals(), ti)

    assert vec_a == vec_b
    assert vec_a.to_ordered_list() == vec_b.to_ordered_list()


# -- 15. Canonical ordering -------------------------------------------


def test_canonical_ordering():
    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals())
    ordered = vec.to_ordered_list()

    assert len(ordered) == len(FEATURE_ORDER)
    assert all(isinstance(v, float) for v in ordered)

    # Verify positional correctness for known fields
    idx_https = FEATURE_ORDER.index("has_https")
    assert ordered[idx_https] == 1.0  # True -> 1.0

    idx_password = FEATURE_ORDER.index("has_password_field")
    assert ordered[idx_password] == 0.0  # False -> 0.0

    idx_hostname_len = FEATURE_ORDER.index("hostname_length")
    assert ordered[idx_hostname_len] == 11.0


# -- 16. No TI at all ------------------------------------------------


def test_no_threat_intel():
    vec = MLFeatureExtractor().extract(_clean_request(), _clean_signals(), None)

    assert vec.vt_available is False
    assert vec.vt_detection_count == 0
    assert vec.gsb_available is False
    assert vec.gsb_detected is False
    assert vec.ti_blacklist_count == 0
    assert vec.ti_category_count == 0
    assert vec.ti_data_complete is False
