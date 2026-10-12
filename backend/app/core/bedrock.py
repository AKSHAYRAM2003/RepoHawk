"""
RepoHawk AWS Bedrock Client
Provides ChatBedrock LLM instances and Bedrock Titan embeddings.
Used when LLM_PROVIDER_* is set to "bedrock" in .env.

Supports:
- Explicit AWS credentials (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
- Named AWS profile (AWS_PROFILE)
- IAM Role / EC2 instance profile (no creds needed in .env)
"""

import logging
from typing import Optional, List
from app.core.config import settings

logger = logging.getLogger("repohawk.bedrock")


def _get_boto3_session():
    """
    Build a boto3 session using whichever auth method is configured.
    Priority: explicit keys > named profile > ambient IAM role.
    """
    import boto3

    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        logger.debug("Bedrock: using explicit AWS key credentials")
        return boto3.Session(
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
    if settings.AWS_PROFILE:
        logger.debug(f"Bedrock: using AWS profile '{settings.AWS_PROFILE}'")
        return boto3.Session(
            profile_name=settings.AWS_PROFILE,
            region_name=settings.AWS_REGION,
        )
    # Fall back to ambient credentials (IAM role, EC2 instance profile, AWS SSO, etc.)
    logger.debug("Bedrock: using ambient AWS credentials (IAM role / env vars / ~/.aws)")
    return boto3.Session(region_name=settings.AWS_REGION)


# Role -> model ID mapping (resolved at first call so settings are fully loaded)
def _role_to_model(role: str) -> str:
    return {
        "chat": settings.BEDROCK_MODEL_CHAT,
        "diagram": settings.BEDROCK_MODEL_DIAGRAM,
        "critique": settings.BEDROCK_MODEL_CRITIQUE,
        "rewrite": settings.BEDROCK_MODEL_REWRITE,
    }.get(role, settings.BEDROCK_MODEL_CHAT)


# Role -> temperature defaults (matching existing llm.py defaults)
_ROLE_TO_TEMP = {
    "chat": 0.1,
    "diagram": 0.1,
    "critique": 0.0,
    "rewrite": 0.0,
}


def get_bedrock_llm(role: str = "chat", model_id: Optional[str] = None):
    """
    Returns a LangChain ChatBedrock instance for the given agent role.

    Args:
        role: "chat" | "diagram" | "critique" | "rewrite"
        model_id: Override the model ID. Defaults to the configured BEDROCK_MODEL_* for the role.

    Returns:
        ChatBedrock instance (implements BaseChatModel -- drop-in for ChatOpenAI).
    """
    try:
        from langchain_aws import ChatBedrock
    except ImportError:
        raise RuntimeError(
            "langchain-aws is not installed. Run: pip install langchain-aws"
        )

    resolved_model = model_id or _role_to_model(role)
    temperature = _ROLE_TO_TEMP.get(role, 0.1)

    session = _get_boto3_session()
    boto3_client = session.client("bedrock-runtime")

    logger.info(f"Bedrock: creating ChatBedrock -- role={role}, model={resolved_model}")

    # model_kwargs carries temperature; top-level param not supported by all models
    return ChatBedrock(
        model_id=resolved_model,
        client=boto3_client,
        model_kwargs={"temperature": temperature},
        streaming=True,   # enables .astream() for the chat streaming path
    )


# -- Bedrock Embeddings --------------------------------------------------------

class BedrockEmbeddingsClient:
    """
    Wraps Amazon Bedrock Titan Embed Text v2 to expose the same interface
    as OpenRouterEmbeddings and SentenceTransformerEmbeddings:
      - embed_query(text) -> List[float]
      - embed_documents(texts) -> List[List[float]]
      - async embed_query_async(text) -> List[float]

    Titan Embed Text v2 returns 1536-dim vectors by default.
    NOTE: Switching to this from OpenRouter (2048-dim) requires a full re-index
    of all Chroma collections.
    """

    DIM = 1536  # Amazon Titan Embed Text v2 output dimension

    def __init__(self):
        try:
            import boto3
        except ImportError:
            raise RuntimeError("boto3 is not installed. Run: pip install boto3")

        session = _get_boto3_session()
        self._client = session.client("bedrock-runtime")
        self._model_id = settings.BEDROCK_MODEL_EMBED
        logger.info(f"BedrockEmbeddingsClient: model={self._model_id}, dim={self.DIM}")

    def _embed(self, text: str) -> List[float]:
        import json

        body = json.dumps({"inputText": text})
        response = self._client.invoke_model(
            modelId=self._model_id,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(response["body"].read())
        return result["embedding"]

    def embed_query(self, text: str) -> List[float]:
        return self._embed(text)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(t) for t in texts]

    async def embed_query_async(self, text: str) -> List[float]:
        """Non-blocking async wrapper -- runs the blocking boto3 call in a thread pool."""
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._embed, text)

    def embed_query_safe(self, text: str) -> List[float]:
        """Alias used by embedder.py fallback logic."""
        return self.embed_query(text)
