import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.redis import RedisCache, get_cache
from src.engines.decision.engine import DecisionEngine
from src.engines.security.engine import SecurityEngine
from src.engines.threat_intelligence.engine import ThreatIntelligenceEngine
from src.engines.threat_intelligence.schemas import UnifiedThreatObject
from src.models.domain_reputation import DomainReputation
from src.models.scan import ScanHistory
from src.schemas.analysis import PageAnalysisRequest, PageAnalysisResponse

logger = logging.getLogger(__name__)


class ScanService:
    def __init__(
        self,
        security_engine: SecurityEngine | None = None,
        decision_engine: DecisionEngine | None = None,
        threat_intel_engine: ThreatIntelligenceEngine | None = None,
        cache: RedisCache | None = None,
    ) -> None:
        self.security_engine = security_engine or SecurityEngine()
        self.decision_engine = decision_engine or DecisionEngine()
        self.threat_intel_engine = threat_intel_engine or ThreatIntelligenceEngine()
        self.cache = cache or get_cache()

    async def analyze_page(
        self,
        request: PageAnalysisRequest,
        db: AsyncSession | None = None,
    ) -> PageAnalysisResponse:
        url_str = str(request.url)

        # 1. Check Redis cache
        cached = await self.cache.get_analysis(url_str)
        if cached:
            logger.info(f"Cache hit for URL: {url_str}")
            return PageAnalysisResponse(**cached)

        # 2. Query external Threat Intelligence Feeds (Google Safe Browsing & VirusTotal)
        threat_intel = await self.threat_intel_engine.lookup(
            url=url_str,
            domain=request.hostname,
        )

        # 3. Run engine analysis pipeline with external threat signals
        security_result = self.security_engine.analyze(
            request,
            threat_intel=threat_intel,
        )
        decision_result = self.decision_engine.generate_decision(security_result)

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
            score=security_result["score"],
            severity=decision_result["severity"],
            confidence=security_result["confidence"],
            threat_category=security_result["threat_category"],
            recommendations=decision_result["recommendations"],
            factors=security_result["factors"],
            decision=decision_result["decision"],
            threat_intelligence=ti_response,
        )

        # 4. Store in Redis cache
        await self.cache.set_analysis(url_str, response.model_dump(mode="json"))

        # 5. Asynchronously persist to PostgreSQL if DB session is provided
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
            now = datetime.now(UTC)
            scan_record = ScanHistory(
                id=response.analysis_id,
                domain=request.hostname,
                full_url=str(request.url),
                final_security_score=response.score,
                final_trust_score=response.score,
                threat_category=response.threat_category,
                verdict=response.decision.action,
                severity=response.severity,
                full_report={
                    "recommendations": response.recommendations,
                    "factors": response.factors,
                    "decision": response.decision.model_dump(),
                    "confidence": response.confidence,
                    "threat_intelligence": (
                        threat_intel.model_dump(mode="json") if threat_intel else None
                    ),
                },
                scanned_at=now,
            )
            db.add(scan_record)

            # Upsert domain reputation
            domain_rep = await db.get(DomainReputation, request.hostname)
            if domain_rep:
                domain_rep.security_score = response.score
                domain_rep.trust_score = response.score
                domain_rep.last_scanned = now
                domain_rep.aggregated_findings = response.factors
            else:
                new_rep = DomainReputation(
                    domain=request.hostname,
                    security_score=response.score,
                    trust_score=response.score,
                    last_scanned=now,
                    aggregated_findings=response.factors,
                )
                db.add(new_rep)

            await db.commit()
        except (SQLAlchemyError, OSError):
            logger.exception(
                f"Failed to persist scan history to DB for analysis_id={response.analysis_id} "
                f"domain={request.hostname}"
            )
            await db.rollback()
