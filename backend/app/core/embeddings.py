"""
RepoHawk Embeddings Client
Uses direct HTTP calls to OpenRouter's embeddings endpoint.
LangChain's OpenAIEmbeddings client is NOT used here because it applies
tokenizer-based chunking that is incompatible with OpenRouter's API contract.
"""

import httpx
import logging
from typing import List
from app.core.config import settings

logger = logging.getLogger("repohawk.embeddings")


class OpenRouterEmbeddings:
    """
    Thin wrapper for OpenRouter's /v1/embeddings endpoint.
    Generates text embedding vectors via the configured MODEL_EMBED.
    """

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL.rstrip("/")
        self.model = settings.MODEL_EMBED
        self.timeout = 60

    def _call_api(self, texts: List[str]) -> List[List[float]]:
        """Makes a single HTTP POST to the embeddings endpoint."""
        resp = httpx.post(
            f"{self.base_url}/embeddings",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={"model": self.model, "input": texts},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        data = resp.json()

        # Validate the response shape
        embedding_data = data.get("data", [])
        if not embedding_data:
            raise ValueError(f"No embedding data received from OpenRouter. Response: {data}")

        # Sort by index in case the API returns them out of order
        embedding_data.sort(key=lambda x: x.get("index", 0))
        return [item["embedding"] for item in embedding_data]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of document texts."""
        return self._call_api(texts)

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query string."""
        results = self._call_api([text])
        return results[0]


# Singleton-friendly factory
def get_embeddings() -> OpenRouterEmbeddings:
    """Returns an OpenRouterEmbeddings instance."""
    return OpenRouterEmbeddings()
