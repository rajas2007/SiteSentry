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

        severity = "low"
        action = "allow"
        color = "emerald"
        recommendations: list[str] = []

        if score >= 80:
            severity = "low"
            action = "allow"
            color = "emerald"
            recommendations.append("Safe to browse.")
        elif score >= 50:
            severity = "medium"
            action = "warn"
            color = "amber"
            recommendations.append("Review the site carefully before proceeding.")
            if threat_category == "elevated_risk":
                recommendations.append("Site exhibits some unusual characteristics.")
        else:
            severity = "high"
            action = "block"
            color = "rose"
            recommendations.append("Leave site immediately.")
            if threat_category == "credential_theft":
                recommendations.append("Do not enter any personal information here.")

        return {
            "decision": {
                "action": action,
                "severity": severity,
                "ui": {"color": color},
            },
            "severity": severity,
            "recommendations": recommendations,
        }
