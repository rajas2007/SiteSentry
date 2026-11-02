import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.redis import RedisCache, get_cache
from src.engines.decision.engine import DecisionEngine
from src.engines.privacy.engine import PrivacyIntelligenceEngine
from src.engines.score_fusion.engine import ScoreFusionEngine
from src.engines.security.engine import SecurityEngine
from src.engines.threat_intelligence.engine import ThreatIntelligenceEngine
from src.engines.threat_intelligence.schemas import UnifiedThreatObject
from src.models.domain_reputation import DomainReputation
from src.models.scan import ScanHistory
from src.schemas.analysis import PageAnalysisRequest, PageAnalysisResponse
from src.utils.url import prepare_url_for_persistence

logger = logging.getLogger(__name__)


class ScanService:
    def __init__(
        self,
        security_engine: SecurityEngine | None = None,
        decision_engine: DecisionEngine | None = None,
        threat_intel_engine: ThreatIntelligenceEngine | None = None,
        score_fusion_engine: ScoreFusionEngine | None = None,
        privacy_engine: PrivacyIntelligenceEngine | None = None,
        cache: RedisCache | None = None,
    ) -> None:
        self.security_engine = security_engine or SecurityEngine()
        self.decision_engine = decision_engine or DecisionEngine()
        self.threat_intel_engine = threat_intel_engine or ThreatIntelligenceEngine()
        self.score_fusion_engine = score_fusion_engine or ScoreFusionEngine()
        self.privacy_engine = privacy_engine or PrivacyIntelligenceEngine()
        self.cache = cache or get_cache()

    async def analyze_page(
        self,
        request: PageAnalysisRequest,
        db: AsyncSession | None = None,
    ) -> PageAnalysisResponse:
        url_str = str(request.url)

        # 1. Check Redis cache
        cached = await self.cache.get_analysis(request)
        if cached:
            logger.info(
                "Cache hit for analysis domain=%s",
                request.hostname,
            )
            # Fresh analysis_id requirement: never return stale analysis_id on cache hit.
            # Do not mutate the cached dictionary in place.
            cached_copy = dict(cached)
            cached_copy["analysis_id"] = str(uuid.uuid4())
            response = PageAnalysisResponse(**cached_copy)
            if db is not None:
                await self._persist_scan(db, request, response, threat_intel=None)
            return response

        # 2. Query external Threat Intelligence Feeds (Google Safe Browsing & VirusTotal)
        threat_intel = await self.threat_intel_engine.lookup(
            url=url_str,
            domain=request.hostname,
        )

        # 3. Privacy Intelligence Analysis
        privacy_intel = await self.privacy_engine.analyze(
            raw_page_text=request.privacy_policy_text,
            third_party_cookie_count=request.third_party_cookie_count,
        )

        # 4. Run security engine to extract structural signals
        security_signals = self.security_engine.analyze(request)

        # 5. Fuse signals, external threat intel, and privacy intel into one authoritative score
        fusion_result = self.score_fusion_engine.fuse(
            security_signals=security_signals,
            threat_intel=threat_intel,
            privacy_intel=privacy_intel,
        )

        # 6. Generate decision state from fused score
        decision_result = self.decision_engine.generate_decision(fusion_result)

        from src.schemas.analysis import (
            ProviderStatusResponse,
            ThreatIntelligenceResponse,
        )

        ti_response = None
        if threat_intel and threat_intel.sources:
            ti_response = ThreatIntelligenceResponse(
                sources=[
                    ProviderStatusResponse(
                        provider=s.provider,
                        status=s.status,
                        categories=s.categories,
                        summary=s.summary,
                    )
                    for s in threat_intel.sources
                ]
            )

        analysis_id = str(uuid.uuid4())
        response = PageAnalysisResponse(
            analysis_id=analysis_id,
            score=fusion_result["score"],
            severity=decision_result["severity"],
            confidence=fusion_result["confidence"],
            threat_category=decision_result.get(
                "threat_category", fusion_result["threat_category"]
            ),
            recommendations=decision_result["recommendations"],
            factors=fusion_result["factors"],
            decision=decision_result["decision"],
            threat_intelligence=ti_response,
        )

        # 7. Store in Redis cache only if data completeness is complete
        if fusion_result.get("data_completeness", True):
            await self.cache.set_analysis(request, response.model_dump(mode="json"))

        # 8. Asynchronously persist to PostgreSQL if DB session is provided
        if db is not None:
            await self._persist_scan(db, request, response, threat_intel=threat_intel)

        return response

    async def _persist_scan(
        self,
        db: AsyncSession,
        request: PageAnalysisRequest,
        response: PageAnalysisResponse,
        threat_intel: UnifiedThreatObject | None = None,
    ) -> None:
        try:
            persisted_url = prepare_url_for_persistence(str(request.url))
            if persisted_url is None:
                logger.warning(
                    "Unsafe or malformed URL rejected from persistence for domain=%s",
                    request.hostname,
                )
                return

            now = datetime.now(UTC)
            privacy_score_val = getattr(response, "privacy_score", response.score)

            ti_payload = None
            if threat_intel:
                ti_payload = threat_intel.model_dump(mode="json")
            elif response.threat_intelligence:
                ti_payload = response.threat_intelligence.model_dump(mode="json")

            scan_record = ScanHistory(
                id=response.analysis_id,
                domain=request.hostname,
                full_url=persisted_url,
                final_security_score=response.score,
                final_privacy_score=privacy_score_val,
                final_trust_score=response.score,
                threat_category=response.threat_category,
                verdict=response.decision.action,
                severity=response.severity,
                full_report={
                    "recommendations": response.recommendations,
                    "factors": response.factors,
                    "decision": response.decision.model_dump(),
                    "confidence": response.confidence,
                    "threat_intelligence": ti_payload,
                },
                scanned_at=now,
            )
            db.add(scan_record)

            # Upsert domain reputation
            domain_rep = await db.get(DomainReputation, request.hostname)
            if domain_rep:
                domain_rep.security_score = response.score
                domain_rep.privacy_score = privacy_score_val
                domain_rep.trust_score = response.score
                domain_rep.last_scanned = now
                domain_rep.aggregated_findings = response.factors
            else:
                new_rep = DomainReputation(
                    domain=request.hostname,
                    security_score=response.score,
                    privacy_score=privacy_score_val,
                    trust_score=response.score,
                    last_scanned=now,
                    aggregated_findings=response.factors,
                )
                db.add(new_rep)

            await db.commit()
        except (SQLAlchemyError, OSError) as e:
            logger.error(
                "Failed to persist scan history to DB for analysis_id=%s domain=%s error_type=%s",
                response.analysis_id,
                request.hostname,
                type(e).__name__,
            )
            await db.rollback()
