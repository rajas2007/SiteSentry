from src.schemas.analysis import PageAnalysisRequest


class SecurityEngine:
    """Security engine evaluating structural page features and external threat intelligence."""

    def analyze(self, request: PageAnalysisRequest) -> list[dict[str, str]]:
        signals = []
        f = request.features

        # 2. Structural & Positive Heuristic Indicators
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

        # 3. Payload & DOM Indicators
        if f.hasPasswordField or f.hasLoginForm:
            if not f.hasHttps:
                signals.append(
                    {
                        "id": "insecure_login",
                        "description": "Contains login/password fields without HTTPS",
                    }
                )

            if len(f.suspiciousKeywords) > 0:
                signals.append(
                    {
                        "id": "suspicious_login",
                        "description": f"Login form found with suspicious keywords: {', '.join(f.suspiciousKeywords[:3])}",
                    }
                )
            else:
                signals.append(
                    {"id": "has_login", "description": "Contains a login form"}
                )
        else:
            if len(f.suspiciousKeywords) > 2:
                signals.append(
                    {
                        "id": "suspicious_keywords",
                        "description": f"Multiple suspicious keywords detected without a login form: {', '.join(f.suspiciousKeywords[:3])}",
                    }
                )

        return signals
