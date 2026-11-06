"""PM_10 operator/admin API. Protected by user role AND resource ownership."""
import hashlib
import secrets
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from auth import require_roles
from database import engine
from trip_core import iso, owned_trip, trip_view

router = APIRouter(prefix='/api/trips', tags=['Trips'])


class TripCreate(BaseModel):
    vehicle_id: UUID


def require_vehicle(conn, vehicle_id, user, for_update=False):
    sql = '''SELECT id, plate_number, operator_id::text AS operator_id FROM vehicles
             WHERE id=CAST(:vehicle_id AS uuid) AND is_active=TRUE
               AND (:is_admin OR operator_id=CAST(:user_id AS uuid))'''
    if for_update:
        sql += ' FOR UPDATE'
    row = conn.execute(text(sql), {'vehicle_id': str(vehicle_id),
                                  'is_admin': user['role']=='admin',
                                  'user_id': user['id']}).mappings().first()
    if row is None:
        raise HTTPException(404, 'Kendaraan tidak aktif atau bukan kewenangan akun')
    return row


@router.post('/', status_code=201)
def create_trip(payload: TripCreate, user=Depends(require_roles('operator', 'admin'))):
    trip_id = 'TRIP-' + datetime.now(timezone.utc).strftime('%Y%m%d') + '-' + uuid4().hex[:12].upper()
    with engine.begin() as conn:
        vehicle = require_vehicle(conn, payload.vehicle_id, user, for_update=True)
        owner_id = vehicle['operator_id'] if user['role']=='admin' and vehicle['operator_id'] else user['id']
        count = conn.execute(text('SELECT count(*) FROM route_targets WHERE sequence_no IN (1,2)')).scalar_one()
        if count != 2:
            raise HTTPException(409, 'Konfigurasi dua target belum lengkap; jalankan migrasi PM_10')
        conn.execute(text('''INSERT INTO trips
                (trip_id, vehicle_id, operator_id, started_at, status)
                VALUES (:trip_id, CAST(:vehicle_id AS uuid), CAST(:user_id AS uuid), NULL, 'planned')'''),
                {'trip_id': trip_id, 'vehicle_id': str(payload.vehicle_id), 'user_id': owner_id})
        conn.execute(text('''INSERT INTO targets (trip_id, name, sequence_no, location)
            SELECT :trip_id, name, sequence_no, location FROM route_targets
            WHERE sequence_no IN (1,2) ORDER BY sequence_no'''), {'trip_id': trip_id})
    return {'trip_id': trip_id, 'status': 'planned', 'vehicle_id': str(payload.vehicle_id),
            'message': 'Salinan target disimpan untuk perjalanan ini'}


@router.get('/')
def list_trips(status: str | None = Query(default=None),
               limit: int = Query(default=20, ge=1, le=100),
               offset: int = Query(default=0, ge=0, le=100000),
               user=Depends(require_roles('operator','admin'))):
    if status and status not in ('planned', 'active', 'completed', 'canceled'):
        raise HTTPException(422, 'Status tidak dikenal')
    # Avoid untyped NULL parameter in PostgreSQL (:status IS NULL).
    status_filter = ' AND t.status = :status' if status else ''
    params = {'is_admin': user['role']=='admin', 'user_id': user['id'],
              'limit': limit, 'offset': offset}
    if status:
        params['status'] = status
    with engine.connect() as conn:
        rows = conn.execute(text('''
          SELECT t.trip_id, t.vehicle_id::text AS vehicle_id,
                 v.plate_number, t.status, t.started_at, t.ended_at,
                 t.arrived_hajimena_at
          FROM trips t JOIN vehicles v ON v.id=t.vehicle_id
          WHERE (:is_admin OR (t.operator_id=CAST(:user_id AS uuid)
                  AND v.operator_id=CAST(:user_id AS uuid)))
        ''' + status_filter + '''
          ORDER BY t.started_at DESC NULLS LAST, t.trip_id DESC
          LIMIT :limit OFFSET :offset
        '''), params).mappings().all()
    return [{**dict(r), 'started_at':iso(r['started_at']),
             'ended_at':iso(r['ended_at']),
             'arrived_hajimena_at':iso(r['arrived_hajimena_at'])} for r in rows]


@router.get('/{trip_id}')
def get_trip(trip_id: str, user=Depends(require_roles('operator','admin'))):
    with engine.connect() as conn:
        trip = owned_trip(conn, trip_id, user)
        return trip_view(conn, trip, include_internal=True)


@router.post('/{trip_id}/start')
def start_trip(trip_id: str, user=Depends(require_roles('operator','admin'))):
    public_code = secrets.token_urlsafe(24)  # 192 bits; returned only once.
    digest = hashlib.sha256(public_code.encode('utf-8')).hexdigest()
    try:
        with engine.begin() as conn:
            trip = owned_trip(conn, trip_id, user, for_update=True)
            if trip['status'] != 'planned':
                raise HTTPException(409, 'Hanya trip planned yang dapat dimulai')
            require_vehicle(conn, trip['vehicle_id'], user, for_update=True)
            conflict = conn.execute(text('''
                SELECT trip_id FROM trips
                WHERE vehicle_id=CAST(:vehicle_id AS uuid) AND status='active'
                LIMIT 1'''), {'vehicle_id':trip['vehicle_id']}).first()
            if conflict:
                raise HTTPException(409, 'Kendaraan sudah memiliki trip aktif')
            conn.execute(text('''UPDATE trips SET status='active', started_at=NOW(),
                 public_code_hash=:digest, ended_at=NULL, arrived_hajimena_at=NULL
                 WHERE trip_id=:trip_id'''), {'digest':digest, 'trip_id':trip_id})
    except IntegrityError as exc:
        raise HTTPException(409,'Kendaraan sudah memiliki trip aktif') from exc
    return {'trip_id':trip_id, 'status':'active','public_code':public_code,
            'public_path':f'/api/public/trips/{public_code}',
            'warning':'Simpan kode ini; tidak bisa dibaca ulang. Kode nonaktif setelah trip selesai.'}


@router.post('/{trip_id}/arrive-hajimena')
def arrive_hajimena(trip_id: str, user=Depends(require_roles('operator','admin'))):
    with engine.begin() as conn:
        trip = owned_trip(conn, trip_id, user, for_update=True)
        if trip['status'] != 'active':
            raise HTTPException(409,'Hanya trip aktif yang dapat mencatat tiba Hajimena')
        if trip['arrived_hajimena_at'] is not None:
            raise HTTPException(409,'Kedatangan Hajimena sudah tercatat')
        at = conn.execute(text('''UPDATE trips SET arrived_hajimena_at=NOW()
            WHERE trip_id=:trip_id RETURNING arrived_hajimena_at'''),
            {'trip_id':trip_id}).scalar_one()
    return {'trip_id':trip_id,'status':'active','arrived_hajimena_at':iso(at),
            'message':'Trip tetap aktif menuju Kotabumi'}


@router.post('/{trip_id}/complete')
def complete_trip(trip_id: str, user=Depends(require_roles('operator','admin'))):
    with engine.begin() as conn:
        trip = owned_trip(conn, trip_id, user, for_update=True)
        if trip['status'] != 'active':
            raise HTTPException(409,'Hanya trip aktif yang dapat diselesaikan')
        if trip['arrived_hajimena_at'] is None:
            raise HTTPException(409,'Catat tiba Hajimena sebelum menyelesaikan di Kotabumi')
        ended = conn.execute(text('''UPDATE trips
           SET status='completed', ended_at=NOW(), public_code_hash=NULL
           WHERE trip_id=:trip_id RETURNING ended_at'''), {'trip_id':trip_id}).scalar_one()
    return {'trip_id':trip_id,'status':'completed','ended_at':iso(ended)}


@router.post('/{trip_id}/cancel')
def cancel_trip(trip_id: str, user=Depends(require_roles('operator','admin'))):
    with engine.begin() as conn:
        trip = owned_trip(conn, trip_id, user, for_update=True)
        if trip['status'] not in ('planned','active'):
            raise HTTPException(409,'Perjalanan sudah selesai/dibatalkan')
        ended = conn.execute(text('''UPDATE trips
          SET status='canceled', ended_at=NOW(), public_code_hash=NULL
          WHERE trip_id=:trip_id RETURNING ended_at'''), {'trip_id':trip_id}).scalar_one()
    return {'trip_id':trip_id,'status':'canceled','ended_at':iso(ended)}


@router.get('/{trip_id}/positions')
def trip_positions(trip_id: str, limit: int=Query(100, ge=1, le=200),
                   offset:int=Query(0,ge=0,le=100000),
                   user=Depends(require_roles('operator','admin'))):
    with engine.connect() as conn:
        owned_trip(conn, trip_id, user)
        rows = conn.execute(text('''
            SELECT p.id, p.observed_at, p.received_at, p.latitude,
                   p.longitude, p.speed_kmh, p.gps_valid, p.satellites, p.hdop
            FROM gps_positions p JOIN devices d ON d.device_id=p.device_id
            JOIN trips t ON t.trip_id=p.trip_id AND d.vehicle_id=t.vehicle_id
            WHERE p.trip_id=:trip_id
            ORDER BY p.received_at DESC,p.id DESC
            LIMIT :limit OFFSET :offset'''),
            {'trip_id':trip_id,'limit':limit,'offset':offset}).mappings().all()
    return [{'id':r['id'],'observed_at':iso(r['observed_at']),
             'received_at':iso(r['received_at']),
             'latitude':r['latitude'],'longitude':r['longitude'],
             'speed_kmh':r['speed_kmh'],'gps_valid':r['gps_valid'],
             'satellites':r['satellites'],'hdop':r['hdop']} for r in rows]
