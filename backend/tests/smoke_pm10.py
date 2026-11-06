"""Integration smoke test on LOCAL pmtravel_dev ONLY. Writes dummy test rows.
Run after migrations. Requires an admin created with backend/create_user.py.
"""
import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from getpass import getpass
from pathlib import Path
from uuid import uuid4

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from sqlalchemy import text
from database import engine, settings
from main import app


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print('OK  ',message)


def insert_gps(conn, device_id, trip_id, sequence, observed_at, lat, lon, valid):
    mid='PM10TEST-'+uuid4().hex
    conn.execute(text('''
      INSERT INTO gps_positions(message_id,device_id,boot_id,sequence_id,trip_id,
          observed_at,latitude,longitude,speed_kmh,gps_valid,satellites,hdop,
          location,payload_hash,raw_payload)
      VALUES (:mid,:device_id,:boot_id,:seq,:trip_id,:observed,:lat,:lon,
          :speed,:valid,:sat,:hdop,
          CASE WHEN :valid THEN ST_SetSRID(ST_MakePoint(:lon,:lat),4326)
               ELSE NULL END,
          :digest,CAST('{}' AS jsonb))
    '''), {'mid':mid,'device_id':device_id,'boot_id':'PM10-'+device_id,
           'seq':sequence,'trip_id':trip_id,'observed':observed_at,
           'lat':lat,'lon':lon,'speed':10.0 if valid else None,
           'valid':valid,'sat':8 if valid else 0,'hdop':1.2 if valid else None,
           'digest':hashlib.sha256(mid.encode()).hexdigest()})


def main():
    if settings.pg_database != 'pmtravel_dev':
        raise SystemExit('DIBATALKAN: test hanya untuk database lokal pmtravel_dev')
    email=input('Email akun admin pengujian: ').strip()
    password=getpass('Password admin (tidak ditampilkan): ')
    c=TestClient(app)
    check(c.get('/health').status_code==200,'Health')
    check(c.get('/health/db').status_code==200,'Health database PostGIS')
    check(c.get('/api/trips/').status_code==401,'Riwayat tanpa login ditolak')
    check(c.get('/api/public/trips/kodepalsudaninidisengajapanjang').status_code==404,
          'Kode publik palsu ditolak')
    login=c.post('/api/auth/login',json={'email':email,'password':password})
    check(login.status_code==200,'Login admin')
    token=login.json()['access_token']
    headers={'Authorization':'Bearer '+token}
    check(c.get('/api/auth/me',headers=headers).json().get('role')=='admin','Role admin')
    check(c.get('/api/trips/',headers={'Authorization':'Bearer invalid'}).status_code==401,
          'Token rusak ditolak')
    plate='PM10-'+uuid4().hex[:8].upper()
    resp=c.post('/api/vehicles/',json={'plate_number':plate,'display_name':'Simulasi QA PM_10'},
                headers=headers)
    check(resp.status_code==201,f'Buat kendaraan uji ({resp.status_code})')
    vehicle_id=resp.json()['vehicle_id']
    resp=c.post('/api/trips/',json={'vehicle_id':vehicle_id},headers=headers)
    check(resp.status_code==201,f'Buat planned trip ({resp.status_code})')
    trip_id=resp.json()['trip_id']
    detail=c.get(f'/api/trips/{trip_id}',headers=headers)
    check(detail.status_code==200 and len(detail.json()['targets'])==2,
          'Snapshot dua target')
    check(all(t['eta']['status']=='unavailable' for t in detail.json()['targets']),
          'ETA jujur unavailable')
    resp2=c.post('/api/trips/',json={'vehicle_id':vehicle_id},headers=headers)
    check(resp2.status_code==201,'Trip kedua boleh planned')
    other_trip=resp2.json()['trip_id']
    start=c.post(f'/api/trips/{trip_id}/start',headers=headers)
    check(start.status_code==200,'Start trip + kode unik')
    code=start.json()['public_code']
    check(c.post(f'/api/trips/{other_trip}/start',headers=headers).status_code==409,
          'Dua trip aktif pada satu kendaraan ditolak')
    check(c.post(f'/api/trips/{other_trip}/cancel',headers=headers).status_code==200,
          'Cancel trip planned')
    public=c.get(f'/api/public/trips/{code}')
    check(public.status_code==200,'Kode publik valid saat active')
    check('trip_id' not in public.json() and 'last_seen' not in public.json()['position']
          and 'received_at' not in public.json()['position'],
          'Data internal tidak bocor ke penumpang')
    check(c.post(f'/api/trips/{trip_id}/complete',headers=headers).status_code==409,
          'Kotabumi tidak bisa selesai sebelum Hajimena')
    device_id='QA-'+uuid4().hex[:10]
    resp=c.post('/api/devices/',json={'device_id':device_id,'vehicle_id':vehicle_id,
                'mqtt_username':'qa-'+uuid4().hex[:12]},headers=headers)
    check(resp.status_code==201,'Buat perangkat simulasi untuk pengujian GPS')
    started=datetime.fromisoformat(detail.json()['started_at'].replace('Z','+00:00')) if detail.json()['started_at'] else None
    # Query actual started_at after start so delayed fix is still in-trip.
    with engine.connect() as conn:
        started=conn.execute(text('SELECT started_at FROM trips WHERE trip_id=:trip_id'),
                             {'trip_id':trip_id}).scalar_one()
    newer=datetime.now(timezone.utc)
    older=started+timedelta(microseconds=100)
    if older>=newer:
        older=newer-timedelta(microseconds=10)
    with engine.begin() as conn:
        insert_gps(conn,device_id,trip_id,1,newer,-5.34,105.24,True)
        insert_gps(conn,device_id,trip_id,2,None,None,None,False)
    v=c.get(f'/api/trips/{trip_id}',headers=headers)
    check(v.status_code==200 and v.json()['position']['gps_status']=='invalid'
          and abs(v.json()['position']['latitude']-(-5.34))<1e-8,
          'GPS invalid tidak menimpa posisi valid')
    with engine.begin() as conn:
        insert_gps(conn,device_id,trip_id,3,older,-5.35,105.23,True)
    trip_data=c.get(f'/api/trips/{trip_id}',headers=headers).json()
    check(abs(trip_data['position']['latitude']-(-5.34))<1e-8,
          'Pesan GPS terlambat tidak menimpa yang terbaru')
    check(trip_data['distance']['traveled_method'].startswith('sum_of_great_circle'),
          'Metode jarak GPS didokumentasikan')
    check(trip_data['distance']['remaining_method']=='great_circle_direct_to_target_not_road_distance',
          'Jarak target dibedakan dari jarak jalan')
    check(c.get(f'/api/trips/{trip_id}/positions?limit=2',headers=headers).status_code==200,
          'Riwayat GPS internal dapat dibaca')
    check(c.get(f'/api/trips/{trip_id}/positions?limit=1000',headers=headers).status_code==422,
          'Riwayat memiliki batas pagination')
    arrive=c.post(f'/api/trips/{trip_id}/arrive-hajimena',headers=headers)
    check(arrive.status_code==200 and arrive.json()['status']=='active',
          'Tiba Hajimena tetap aktif')
    check(c.get(f'/api/public/trips/{code}').status_code==200,
          'Kode tetap valid sesudah Hajimena')
    finish=c.post(f'/api/trips/{trip_id}/complete',headers=headers)
    check(finish.status_code==200,'Selesai di Kotabumi')
    check(c.get(f'/api/public/trips/{code}').status_code==404,
          'Kode otomatis tidak berlaku setelah trip selesai')
    check(any(x['trip_id']==trip_id for x in c.get('/api/trips/?status=completed',
          headers=headers).json()),'Riwayat trip completed tersedia')
    output=Path(__file__).resolve().parents[2]/'docs'
    output.mkdir(exist_ok=True)
    (output/'PM10_openapi.json').write_text(json.dumps(app.openapi(),indent=2,ensure_ascii=False),
                                             encoding='utf-8')
    safe_start={**start.json(),'public_code':'<redacted>',
                'public_path':'/api/public/trips/<redacted>'}
    examples={'start':safe_start,
              'public_during_active':public.json(),
              'operator_detail':trip_data,
              'finish':finish.json()}
    (output/'PM10_contoh_respons.json').write_text(json.dumps(examples,indent=2,
        ensure_ascii=False),encoding='utf-8')
    print('\nSEMUA SMOKE TEST BERHASIL. OpenAPI dan contoh respons ditulis ke docs/.')
    print('Penting: ini data QA lokal, bukan hasil pengujian lapangan.')


if __name__=='__main__':
    main()
