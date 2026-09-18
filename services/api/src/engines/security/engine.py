from typing import Any

from src.schemas.analysis import PageAnalysisRequest


class SecurityEngine:
    """
    Minimal deterministic security engine for MVP.
    Analyzes structural page features to calculate a basic risk score.
    """

    def analyze(self, request: PageAnalysisRequest) -> dict[str, Any]:
        score = 100
        factors: list[str] = []
        confidence = 0.9  # High confidence because it's deterministic

        f = request.features

        # Positive indicators
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

        # Risk indicators
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

        threat_category = "safe"
        if score < 50:
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
