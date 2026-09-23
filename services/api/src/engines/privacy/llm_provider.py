import json
import logging
import os
from abc import ABC, abstractmethod

import httpx

from src.engines.privacy.schemas import LLMPrivacyResponse

logger = logging.getLogger(__name__)


class PrivacyAnalysisProvider(ABC):
    @abstractmethod
    async def analyze_policy(self, text: str) -> LLMPrivacyResponse | None:
        pass


class OpenAIPrivacyProvider(PrivacyAnalysisProvider):
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")

    async def analyze_policy(self, text: str) -> LLMPrivacyResponse | None:
        if not self.api_key:
            logger.warning("OpenAI API key not configured for Privacy Analysis")
            return None

        prompt = (
            "Analyze the following privacy policy text and extract information. "
            "Respond ONLY in valid JSON matching this schema: "
            '{"data_sold": boolean, "data_shared_third_party": boolean, "explanation": string}\n\n'
            f"Policy text:\n{text}"
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-3.5-turbo",
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a privacy policy analyzer that outputs valid JSON.",
                            },
                            {"role": "user", "content": prompt},
                        ],
                    },
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                return LLMPrivacyResponse(**parsed)
        except (httpx.RequestError, httpx.HTTPStatusError, json.JSONDecodeError) as e:
            logger.error(f"Error during OpenAI API call: {e}")
            return None
        except Exception as e:  # noqa: BLE001
            logger.error(f"Unexpected error in LLM provider: {e}")
            return None
