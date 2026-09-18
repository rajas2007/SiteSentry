from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.analyze import router as analyze_router

app = FastAPI(title="Site Sentry API", version="0.1.0")

# Allow extension to call backend during MVP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP, later restrict to chrome-extension://
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
