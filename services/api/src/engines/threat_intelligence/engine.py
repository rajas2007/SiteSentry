import asyncio
import logging

import httpx

from src.core.redis import RedisCache, get_cache
from src.engines.threat_intelligence.schemas import ProviderStatus, UnifiedThreatObject
from src.integrations.safe_browsing.client import GoogleSafeBrowsingClient
from src.integrations.virustotal.client import VirusTotalClient

logger = logging.getLogger(__name__)


class ThreatIntelligenceEngine:
    """Orchestrates queries to external OSINT and threat intelligence feeds,

    normalizing findings into a UnifiedThreatObject and caching results in Redis.
    """

    def __init__(
        self,
        gsb_client: GoogleSafeBrowsingClient | None = None,
        vt_client: VirusTotalClient | None = None,
        cache: RedisCache | None = None,
    ) -> None:
        self.gsb_client = gsb_client or GoogleSafeBrowsingClient()
        self.vt_client = vt_client or VirusTotalClient()
        self.cache = cache or get_cache()

    async def lookup(self, url: str, domain: str) -> UnifiedThreatObject:
        """Query external feeds (with Redis caching) and return a UnifiedThreatObject."""
        # 1. Check Redis OSINT cache
        if self.cache:
            cached = await self.cache.get_osint(domain)
            if cached:
                logger.info(f"OSINT cache hit for domain: {domain}")
                return UnifiedThreatObject(**cached)

        # 2. Concurrently query external APIs on cache miss
        blacklists_triggered: list[str] = []
        threat_categories: list[str] = []
        total_vendor_flags = 0
        data_completeness = True
        sources: list[ProviderStatus] = []

        try:
            gsb_task = self.gsb_client.lookup_url(url)
            vt_task = self.vt_client.lookup_domain(domain)

            gsb_results, vt_results = await asyncio.gather(
                gsb_task,
                vt_task,
                return_exceptions=True,
            )

            from typing import Literal

            # Process Google Safe Browsing findings
            gsb_status: Literal["clean", "detected", "unavailable"] = "clean"
            gsb_summary = "No threats found"
            gsb_cats: list[str] = []

            if isinstance(gsb_results, list):
                if len(gsb_results) > 0:
                    gsb_status = "detected"
                    gsb_summary = "Flagged as dangerous"
                    blacklists_triggered.append("Google Safe Browsing")
                    for threat_type in gsb_results:
                        if (
                            threat_type == "SOCIAL_ENGINEERING"
                            and "Phishing" not in threat_categories
                        ):
                            threat_categories.append("Phishing")
                            gsb_cats.append("Phishing")
                        elif (
                            threat_type == "MALWARE"
                            and "Malware" not in threat_categories
                        ):
                            threat_categories.append("Malware")
                            gsb_cats.append("Malware")
                        elif threat_type not in threat_categories:
                            threat_categories.append(threat_type)
                            gsb_cats.append(threat_type)
            elif isinstance(gsb_results, Exception):
                logger.warning(f"Safe Browsing query raised exception: {gsb_results}")
                data_completeness = False
                gsb_status = "unavailable"
                gsb_summary = "Service unavailable"

            sources.append(
                ProviderStatus(
                    provider="Google Safe Browsing",
                    status=gsb_status,
                    categories=gsb_cats,
                    summary=gsb_summary,
                )
            )

            # Process VirusTotal findings
            vt_status: Literal["clean", "detected", "unavailable"] = "clean"
            vt_summary = "No security vendors flagged this domain"
            vt_cats: list[str] = []

            if isinstance(vt_results, dict):
                total_vendor_flags = vt_results.get("total_flags", 0)
                malicious_count = vt_results.get("malicious", 0)

                if malicious_count >= 3:
                    blacklists_triggered.append("VirusTotal")

                if total_vendor_flags > 0:
                    vt_status = "detected"
                    vt_summary = f"Flagged by {total_vendor_flags} security vendors"

                if (
                    malicious_count > 0
                    and "Malware" not in threat_categories
                    and "Phishing" not in threat_categories
                ):
                    threat_categories.append("Malicious Domain")
                    vt_cats.append("Malicious Domain")

                for cat in vt_results.get("categories", []):
                    cat_clean = cat.title()
                    vt_cats.append(cat_clean)
                    if cat_clean not in threat_categories:
                        threat_categories.append(cat_clean)
            elif isinstance(vt_results, Exception):
                logger.warning(f"VirusTotal query raised exception: {vt_results}")
                data_completeness = False
                vt_status = "unavailable"
                vt_summary = "Service unavailable"

            sources.append(
                ProviderStatus(
                    provider="VirusTotal",
                    status=vt_status,
                    categories=vt_cats,
                    summary=vt_summary,
                )
            )

        except (OSError, TimeoutError, httpx.HTTPError) as e:
            logger.error(f"Threat intelligence lookup encountered an error: {e}")
            data_completeness = False
            sources = [
                ProviderStatus(
                    provider="Google Safe Browsing",
                    status="unavailable",
                    summary="Service unavailable",
                ),
                ProviderStatus(
                    provider="VirusTotal",
                    status="unavailable",
                    summary="Service unavailable",
                ),
            ]

        confidence = 0.95 if blacklists_triggered else 0.90

        report = UnifiedThreatObject(
            domain=domain,
            blacklists_triggered=blacklists_triggered,
            total_vendor_flags=total_vendor_flags,
            threat_categories=threat_categories,
            confidence=confidence,
            data_completeness=data_completeness,
            sources=sources,
        )

        # 3. Cache normalized result in Redis (24-hour TTL)
        if self.cache:
            await self.cache.set_osint(domain, report.model_dump(mode="json"))

        return report
