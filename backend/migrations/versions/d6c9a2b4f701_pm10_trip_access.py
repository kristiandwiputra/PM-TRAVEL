"""PM_10: ownership, access code, arrival, active trip guard.

Revision ID: d6c9a2b4f701
Revises: b7d9e1a6c230
"""
from alembic import op
import sqlalchemy as sa

revision = 'd6c9a2b4f701'
down_revision = 'b7d9e1a6c230'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('vehicles', sa.Column('operator_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_vehicles_operator', 'vehicles', 'users',
                          ['operator_id'], ['id'])
    op.add_column('trips', sa.Column('operator_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_trips_operator', 'trips', 'users',
                          ['operator_id'], ['id'])
    op.add_column('trips', sa.Column('public_code_hash', sa.String(64), nullable=True))
    op.create_unique_constraint('uq_trips_public_code_hash', 'trips', ['public_code_hash'])
    op.add_column('trips', sa.Column('arrived_hajimena_at', sa.DateTime(timezone=True), nullable=True))
    op.alter_column('trips', 'started_at', existing_type=sa.DateTime(timezone=True),
                    nullable=True)
    op.create_index('uq_one_active_trip_per_vehicle', 'trips', ['vehicle_id'],
                    unique=True, postgresql_where=sa.text("status = 'active'"))
    op.create_index('ix_trips_operator_status', 'trips', ['operator_id', 'status'])


def downgrade():
    # Only safe if planned trips have no NULL started_at.
    op.drop_index('ix_trips_operator_status', table_name='trips')
    op.drop_index('uq_one_active_trip_per_vehicle', table_name='trips')
    op.alter_column('trips', 'started_at', existing_type=sa.DateTime(timezone=True),
                    nullable=False)
    op.drop_column('trips', 'arrived_hajimena_at')
    op.drop_constraint('uq_trips_public_code_hash','trips', type_='unique')
    op.drop_column('trips','public_code_hash')
    op.drop_constraint('fk_trips_operator','trips',type_='foreignkey')
    op.drop_column('trips','operator_id')
    op.drop_constraint('fk_vehicles_operator','vehicles',type_='foreignkey')
    op.drop_column('vehicles','operator_id')
