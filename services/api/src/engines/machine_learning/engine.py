"""
ML Feature Extractor

Pure, deterministic converter that transforms existing pipeline data into
a typed MLFeatureVector.  Makes no HTTP calls, no DB access, no score
calculations.  All inputs come from earlier pipeline stages:

    PageAnalysisRequest  ->  page / URL / DOM features
    SecurityEngine       ->  structural security signals
    UnifiedThreatObject  ->  normalized threat intelligence
"""

from src.engines.machine_learning.schemas import MLFeatureVector
from src.engines.threat_intelligence.schemas import UnifiedThreatObject
from src.schemas.analysis import PageAnalysisRequest


class MLFeatureExtractor:
    """Extracts a stable, typed ML feature vector from existing pipeline data."""

    def extract(
        self,
        request: PageAnalysisRequest,
        security_signals: list[dict[str, str]],
        threat_intel: UnifiedThreatObject | None = None,
    ) -> MLFeatureVector:
        """Build an MLFeatureVector from pipeline inputs.

        Args:
            request: The validated page analysis request containing URL
                     metadata and DOM-extracted ``PageFeatures``.
            security_signals: Signal dicts produced by ``SecurityEngine.analyze()``.
                              Each dict has ``{"id": str, "description": str}``.
            threat_intel: Normalized threat-intelligence result, or ``None``
                          if the TI lookup was skipped / wholly unavailable.

        Returns:
            A fully populated ``MLFeatureVector`` with schema version tag.
        """
        f = request.features

        # -- Security signal set ---------------------------------------
        signal_ids: set[str] = {sig["id"] for sig in security_signals}

        # -- Threat Intelligence provider availability -----------------
        vt_available = False
        gsb_available = False
        gsb_detected = False

        if threat_intel is not None:
            for source in threat_intel.sources:
                if source.provider == "VirusTotal":
                    vt_available = source.status != "unavailable"
                elif source.provider == "Google Safe Browsing":
                    gsb_available = source.status != "unavailable"
                    gsb_detected = source.status == "detected"

        return MLFeatureVector(
            # URL / Page
            has_https=f.hasHttps,
            hostname_length=f.hostnameLength,
            url_length=len(str(request.url)),
            subdomain_count=f.subdomainCount,
            # DOM / Structural
            has_password_field=f.hasPasswordField,
            has_login_form=f.hasLoginForm,
            form_count=f.formCount,
            external_link_count=f.externalLinkCount,
            iframe_count=f.iframeCount,
            script_count=f.scriptCount,
            image_count=f.imageCount,
            suspicious_keyword_count=len(f.suspiciousKeywords),
            page_text_length=f.pageTextLength,
            # Security signals
            signal_no_https="no_https" in signal_ids,
            signal_long_hostname="long_hostname" in signal_ids,
            signal_multiple_subdomains="multiple_subdomains" in signal_ids,
            signal_insecure_login="insecure_login" in signal_ids,
            signal_suspicious_login="suspicious_login" in signal_ids,
            signal_has_login="has_login" in signal_ids,
            signal_suspicious_keywords="suspicious_keywords" in signal_ids,
            # Threat Intelligence
            vt_available=vt_available,
            vt_detection_count=(threat_intel.total_vendor_flags if threat_intel else 0),
            gsb_available=gsb_available,
            gsb_detected=gsb_detected,
            ti_blacklist_count=(
                len(threat_intel.blacklists_triggered) if threat_intel else 0
            ),
            ti_category_count=(
                len(threat_intel.threat_categories) if threat_intel else 0
            ),
            ti_data_complete=(
                threat_intel.data_completeness if threat_intel else False
            ),
        )
