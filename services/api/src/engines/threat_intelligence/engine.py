import asyncio
import logging
from typing import Literal

import httpx

from src.core.redis import RedisCache, get_cache
from src.engines.threat_intelligence.schemas import ProviderStatus, UnifiedThreatObject
from src.integrations.safe_browsing.client import GoogleSafeBrowsingClient
from src.integrations.virustotal.client import VirusTotalClient
from src.utils.url import InvalidURLError, prepare_url_for_provider

logger = logging.getLogger(__name__)


def _sanitize_exception_summary(exc: Exception) -> str:
    """Map provider exceptions to clean, safe summaries without reflecting raw error details."""
    msg = str(exc)
    msg_lower = msg.lower()

    if "api key not configured" in msg_lower or "not configured" in msg_lower:
        return "API key not configured"
    if "404" in msg or "not found" in msg_lower:
        return "Domain not found on provider (HTTP 404)"
    if "time" in msg_lower and ("out" in msg_lower or "timeout" in msg_lower):
        return "Lookup timed out"
    if "rate limit" in msg_lower or "429" in msg:
        return "Rate limit exceeded"
    if "401" in msg or "unauthorized" in msg_lower:
        return "Provider authentication failed"
    if "connect" in msg_lower:
        return "Connection failed"
    return "Service unavailable"


class ThreatIntelligenceEngine:
    """Orchestrates queries to external OSINT and threat intelligence feeds,

    normalizing findings into a UnifiedThreatObject and caching domain results in Redis.
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
        """Query external feeds with domain OSINT caching and per-URL GSB protection."""
        vt_cached_obj: UnifiedThreatObject | None = None

        # 1. Check Redis OSINT cache for domain-level findings
        if self.cache:
            try:
                cached = await self.cache.get_osint(domain)
                if cached:
                    loaded = UnifiedThreatObject(**cached)
                    # Self-healing legacy guard: if contaminated with GSB entries, treat as miss
                    has_legacy_gsb = (
                        any(
                            s.provider == "Google Safe Browsing" for s in loaded.sources
                        )
                        or "Google Safe Browsing" in loaded.blacklists_triggered
                    )
                    if not has_legacy_gsb and loaded.data_completeness:
                        logger.info("OSINT cache hit for domain: %s", domain)
                        vt_cached_obj = loaded
            except (OSError, ValueError, TypeError, KeyError) as e:
                logger.warning(
                    "OSINT cache read encountered an error: %s",
                    type(e).__name__,
                )

        # 2. Determine GSB eligibility & prepare URL
        try:
            provider_url = prepare_url_for_provider(url)
        except InvalidURLError:
            provider_url = None

        # 3. Concurrently execute required live provider queries
        # If VT was cached, only query GSB; otherwise query both
        gsb_coro = (
            self.gsb_client.lookup_url(provider_url)
            if provider_url is not None
            else None
        )
        vt_coro = (
            self.vt_client.lookup_domain(domain) if vt_cached_obj is None else None
        )

        gsb_results = None
        vt_results = None

        try:
            if gsb_coro is not None and vt_coro is not None:
                gsb_results, vt_results = await asyncio.gather(
                    gsb_coro,
                    vt_coro,
                    return_exceptions=True,
                )
            elif gsb_coro is not None:
                gsb_results_list = await asyncio.gather(
                    gsb_coro,
                    return_exceptions=True,
                )
                gsb_results = gsb_results_list[0]
            elif vt_coro is not None:
                vt_results_list = await asyncio.gather(
                    vt_coro,
                    return_exceptions=True,
                )
                vt_results = vt_results_list[0]
        except (OSError, TimeoutError, httpx.HTTPError) as e:
            logger.error(
                "Threat intelligence lookup encountered an error: %s",
                type(e).__name__,
            )
            if gsb_coro is not None and gsb_results is None:
                gsb_results = e
            if vt_coro is not None and vt_results is None:
                vt_results = e

        # 4. Process Google Safe Browsing findings (always evaluated per-URL)
        blacklists_triggered: list[str] = []
        threat_categories: list[str] = []
        gsb_status: Literal["clean", "detected", "unavailable", "skipped_privacy"] = (
            "clean"
        )
        gsb_summary = "No threats found"
        gsb_cats: list[str] = []
        gsb_data_completeness = True

        if provider_url is None:
            gsb_status = "skipped_privacy"
            gsb_summary = "Lookup skipped for privacy protection"
            gsb_cats = []
            gsb_data_completeness = True
        elif isinstance(gsb_results, list):
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
                        threat_type == "MALWARE" and "Malware" not in threat_categories
                    ):
                        threat_categories.append("Malware")
                        gsb_cats.append("Malware")
                    elif threat_type not in threat_categories:
                        threat_categories.append(threat_type)
                        gsb_cats.append(threat_type)
        elif isinstance(gsb_results, Exception):
            logger.warning(
                "Safe Browsing query raised exception: %s",
                type(gsb_results).__name__,
            )
            gsb_data_completeness = False
            gsb_status = "unavailable"
            gsb_summary = _sanitize_exception_summary(gsb_results)

        gsb_provider_status = ProviderStatus(
            provider="Google Safe Browsing",
            status=gsb_status,
            categories=gsb_cats,
            summary=gsb_summary,
        )

        # 5. Process VirusTotal findings (from cache or live query)
        total_vendor_flags = 0
        vt_data_completeness = True
        vt_provider_status: ProviderStatus
        domain_age_days: int | None = None
        community_flags = 0
        registrar_reputation = "unknown"

        if vt_cached_obj is not None:
            domain_age_days = vt_cached_obj.domain_age_days
            community_flags = vt_cached_obj.community_flags
            registrar_reputation = vt_cached_obj.registrar_reputation
            total_vendor_flags = vt_cached_obj.total_vendor_flags
            vt_data_completeness = vt_cached_obj.data_completeness

            cached_vt_src = next(
                (s for s in vt_cached_obj.sources if s.provider == "VirusTotal"),
                None,
            )
            if cached_vt_src:
                vt_provider_status = cached_vt_src
                for cat in cached_vt_src.categories:
                    if cat not in threat_categories:
                        threat_categories.append(cat)
            else:
                vt_provider_status = ProviderStatus(
                    provider="VirusTotal",
                    status="clean",
                    categories=[],
                    summary="No security vendors flagged this domain",
                )

            for bl in vt_cached_obj.blacklists_triggered:
                if bl == "VirusTotal" and "VirusTotal" not in blacklists_triggered:
                    blacklists_triggered.append("VirusTotal")
        else:
            vt_status: Literal[
                "clean", "detected", "unavailable", "skipped_privacy"
            ] = "clean"
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
                logger.warning(
                    "VirusTotal query raised exception: %s",
                    type(vt_results).__name__,
                )
                vt_data_completeness = False
                vt_status = "unavailable"
                vt_summary = _sanitize_exception_summary(vt_results)
            else:
                vt_data_completeness = False
                vt_status = "unavailable"
                vt_summary = "Service unavailable"

            vt_provider_status = ProviderStatus(
                provider="VirusTotal",
                status=vt_status,
                categories=vt_cats,
                summary=vt_summary,
            )

            # Cache VT-only domain intelligence if VT lookup was complete
            if self.cache and vt_data_completeness:
                vt_domain_bl = (
                    ["VirusTotal"] if "VirusTotal" in blacklists_triggered else []
                )
                vt_domain_cats = [c for c in vt_cats if c in threat_categories]
                domain_cache_record = UnifiedThreatObject(
                    domain=domain,
                    domain_age_days=domain_age_days,
                    blacklists_triggered=vt_domain_bl,
                    total_vendor_flags=total_vendor_flags,
                    community_flags=community_flags,
                    threat_categories=vt_domain_cats,
                    registrar_reputation=registrar_reputation,
                    confidence=0.90 if vt_status == "clean" else 0.85,
                    data_completeness=True,
                    sources=[vt_provider_status],
                )
                try:
                    await self.cache.set_osint(
                        domain, domain_cache_record.model_dump(mode="json")
                    )
                except (OSError, ValueError, TypeError) as e:
                    logger.warning(
                        "OSINT cache write encountered an error: %s",
                        type(e).__name__,
                    )

        # 6. Synthesize combined report
        data_completeness = gsb_data_completeness and vt_data_completeness
        sources = [gsb_provider_status, vt_provider_status]

        if blacklists_triggered:
            confidence = 0.95
        elif total_vendor_flags > 0:
            confidence = 0.85 if not data_completeness else 0.90
        elif data_completeness:
            confidence = 0.90
        elif any(s.status == "clean" for s in sources):
            confidence = 0.70
        else:
            confidence = 0.50

        return UnifiedThreatObject(
            domain=domain,
            domain_age_days=domain_age_days,
            blacklists_triggered=blacklists_triggered,
            total_vendor_flags=total_vendor_flags,
            community_flags=community_flags,
            threat_categories=threat_categories,
            registrar_reputation=registrar_reputation,
            confidence=confidence,
            data_completeness=data_completeness,
            sources=sources,
        )
