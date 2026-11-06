"""Vehicle management with operator ownership (PM_10)."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from auth import require_roles
from database import engine
from location_service import get_latest_location

router = APIRouter(prefix='/api/vehicles', tags=['Vehicles'])


class VehicleCreate(BaseModel):
    plate_number: str = Field(min_length=1,max_length=30)
    display_name: str | None = Field(default=None,max_length=120)
    operator_id: UUID | None = None
    @field_validator('plate_number')
    @classmethod
    def strip_plate(cls, value):
        value = value.strip().upper()
        if not value:
            raise ValueError('Nomor polisi wajib diisi')
        return value


class VehicleUpdate(BaseModel):
    display_name: str | None = Field(default=None,max_length=120)
    is_active: bool | None = None
    operator_id: UUID | None = None


def vehicle_access(conn, vehicle_id, user):
    row = conn.execute(text('''
      SELECT id::text AS vehicle_id, plate_number, display_name,
             is_active, operator_id::text AS operator_id
      FROM vehicles WHERE id=CAST(:vehicle_id AS uuid)
       AND (:is_admin OR operator_id=CAST(:user_id AS uuid))
    '''), {'vehicle_id':str(vehicle_id),
           'is_admin':user['role']=='admin','user_id':user['id']}).mappings().first()
    if row is None:
        raise HTTPException(404, 'Kendaraan tidak ditemukan atau bukan kewenangan akun')
    return dict(row)


@router.get('/')
def list_vehicles(limit:int=Query(50,ge=1,le=100),offset:int=Query(0,ge=0),
                  user=Depends(require_roles('operator','admin'))):
    with engine.connect() as conn:
        rows=conn.execute(text('''
          SELECT id::text AS vehicle_id, plate_number, display_name,
                 is_active, operator_id::text AS operator_id
          FROM vehicles
          WHERE (:is_admin OR operator_id=CAST(:user_id AS uuid))
          ORDER BY plate_number LIMIT :limit OFFSET :offset
        '''), {'is_admin':user['role']=='admin','user_id':user['id'],
               'limit':limit,'offset':offset}).mappings().all()
    return [dict(r) for r in rows]


@router.get('/{vehicle_id}/location/latest')
def latest_vehicle_location(vehicle_id:UUID,
                  user=Depends(require_roles('operator','admin'))):
    with engine.connect() as conn:
        vehicle_access(conn,vehicle_id,user)
    result = get_latest_location(str(vehicle_id))
    if result is None:
        raise HTTPException(404,'Posisi kendaraan tidak ditemukan')
    # GPS activity and exact last_seen are internal only.
    return result


@router.get('/{vehicle_id}')
def vehicle_detail(vehicle_id:UUID,user=Depends(require_roles('operator','admin'))):
    with engine.connect() as conn:
        return vehicle_access(conn,vehicle_id,user)


def valid_operator(conn, operator_id):
    if operator_id is None:
        return
    found=conn.execute(text("SELECT id FROM users WHERE id=CAST(:id AS uuid) AND role='operator'"),
                       {'id':str(operator_id)}).first()
    if found is None:
        raise HTTPException(422,'operator_id harus pengguna dengan role operator')


@router.post('/',status_code=201)
def create_vehicle(payload:VehicleCreate,user=Depends(require_roles('admin'))):
    try:
        with engine.begin() as conn:
            valid_operator(conn,payload.operator_id)
            row=conn.execute(text('''
              INSERT INTO vehicles(plate_number,display_name,is_active,operator_id)
              VALUES (:plate,:name,TRUE,CAST(:operator_id AS uuid))
              RETURNING id::text AS vehicle_id, plate_number, display_name,
                        is_active,operator_id::text AS operator_id
            '''), {'plate':payload.plate_number,'name':payload.display_name,
                   'operator_id':str(payload.operator_id) if payload.operator_id else None}).mappings().one()
        return dict(row)
    except IntegrityError as exc:
        raise HTTPException(409,'Nomor polisi sudah terdaftar') from exc


@router.patch('/{vehicle_id}')
def update_vehicle(vehicle_id:UUID,payload:VehicleUpdate,
                   user=Depends(require_roles('operator','admin'))):
    changes=payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422,'Tidak ada perubahan')
    if user['role']!='admin' and (set(changes)-{'display_name'}):
        raise HTTPException(403,'Hanya admin yang boleh mengubah status dan penugasan')
    if 'is_active' in changes and changes['is_active'] is None:
        raise HTTPException(422,'is_active tidak boleh null')
    with engine.begin() as conn:
        vehicle_access(conn,vehicle_id,user)
        if 'operator_id' in changes:
            valid_operator(conn,changes['operator_id'])
        # no ownership/status reassignment while a trip is active
        if 'operator_id' in changes or 'is_active' in changes:
            active=conn.execute(text("SELECT 1 FROM trips WHERE vehicle_id=CAST(:id AS uuid) AND status='active'"),
                                {'id':str(vehicle_id)}).first()
            if active:
                raise HTTPException(409,'Tidak dapat mengubah penugasan/status saat trip aktif')
        sets=[];params={'id':str(vehicle_id)}
        for col,val in changes.items():
            if col=='display_name':
                sets.append('display_name=:display_name'); params[col]=val
            elif col=='is_active':
                sets.append('is_active=:is_active');params[col]=val
            elif col=='operator_id':
                sets.append('operator_id=CAST(:operator_id AS uuid)')
                params[col]=str(val) if val else None
        row=conn.execute(text('''UPDATE vehicles SET '''+','.join(sets)+'''
            WHERE id=CAST(:id AS uuid)
            RETURNING id::text AS vehicle_id,plate_number,display_name,
                      is_active,operator_id::text AS operator_id'''),params).mappings().one()
    return dict(row)
