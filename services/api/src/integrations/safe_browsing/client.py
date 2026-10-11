import logging
from typing import Any

import httpx

from src.core.config import get_settings
from src.integrations.exceptions import ThreatIntelUnavailableError

logger = logging.getLogger(__name__)

GSB_API_ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find"


class GoogleSafeBrowsingClient:
    def __init__(
        self,
        api_key: str | None = None,
        timeout: float | None = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.GOOGLE_SAFE_BROWSING_API_KEY
        self.timeout = timeout or settings.THREAT_INTEL_TIMEOUT_SECONDS

    async def lookup_url(self, url: str) -> list[str]:
        """Query Google Safe Browsing v4 for known threats.

        Returns a list of threat types (e.g. ['SOCIAL_ENGINEERING', 'MALWARE'])
        or empty list if safe. Raises ThreatIntelUnavailableError on missing credentials or error.
        """
        if not self.api_key or self.api_key in ("mock_key", "dummy_key", ""):
            logger.debug(
                "Google Safe Browsing API key not configured or set to mock; skipping live query."
            )
            raise ThreatIntelUnavailableError("API key not configured")

        payload: dict[str, Any] = {
            "client": {"clientId": "sitesentry", "clientVersion": "0.1.0"},
            "threatInfo": {
                "threatTypes": [
                    "MALWARE",
                    "SOCIAL_ENGINEERING",
                    "UNWANTED_SOFTWARE",
                    "POTENTIALLY_HARMFUL_APPLICATION",
                ],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}],
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    GSB_API_ENDPOINT,
                    params={"key": self.api_key},
                    json=payload,
                )
                if response.status_code == 200:
                    data = response.json()
                    matches = data.get("matches", [])
                    return [
                        match.get("threatType", "UNKNOWN_THREAT") for match in matches
                    ]
                logger.warning(
                    f"Google Safe Browsing returned HTTP {response.status_code}: {response.text}"
                )
                raise ThreatIntelUnavailableError(
                    f"Google Safe Browsing returned HTTP {response.status_code}",
                    status_code=response.status_code,
                )
        except httpx.TimeoutException as e:
            logger.warning(f"Google Safe Browsing lookup timed out for {url}: {e}")
            raise ThreatIntelUnavailableError("Google Safe Browsing timed out") from e
        except (httpx.HTTPError, OSError) as e:
            logger.warning(f"Google Safe Browsing lookup failed for {url}: {e}")
            raise ThreatIntelUnavailableError(f"Google Safe Browsing lookup failed: {e}") from e
