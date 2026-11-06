"""Device metadata and status; MQTT password/secret never returned."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from auth import require_roles
from database import engine

router=APIRouter(prefix='/api/devices',tags=['Devices'])


class DeviceCreate(BaseModel):
    device_id:str=Field(min_length=1,max_length=64,pattern=r'^[A-Za-z0-9_-]+$')
    vehicle_id:UUID
    mqtt_username:str=Field(min_length=1,max_length=120)
    @field_validator('mqtt_username')
    @classmethod
    def strip_username(cls, v):
        v=v.strip()
        if not v:
            raise ValueError('mqtt_username wajib diisi')
        return v


class DeviceStatusUpdate(BaseModel):
    is_active:bool


class DeviceReassign(BaseModel):
    vehicle_id:UUID


@router.get('/')
def list_devices(limit:int=Query(50,ge=1,le=100),offset:int=Query(0,ge=0),
                 user=Depends(require_roles('operator','admin'))):
    with engine.connect() as conn:
        rows=conn.execute(text('''
          SELECT d.device_id,d.vehicle_id::text AS vehicle_id,v.plate_number,d.is_active
          FROM devices d JOIN vehicles v ON v.id=d.vehicle_id
          WHERE (:admin OR v.operator_id=CAST(:user_id AS uuid))
          ORDER BY d.device_id LIMIT :limit OFFSET :offset
        '''),{'admin':user['role']=='admin','user_id':user['id'],
              'limit':limit,'offset':offset}).mappings().all()
    return [dict(r) for r in rows]


@router.get('/{device_id}')
def device_detail(device_id:str,user=Depends(require_roles('operator','admin'))):
    with engine.connect() as conn:
        row=conn.execute(text('''
          SELECT d.device_id,d.vehicle_id::text AS vehicle_id,v.plate_number,d.is_active
          FROM devices d JOIN vehicles v ON v.id=d.vehicle_id
          WHERE d.device_id=:device_id
            AND (:admin OR v.operator_id=CAST(:user_id AS uuid))
        '''),{'device_id':device_id,'admin':user['role']=='admin',
              'user_id':user['id']}).mappings().first()
    if row is None:
        raise HTTPException(404,'Perangkat tidak ditemukan atau bukan kewenangan akun')
    return dict(row)


@router.post('/',status_code=201)
def create_device(payload:DeviceCreate,user=Depends(require_roles('admin'))):
    try:
        with engine.begin() as conn:
            v=conn.execute(text('''SELECT 1 FROM vehicles
                WHERE id=CAST(:id AS uuid) AND is_active=TRUE'''),
                {'id':str(payload.vehicle_id)}).first()
            if v is None:
                raise HTTPException(404,'Kendaraan aktif tidak ditemukan')
            row=conn.execute(text('''
                INSERT INTO devices(device_id,vehicle_id,mqtt_username,is_active)
                VALUES(:device_id,CAST(:vehicle_id AS uuid),:username,TRUE)
                RETURNING device_id,vehicle_id::text AS vehicle_id,is_active
            '''),{'device_id':payload.device_id,'vehicle_id':str(payload.vehicle_id),
                  'username':payload.mqtt_username}).mappings().one()
        return dict(row)
    except IntegrityError as exc:
        raise HTTPException(409,'Device ID / MQTT username sudah digunakan') from exc


@router.patch('/{device_id}/status')
def update_device_status(device_id:str,payload:DeviceStatusUpdate,
                         user=Depends(require_roles('admin'))):
    with engine.begin() as conn:
        row=conn.execute(text('''UPDATE devices SET is_active=:active
            WHERE device_id=:id RETURNING device_id,vehicle_id::text AS vehicle_id,is_active'''),
            {'active':payload.is_active,'id':device_id}).mappings().first()
        if not row:
            raise HTTPException(404,'Perangkat tidak ditemukan')
    return dict(row)


@router.patch('/{device_id}/vehicle')
def reassign_device(device_id:str,payload:DeviceReassign,
                    user=Depends(require_roles('operator','admin'))):
    with engine.begin() as conn:
        device=conn.execute(text('''SELECT d.vehicle_id::text AS vehicle_id, v.operator_id::text AS operator_id
            FROM devices d JOIN vehicles v ON v.id=d.vehicle_id
            WHERE d.device_id=:id FOR UPDATE OF d'''),{'id':device_id}).mappings().first()
        if device is None or (user['role'] != 'admin' and device['operator_id'] != user['id']):
            raise HTTPException(404,'Perangkat tidak ditemukan atau bukan kewenangan akun')
        vehicle=conn.execute(text('''SELECT id FROM vehicles
            WHERE id=CAST(:id AS uuid) AND is_active=TRUE
            AND (:admin OR operator_id=CAST(:user_id AS uuid))'''),
            {'id':str(payload.vehicle_id), 'admin':user['role']=='admin', 'user_id':user['id']}).first()
        if vehicle is None:
            raise HTTPException(404,'Kendaraan tujuan tidak aktif/tidak ditemukan')
        active=conn.execute(text('''SELECT 1 FROM trips WHERE status='active'
            AND vehicle_id IN (CAST(:old AS uuid),CAST(:new AS uuid)) LIMIT 1'''),
            {'old':device['vehicle_id'],'new':str(payload.vehicle_id)}).first()
        if active:
            raise HTTPException(409,'Tidak dapat mengaitkan perangkat saat ada trip aktif')
        row=conn.execute(text('''UPDATE devices SET vehicle_id=CAST(:vehicle_id AS uuid)
            WHERE device_id=:id RETURNING device_id,vehicle_id::text AS vehicle_id,is_active'''),
            {'vehicle_id':str(payload.vehicle_id),'id':device_id}).mappings().one()
    return dict(row)
