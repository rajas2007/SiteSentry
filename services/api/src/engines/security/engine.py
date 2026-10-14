from src.schemas.analysis import PageAnalysisRequest

# Standard authentication terms that legitimately appear on normal login/account pages
ROUTINE_AUTH_KEYWORDS = {"login", "sign in", "password", "account"}

# Coercive, urgency, and threat indicators frequently used in phishing attacks
COERCIVE_THREAT_KEYWORDS = {
    "urgent",
    "suspended",
    "locked",
    "unauthorized",
    "compromised",
    "deactivation",
    "terminate",
    "action required",
    "immediate",
}


class SecurityEngine:
    """Security engine evaluating structural page features and external threat intelligence."""

    def analyze(self, request: PageAnalysisRequest) -> list[dict[str, str]]:
        signals = []
        f = request.features

        # 1. Structural & Encryption Indicators
        if f.hasHttps:
            signals.append(
                {
                    "id": "https_enabled",
                    "description": "Connection is encrypted (HTTPS)",
                }
            )
        else:
            signals.append(
                {"id": "no_https", "description": "Connection is unencrypted (HTTP)"}
            )

        if f.hostnameLength > 30:
            signals.append(
                {"id": "long_hostname", "description": "Unusually long hostname"}
            )

        if f.subdomainCount > 2:
            signals.append(
                {
                    "id": "multiple_subdomains",
                    "description": "Multiple subdomains detected",
                }
            )

        # 2. Payload & Authentication Heuristics
        # Routine terms (e.g. 'login', 'password') are expected on authentication pages
        # and must not by themselves make an otherwise legitimate page suspicious.
        non_routine_keywords = [
            k
            for k in f.suspiciousKeywords
            if k.strip().lower() not in ROUTINE_AUTH_KEYWORDS
        ]
        coercive_keywords = [
            k
            for k in non_routine_keywords
            if k.strip().lower() in COERCIVE_THREAT_KEYWORDS
        ]

        if f.hasPasswordField or f.hasLoginForm:
            if not f.hasHttps:
                signals.append(
                    {
                        "id": "insecure_login",
                        "description": "Contains login/password fields without HTTPS",
                    }
                )

            # Evaluate coercive language or suspicious multi-factor combinations
            if len(coercive_keywords) > 0:
                signals.append(
                    {
                        "id": "suspicious_login",
                        "description": f"Login form found with coercive urgency or threat keywords: {', '.join(coercive_keywords[:3])}",
                    }
                )
            elif len(non_routine_keywords) >= 2 and (
                f.subdomainCount > 2 or f.hostnameLength > 30
            ):
                signals.append(
                    {
                        "id": "suspicious_login",
                        "description": f"Login form combined with suspicious domain structure and keywords: {', '.join(non_routine_keywords[:3])}",
                    }
                )
            elif len(non_routine_keywords) >= 3:
                signals.append(
                    {
                        "id": "suspicious_login",
                        "description": f"Login form accompanied by multiple suspicious keywords: {', '.join(non_routine_keywords[:3])}",
                    }
                )
            else:
                signals.append(
                    {"id": "has_login", "description": "Contains a login form"}
                )
        else:
            if len(coercive_keywords) > 0 or len(non_routine_keywords) > 2:
                matched = (
                    coercive_keywords
                    if len(coercive_keywords) > 0
                    else non_routine_keywords
                )
                signals.append(
                    {
                        "id": "suspicious_keywords",
                        "description": f"Multiple suspicious keywords detected without a login form: {', '.join(matched[:3])}",
                    }
                )

        return signals
