
"""PM_10 - Route target configuration

Revision ID: b7d9e1a6c230
Revises: 34c77e4d036b
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


revision = "b7d9e1a6c230"
down_revision = "34c77e4d036b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "route_targets",
        sa.Column(
            "sequence_no",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "name",
            sa.String(120),
            nullable=False,
        ),
        sa.Column(
            "location",
            Geometry(
                geometry_type="POINT",
                srid=4326,
                spatial_index=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "sequence_no IN (1, 2)",
            name="ck_route_target_sequence",
        ),
    )

    # Koordinat referensi PM_02, belum diverifikasi di lapangan.
    # ST_MakePoint menerima urutan longitude, latitude.
    op.execute("""
        INSERT INTO route_targets
            (sequence_no, name, location)
        VALUES
            (
                1,
                'Hajimena',
                ST_SetSRID(
                    ST_MakePoint(105.2253941, -5.3619361),
                    4326
                )
            ),
            (
                2,
                'Kotabumi',
                ST_SetSRID(
                    ST_MakePoint(104.8962439, -4.8351362),
                    4326
                )
            )
    """)


def downgrade():
    op.drop_table("route_targets")
