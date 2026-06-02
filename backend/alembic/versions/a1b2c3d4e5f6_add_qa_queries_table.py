"""add qa_queries table

Revision ID: a1b2c3d4e5f6
Revises: 57671c90d880
Create Date: 2026-05-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '57671c90d880'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'qa_queries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', UUID(as_uuid=True), sa.ForeignKey('chat_sessions.id'), nullable=False),
        sa.Column('repo_id', UUID(as_uuid=True), sa.ForeignKey('repos.id'), nullable=False),
        sa.Column('question', sa.String(), nullable=False),
        sa.Column('rewritten_question', sa.String(), nullable=True),
        sa.Column('num_chunks_retrieved', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('num_chunks_kept', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('relevance_threshold', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('answer_length_chars', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('highlight_node_id', sa.String(), nullable=True),
        sa.Column('highlight_hit', sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column('latency_total_ms', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('latency_retrieval_ms', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('latency_llm_ms', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('tokens_in', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('tokens_out', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('error', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
    )
    op.create_index('ix_qa_queries_session_id', 'qa_queries', ['session_id'])
    op.create_index('ix_qa_queries_repo_id', 'qa_queries', ['repo_id'])


def downgrade() -> None:
    op.drop_index('ix_qa_queries_repo_id', table_name='qa_queries')
    op.drop_index('ix_qa_queries_session_id', table_name='qa_queries')
    op.drop_table('qa_queries')
