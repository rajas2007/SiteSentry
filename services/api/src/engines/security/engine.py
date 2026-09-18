from typing import Any

from src.engines.threat_intelligence.schemas import UnifiedThreatObject
from src.schemas.analysis import PageAnalysisRequest


class SecurityEngine:
    """Security engine evaluating structural page features and external threat intelligence."""

    def analyze(
        self,
        request: PageAnalysisRequest,
        threat_intel: UnifiedThreatObject | None = None,
    ) -> dict[str, Any]:
        score = 100
        factors: list[str] = []
        confidence = 0.9  # Baseline confidence for deterministic heuristics

        f = request.features

        # 1. Evaluate External Threat Intelligence Feeds
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

        # 2. Structural & Positive Heuristic Indicators
        if f.hasHttps:
            factors.append("Connection is encrypted (HTTPS)")
        else:
            score -= 30
            factors.append("Connection is unencrypted (HTTP)")

        if f.hostnameLength > 30:
            score -= 10
            factors.append("Unusually long hostname")

        if f.subdomainCount > 2:
            score -= 10
            factors.append("Multiple subdomains detected")

        # 3. Payload & DOM Indicators
        if f.hasPasswordField or f.hasLoginForm:
            if not f.hasHttps:
                score -= 40
                factors.append("Contains login/password fields without HTTPS")

            if len(f.suspiciousKeywords) > 0:
                score -= 20
                factors.append(
                    f"Login form found with suspicious keywords: {', '.join(f.suspiciousKeywords[:3])}"
                )
            else:
                factors.append("Contains a login form")
        else:
            if len(f.suspiciousKeywords) > 2:
                score -= 15
                factors.append(
                    f"Multiple suspicious keywords detected without a login form: {', '.join(f.suspiciousKeywords[:3])}"
                )

        # Ensure score boundaries
        score = max(0, min(100, score))

        # 4. Determine Threat Category
        threat_category = "safe"
        if threat_intel and threat_intel.threat_categories:
            primary_cat = threat_intel.threat_categories[0].lower().replace(" ", "_")
            threat_category = primary_cat
        elif score < 50:
            threat_category = (
                "credential_theft" if f.hasPasswordField else "suspicious_content"
            )
        elif score < 80:
            threat_category = "elevated_risk"

        return {
            "score": score,
            "factors": factors,
            "confidence": confidence,
            "threat_category": threat_category,
        }
