import chromadb
from chromadb.config import Settings
from app.core.config import settings

# Setup Chroma Client
# Uses HTTP client connecting to docker container at localhost:8000
def get_chroma_client():
    client = chromadb.HttpClient(
        host=settings.CHROMA_HOST,
        port=settings.CHROMA_PORT,
        settings=Settings(allow_reset=True, anonymized_telemetry=False)
    )
    return client

# Utility wrapper
def get_collection(repo_id: str):
    client = get_chroma_client()
    return client.get_or_create_collection(name=f"repo_{repo_id}")
