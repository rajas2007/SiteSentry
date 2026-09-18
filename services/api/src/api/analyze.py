from uuid import uuid4

from fastapi import APIRouter

from src.engines.decision.engine import DecisionEngine
from src.engines.security.engine import SecurityEngine
from src.schemas.analysis import PageAnalysisRequest, PageAnalysisResponse

router = APIRouter(prefix="/api/v1", tags=["Analysis"])

security_engine = SecurityEngine()
decision_engine = DecisionEngine()


@router.post("/analyze", response_model=PageAnalysisResponse)
async def analyze_page(request: PageAnalysisRequest) -> PageAnalysisResponse:
    # 1. Run minimal security engine
    security_result = security_engine.analyze(request)

    # 2. Run decision engine
    decision_result = decision_engine.generate_decision(security_result)

    # 3. Assemble response
    return PageAnalysisResponse(
        analysis_id=str(uuid4()),
        score=security_result["score"],
        severity=decision_result["severity"],
        confidence=security_result["confidence"],
        threat_category=security_result["threat_category"],
        recommendations=decision_result["recommendations"],
        factors=security_result["factors"],
        decision=decision_result["decision"],
    )
