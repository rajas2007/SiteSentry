"""
ML Feature Vector Schema -- v1

Defines the canonical, versioned, typed feature vector for ML model input.
All features are deterministic derivatives of existing pipeline data.
No new data collection is introduced.

CANONICAL FEATURE ORDER
========================
The FEATURE_ORDER tuple defines the exact positional ordering used when
converting the structured feature object into a numeric model-ready vector.
This ordering MUST remain stable within a schema version. If features are
added, removed, or reordered, the schema version MUST be incremented.

EXCLUDED FIELDS (target / score leakage)
=========================================
- score, severity, confidence, threat_category
- decision.action, decision.ui.color
- recommendations, factors

EXCLUDED FIELDS (privacy)
==========================
- passwords, form values, cookies, auth tokens
- raw HTML, raw provider API responses
- browsing history, localStorage, sessionStorage
"""

from pydantic import BaseModel, Field

# ----------------------------------------------------------------------
# Schema version -- increment when feature definitions change.
# ----------------------------------------------------------------------
FEATURE_SCHEMA_VERSION = "v1"

# ----------------------------------------------------------------------
# Canonical feature ordering for numeric vector conversion.
# Position 0 .. N-1. This tuple is the single source of truth.
# ----------------------------------------------------------------------
FEATURE_ORDER: tuple[str, ...] = (
    # -- URL / Page features -------------------------------------------
    "has_https",  # 0  - PageFeatures.hasHttps
    "hostname_length",  # 1  - PageFeatures.hostnameLength
    "url_length",  # 2  - derived: len(str(request.url))
    "subdomain_count",  # 3  - PageFeatures.subdomainCount
    # -- DOM / Structural features -------------------------------------
    "has_password_field",  # 4  - PageFeatures.hasPasswordField
    "has_login_form",  # 5  - PageFeatures.hasLoginForm
    "form_count",  # 6  - PageFeatures.formCount
    "external_link_count",  # 7  - PageFeatures.externalLinkCount
    "iframe_count",  # 8  - PageFeatures.iframeCount
    "script_count",  # 9  - PageFeatures.scriptCount
    "image_count",  # 10 - PageFeatures.imageCount
    "suspicious_keyword_count",  # 11 - derived: len(PageFeatures.suspiciousKeywords)
    "page_text_length",  # 12 - PageFeatures.pageTextLength
    # -- Security signal features --------------------------------------
    "signal_no_https",  # 13 - SecurityEngine signal ID: no_https
    "signal_long_hostname",  # 14 - SecurityEngine signal ID: long_hostname
    "signal_multiple_subdomains",  # 15 - SecurityEngine signal ID: multiple_subdomains
    "signal_insecure_login",  # 16 - SecurityEngine signal ID: insecure_login
    "signal_suspicious_login",  # 17 - SecurityEngine signal ID: suspicious_login
    "signal_has_login",  # 18 - SecurityEngine signal ID: has_login
    "signal_suspicious_keywords",  # 19 - SecurityEngine signal ID: suspicious_keywords
    # -- Threat Intelligence features ----------------------------------
    "vt_available",  # 20 - ProviderStatus(provider="VirusTotal").status != "unavailable"
    "vt_detection_count",  # 21 - UnifiedThreatObject.total_vendor_flags
    "gsb_available",  # 22 - ProviderStatus(provider="Google Safe Browsing").status != "unavailable"
    "gsb_detected",  # 23 - ProviderStatus(provider="Google Safe Browsing").status == "detected"
    "ti_blacklist_count",  # 24 - derived: len(UnifiedThreatObject.blacklists_triggered)
    "ti_category_count",  # 25 - derived: len(UnifiedThreatObject.threat_categories)
    "ti_data_complete",  # 26 - UnifiedThreatObject.data_completeness
)


class MLFeatureVector(BaseModel):
    """
    Typed ML feature vector -- v1.

    Fields are declared in FEATURE_ORDER to guarantee stable serialization.
    Use ``to_ordered_list()`` to obtain a positional numeric vector suitable
    for tree-based models (XGBoost / LightGBM).
    """

    # -- Metadata (not a model input -- for reproducibility) -----------
    feature_schema_version: str = Field(
        default=FEATURE_SCHEMA_VERSION,
        description="Schema version for reproducibility. Not a model feature.",
    )

    # -- URL / Page features -------------------------------------------
    has_https: bool = Field(
        description="Source: PageFeatures.hasHttps",
    )
    hostname_length: int = Field(
        description="Source: PageFeatures.hostnameLength",
    )
    url_length: int = Field(
        description="Source: derived - len(str(request.url))",
    )
    subdomain_count: int = Field(
        description="Source: PageFeatures.subdomainCount",
    )

    # -- DOM / Structural features -------------------------------------
    has_password_field: bool = Field(
        description="Source: PageFeatures.hasPasswordField",
    )
    has_login_form: bool = Field(
        description="Source: PageFeatures.hasLoginForm",
    )
    form_count: int = Field(
        description="Source: PageFeatures.formCount",
    )
    external_link_count: int = Field(
        description="Source: PageFeatures.externalLinkCount",
    )
    iframe_count: int = Field(
        description="Source: PageFeatures.iframeCount",
    )
    script_count: int = Field(
        description="Source: PageFeatures.scriptCount",
    )
    image_count: int = Field(
        description="Source: PageFeatures.imageCount",
    )
    suspicious_keyword_count: int = Field(
        description="Source: derived - len(PageFeatures.suspiciousKeywords)",
    )
    page_text_length: int = Field(
        description="Source: PageFeatures.pageTextLength",
    )

    # -- Security signal features --------------------------------------
    signal_no_https: bool = Field(
        default=False,
        description="Source: SecurityEngine signal ID 'no_https'",
    )
    signal_long_hostname: bool = Field(
        default=False,
        description="Source: SecurityEngine signal ID 'long_hostname'",
    )
    signal_multiple_subdomains: bool = Field(
        default=False,
        description="Source: SecurityEngine signal ID 'multiple_subdomains'",
    )
    signal_insecure_login: bool = Field(
        default=False,
        description="Source: SecurityEngine signal ID 'insecure_login'",
    )
    signal_suspicious_login: bool = Field(
        default=False,
        description="Source: SecurityEngine signal ID 'suspicious_login'",
    )
    signal_has_login: bool = Field(
        default=False,
        description="Source: SecurityEngine signal ID 'has_login'",
    )
    signal_suspicious_keywords: bool = Field(
        default=False,
        description="Source: SecurityEngine signal ID 'suspicious_keywords'",
    )

    # -- Threat Intelligence features ----------------------------------
    vt_available: bool = Field(
        default=False,
        description="Source: ProviderStatus(provider='VirusTotal').status != 'unavailable'",
    )
    vt_detection_count: int = Field(
        default=0,
        description="Source: UnifiedThreatObject.total_vendor_flags",
    )
    gsb_available: bool = Field(
        default=False,
        description="Source: ProviderStatus(provider='Google Safe Browsing').status != 'unavailable'",
    )
    gsb_detected: bool = Field(
        default=False,
        description="Source: ProviderStatus(provider='Google Safe Browsing').status == 'detected'",
    )
    ti_blacklist_count: int = Field(
        default=0,
        description="Source: derived - len(UnifiedThreatObject.blacklists_triggered)",
    )
    ti_category_count: int = Field(
        default=0,
        description="Source: derived - len(UnifiedThreatObject.threat_categories)",
    )
    ti_data_complete: bool = Field(
        default=True,
        description="Source: UnifiedThreatObject.data_completeness",
    )

    def to_ordered_list(self) -> list[float]:
        """Convert to a positional numeric vector in FEATURE_ORDER.

        Booleans are cast to 0.0 / 1.0.  Integers are cast to float.
        ``feature_schema_version`` is excluded (metadata only).
        """
        values: list[float] = []
        for name in FEATURE_ORDER:
            raw = getattr(self, name)
            values.append(float(raw) if isinstance(raw, (bool, int, float)) else 0.0)
        return values
