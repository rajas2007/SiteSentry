import logging
from typing import Any

import httpx

from src.core.config import get_settings

logger = logging.getLogger(__name__)

VT_DOMAIN_ENDPOINT = "https://www.virustotal.com/api/v3/domains/{domain}"


class VirusTotalClient:
    def __init__(
        self,
        api_key: str | None = None,
        timeout: float | None = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.VIRUSTOTAL_API_KEY
        self.timeout = timeout or settings.THREAT_INTEL_TIMEOUT_SECONDS

    async def lookup_domain(self, domain: str) -> dict[str, Any]:
        """Query VirusTotal v3 for a domain's security stats.

        Returns a dictionary with detection stats:
        {'malicious': int, 'suspicious': int, 'harmless': int, 'total_flags': int, 'categories': list[str]}
        """
        empty_result: dict[str, Any] = {
            "malicious": 0,
            "suspicious": 0,
            "harmless": 0,
            "total_flags": 0,
            "categories": [],
        }

        if not self.api_key or self.api_key in ("mock_key", "dummy_key", ""):
            logger.debug(
                "VirusTotal API key not configured or set to mock; skipping live query."
            )
            return empty_result

        url = VT_DOMAIN_ENDPOINT.format(domain=domain)
        headers = {
            "x-apikey": self.api_key,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    attributes = data.get("data", {}).get("attributes", {})
                    stats = attributes.get("last_analysis_stats", {})
                    categories_dict = attributes.get("categories", {})

                    malicious = stats.get("malicious", 0)
                    suspicious = stats.get("suspicious", 0)
                    harmless = stats.get("harmless", 0)
                    total_flags = malicious + suspicious
                    categories = list(set(categories_dict.values()))

                    return {
                        "malicious": malicious,
                        "suspicious": suspicious,
                        "harmless": harmless,
                        "total_flags": total_flags,
                        "categories": categories,
                    }
                if response.status_code == 404:
                    # Domain not seen in VirusTotal database
                    return empty_result
                logger.warning(
                    f"VirusTotal returned HTTP {response.status_code}: {response.text}"
                )
        except (httpx.HTTPError, OSError) as e:
            logger.warning(f"VirusTotal lookup failed for {domain}: {e}")

        return empty_result
