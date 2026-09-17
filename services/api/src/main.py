from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="Site Sentry API", version="0.1.0")

@app.get("/health")
async def health_root() -> dict[str, str]:
    return {"status": "ok", "service": "site-sentry-api", "version": "0.1.0"}

@app.get("/api/v1/health")
async def health_api() -> dict[str, str]:
    return {"status": "ok", "service": "site-sentry-api", "version": "0.1.0"}
