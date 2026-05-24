import chromadb
from chromadb.config import Settings
from app.core.config import settings

import os

# Setup Chroma Client
# Uses PersistentClient for in-process server-less testing
def get_chroma_client():
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chroma_db")
    client = chromadb.PersistentClient(
        path=db_path,
        settings=Settings(allow_reset=True, anonymized_telemetry=False)
    )
    return client


# Utility wrapper
def get_collection(repo_id: str):
    client = get_chroma_client()
    return client.get_or_create_collection(name=f"repo_{repo_id}")
