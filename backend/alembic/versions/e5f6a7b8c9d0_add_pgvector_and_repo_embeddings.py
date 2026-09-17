"""add pgvector extension and repo_embeddings table

Revision ID: e5f6a7b8c9d0
Revises: d49681317b2b
Create Date: 2026-09-17 16:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd49681317b2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable pgvector extension inside PostgreSQL
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Create distributed embeddings table
    op.create_table(
        'repo_embeddings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('repo_id', UUID(as_uuid=True), sa.ForeignKey('repos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('line_start', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('line_end', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(384), nullable=False),
        sa.Column('extra_metadata', JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )
    op.create_index('ix_repo_embeddings_repo_id', 'repo_embeddings', ['repo_id'])

    # 3. Create HNSW index for sub-millisecond approximate cosine nearest neighbor search
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_repo_embeddings_hnsw "
        "ON repo_embeddings USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64);"
    )


def downgrade() -> None:
    op.drop_table('repo_embeddings')
