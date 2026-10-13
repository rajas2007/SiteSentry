from typing import Any


class DecisionEngine:
    """
    Translates raw scores into actionable UI states according to the Decision Matrix:
    80 - 100 : Low (Emerald, Background)
    50 - 79  : Medium (Amber, Passive Popup)
    0 - 49   : High (Rose, Active Overlay)
    """

    def generate_decision(self, security_analysis: dict[str, Any]) -> dict[str, Any]:
        score = security_analysis["score"]
        threat_category = security_analysis.get("threat_category", "unknown")
        data_completeness = security_analysis.get("data_completeness", True)
        normalized_category = threat_category.lower().strip()
        is_critical_threat = normalized_category in {"phishing", "malware"}
        has_confirmed_threat = security_analysis.get(
            "has_confirmed_threat",
            normalized_category in {"malicious_domain", "phishing", "malware"},
        )

        severity = "low"
        action = "allow"
        color = "emerald"
        recommendations: list[str] = []

        if score < 50 or is_critical_threat:
            severity = "high"
            action = "block"
            color = "rose"
            recommendations.append("Leave site immediately.")
            if threat_category == "credential_theft":
                recommendations.append("Do not enter any personal information here.")
        elif has_confirmed_threat:
            severity = "medium"
            action = "warn"
            color = "amber"
            recommendations.append(
                "Security vendors flagged potential threats on this domain; review carefully."
            )
            if not data_completeness:
                recommendations.append(
                    "Threat intelligence checks could not be completed; exercise caution on this site."
                )
        elif not data_completeness and score >= 80:
            severity = "medium"
            action = "warn"
            color = "amber"
            threat_category = "inconclusive"
            recommendations.append(
                "Threat intelligence checks could not be completed; exercise caution on this site."
            )
        elif score >= 80:
            severity = "low"
            action = "allow"
            color = "emerald"
            recommendations.append("Safe to browse.")
        else:
            severity = "medium"
            action = "warn"
            color = "amber"
            recommendations.append("Review the site carefully before proceeding.")
            if threat_category == "elevated_risk":
                recommendations.append("Site exhibits some unusual characteristics.")

        return {
            "decision": {
                "action": action,
                "severity": severity,
                "ui": {"color": color},
            },
            "severity": severity,
            "threat_category": threat_category,
            "recommendations": recommendations,
        }
