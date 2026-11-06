
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text

from auth import require_roles
from database import engine


router = APIRouter(
    prefix="/api/route-targets",
    tags=["Route Targets"],
)


class RouteTargetUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Nama target wajib diisi")

        return value


# =====================================
# 1. DAFTAR TARGET RUTE
# =====================================

@router.get("/")
def list_route_targets(
    user=Depends(require_roles("operator", "admin"))
):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    sequence_no,
                    name,
                    ST_Y(location) AS latitude,
                    ST_X(location) AS longitude,
                    updated_at
                FROM route_targets
                ORDER BY sequence_no
            """)
        ).mappings().all()

    return [dict(row) for row in rows]


# =====================================
# 2. DETAIL TARGET RUTE
# =====================================

@router.get("/{sequence_no}")
def route_target_detail(
    sequence_no: int,
    user=Depends(require_roles("operator", "admin"))
):
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT
                    sequence_no,
                    name,
                    ST_Y(location) AS latitude,
                    ST_X(location) AS longitude,
                    updated_at
                FROM route_targets
                WHERE sequence_no = :sequence_no
            """),
            {"sequence_no": sequence_no}
        ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Target rute tidak ditemukan"
        )

    return dict(row)


# =====================================
# 3. PERBARUI KONFIGURASI TARGET
# KHUSUS ADMIN
# =====================================

@router.put("/{sequence_no}")
def update_route_target(
    sequence_no: int,
    payload: RouteTargetUpdate,
    user=Depends(require_roles("admin"))
):
    if sequence_no not in (1, 2):
        raise HTTPException(
            status_code=422,
            detail="Target hanya terdiri dari urutan 1 dan 2"
        )

    with engine.begin() as conn:
        row = conn.execute(
            text("""
                UPDATE route_targets
                SET
                    name = :name,
                    location = ST_SetSRID(
                        ST_MakePoint(
                            :longitude,
                            :latitude
                        ),
                        4326
                    ),
                    updated_at = NOW()
                WHERE sequence_no = :sequence_no
                RETURNING
                    sequence_no,
                    name,
                    ST_Y(location) AS latitude,
                    ST_X(location) AS longitude,
                    updated_at
            """),
            {
                "sequence_no": sequence_no,
                "name": payload.name,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
            }
        ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Target rute tidak ditemukan"
        )

    return dict(row)
