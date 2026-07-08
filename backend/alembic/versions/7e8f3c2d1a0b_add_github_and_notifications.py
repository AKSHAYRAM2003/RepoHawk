"""Add github_installations, github_repos, notifications tables

Revision ID: 7e8f3c2d1a0b
Revises: 6bb9f0333e1a
Create Date: 2026-07-07 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '7e8f3c2d1a0b'
down_revision: Union[str, None] = '6bb9f0333e1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('github_installations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('installation_id', sa.BigInteger(), nullable=False),
        sa.Column('account_login', sa.String(), nullable=False),
        sa.Column('account_type', sa.String(), nullable=True),
        sa.Column('account_avatar_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_github_installations_installation_id'), 'github_installations', ['installation_id'], unique=True)

    op.create_table('github_repos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('installation_id', sa.UUID(), nullable=False),
        sa.Column('github_repo_id', sa.BigInteger(), nullable=False),
        sa.Column('owner', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('private', sa.Boolean(), nullable=True),
        sa.Column('default_branch', sa.String(), nullable=True),
        sa.Column('repo_url', sa.String(), nullable=False),
        sa.Column('auto_analyze', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['installation_id'], ['github_installations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_github_repos_github_repo_id'), 'github_repos', ['github_repo_id'])

    op.create_table('notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('link', sa.String(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_github_repos_github_repo_id'), table_name='github_repos')
    op.drop_table('github_repos')
    op.drop_index(op.f('ix_github_installations_installation_id'), table_name='github_installations')
    op.drop_table('github_installations')
