from typing import Any

from src.engines.privacy.schemas import PrivacyAssessment
from src.engines.threat_intelligence.schemas import UnifiedThreatObject


class ScoreFusionEngine:
    """
    Fuses security signals, threat intelligence, and privacy intelligence into one unified score.
    Produces deterministic results with clear explanatory factors.
    """

    def fuse(
        self,
        security_signals: list[dict[str, str]],
        threat_intel: UnifiedThreatObject | None = None,
        privacy_intel: PrivacyAssessment | None = None,
    ) -> dict[str, Any]:
        score = 100
        factors = []
        confidence = 0.9

        threat_category = "safe"
        has_login = False

        # 1. Fuse Threat Intelligence
        if threat_intel:
            if threat_intel.blacklists_triggered:
                score = min(score, 10)
                confidence = max(confidence, threat_intel.confidence)
                blacklist_names = ", ".join(threat_intel.blacklists_triggered)
                factors.append(f"Domain is actively blacklisted by: {blacklist_names}")
            elif threat_intel.total_vendor_flags > 0:
                penalty = min(50, threat_intel.total_vendor_flags * 10)
                score -= penalty
                factors.append(
                    f"Flagged by {threat_intel.total_vendor_flags} security vendors on VirusTotal"
                )

            if threat_intel.threat_categories:
                threat_category = (
                    threat_intel.threat_categories[0].lower().replace(" ", "_")
                )

        # 2. Fuse Security Signals
        for sig in security_signals:
            sig_id = sig["id"]
            desc = sig["description"]

            if sig_id == "https_enabled":
                factors.append(desc)
            elif sig_id == "no_https":
                score -= 30
                factors.append(desc)
            elif sig_id == "long_hostname" or sig_id == "multiple_subdomains":
                score -= 10
                factors.append(desc)
            elif sig_id == "insecure_login":
                score -= 40
                factors.append(desc)
                has_login = True
            elif sig_id == "suspicious_login":
                score -= 20
                factors.append(desc)
                has_login = True
            elif sig_id == "has_login":
                factors.append(desc)
                has_login = True
            elif sig_id == "suspicious_keywords":
                score -= 15
                factors.append(desc)

        # 3. Fuse Privacy Intelligence
        if privacy_intel:
            for finding in privacy_intel.findings:
                if finding.severity == "critical":
                    score -= 40
                    factors.append(f"Critical Privacy Risk: {finding.category}")
                    if threat_category == "safe":
                        threat_category = "privacy_abuse"
                elif finding.severity == "high":
                    score -= 20
                    factors.append(f"High Privacy Risk: {finding.category}")
                    if threat_category == "safe":
                        threat_category = "privacy_abuse"
                elif finding.severity == "medium":
                    score -= 10
                    factors.append(f"Privacy Risk: {finding.category}")

        # 4. Finalize Score & Category Boundaries
        score = max(0, min(100, score))

        if threat_category == "safe":
            if score < 50:
                threat_category = (
                    "credential_theft" if has_login else "suspicious_content"
                )
            elif score < 80:
                threat_category = "elevated_risk"

        return {
            "score": score,
            "factors": factors,
            "confidence": confidence,
            "threat_category": threat_category,
        }
