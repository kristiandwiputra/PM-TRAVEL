"""Only active trips can be viewed with a high-entropy one-time code."""
import hashlib
import re
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from database import engine
from trip_core import trip_view

router = APIRouter(prefix='/api/public', tags=['Passenger'])


@router.get('/trips/{code}')
def passenger_trip(code: str):
    if not re.fullmatch(r'[A-Za-z0-9_-]{25,80}', code):
        raise HTTPException(404, 'Kode perjalanan tidak berlaku')
    digest = hashlib.sha256(code.encode('utf-8')).hexdigest()
    with engine.connect() as conn:
        row = conn.execute(text('''
          SELECT t.trip_id, t.status, t.started_at, t.ended_at,
                 t.arrived_hajimena_at, t.vehicle_id::text AS vehicle_id,
                 t.operator_id::text AS operator_id, v.plate_number
          FROM trips t JOIN vehicles v ON v.id=t.vehicle_id
          WHERE t.public_code_hash=:digest AND t.status='active'
        '''), {'digest':digest}).mappings().first()
        if row is None:
            raise HTTPException(404, 'Kode perjalanan tidak berlaku atau perjalanan selesai')
        return trip_view(conn, dict(row), include_internal=False)
