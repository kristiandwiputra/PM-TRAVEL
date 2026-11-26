"""PM_10 regression tests against local PostGIS, with fixture rows rolled back.

Never run smoke_pm10.py as part of this suite: that script persists QA data.
"""
import hashlib
import sys
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, TimeoutError as PoolTimeoutError

import auth
import devices_api
import location_service
import main
import public_api
import route_targets_api
import trips_api
import vehicles_api
from database import engine, settings

TEST_SECRET = 'PM10-only-isolated-regression-secret-not-for-deployment'


class TransactionEngine:
    """Run synchronous API requests on the fixture transaction and savepoints."""

    def __init__(self, connection):
        self.connection = connection

    @contextmanager
    def connect(self):
        yield self.connection

    @contextmanager
    def begin(self):
        with self.connection.begin_nested():
            yield self.connection


class PM10ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if settings.pg_host not in ('127.0.0.1', 'localhost', '::1') or settings.pg_database != 'pmtravel_dev':
            raise RuntimeError('Pengujian hanya diizinkan pada PostgreSQL lokal pmtravel_dev')
        cls.password = 'PM10-fixture-password-only'
        cls.password_hash = auth.hasher.hash(cls.password)

    def setUp(self):
        self.connection = engine.connect()
        self.addCleanup(self.connection.close)
        transaction = self.connection.begin()
        self.addCleanup(transaction.rollback)
        fixture_engine = TransactionEngine(self.connection)
        for module in (auth, devices_api, location_service, main, public_api,
                       route_targets_api, trips_api, vehicles_api):
            patcher = patch.object(module, 'engine', fixture_engine)
            patcher.start()
            self.addCleanup(patcher.stop)
        secret_patch = patch.object(auth, 'get_jwt_secret', return_value=TEST_SECRET)
        secret_patch.start()
        self.addCleanup(secret_patch.stop)
        self.client = TestClient(main.app, raise_server_exceptions=False)
        self.addCleanup(self.client.close)
        self.namespace = 'QA-PM10-' + uuid4().hex[:12]
        self.now = datetime.now(timezone.utc)
        self.users = {}
        self.headers = {}
        for name, role in (('admin', 'admin'), ('operator', 'operator'), ('other', 'operator')):
            user_id = str(uuid4())
            email = f'{name}-{self.namespace}@example.invalid'
            self.connection.execute(text('''
                INSERT INTO users(id, full_name, email, password_hash, role)
                VALUES (CAST(:id AS uuid), :name, :email, :hash, :role)
            '''), {'id': user_id, 'name': self.namespace, 'email': email,
                   'hash': self.password_hash, 'role': role})
            self.users[name] = {'id': user_id, 'email': email, 'role': role}
            self.headers[name] = self.token_headers(user_id)
        self.vehicle_id = self.add_vehicle('operator', 'A')
        self.other_vehicle_id = self.add_vehicle('other', 'B')
        self.device_id = self.namespace
        self.connection.execute(text('''
            INSERT INTO devices(device_id, vehicle_id, mqtt_username, is_active)
            VALUES (:id, CAST(:vehicle AS uuid), :username, TRUE)
        '''), {'id': self.device_id, 'vehicle': self.vehicle_id, 'username': self.namespace})

    def token_headers(self, user_id, **claims):
        payload = {'sub': user_id, 'iss': 'pmtravel', 'iat': self.now,
                   'exp': self.now + timedelta(minutes=30), **claims}
        token = jwt.encode(payload, TEST_SECRET, algorithm='HS256')
        return {'Authorization': 'Bearer ' + token}

    def add_vehicle(self, owner, suffix):
        vehicle_id = str(uuid4())
        self.connection.execute(text('''
            INSERT INTO vehicles(id, plate_number, display_name, operator_id, is_active)
            VALUES (CAST(:id AS uuid), :plate, :name, CAST(:owner AS uuid), TRUE)
        '''), {'id': vehicle_id, 'plate': self.namespace + suffix,
               'name': 'Fixture PM_10', 'owner': self.users[owner]['id']})
        return vehicle_id

    def create_trip(self):
        response = self.client.post('/api/trips/', json={'vehicle_id': self.vehicle_id},
                                    headers=self.headers['operator'])
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()['trip_id']

    def add_gps(self, trip_id, sequence, observed_at, latitude=-5.34, longitude=105.24,
                valid=True, received_at=None):
        message_id = f'{self.namespace}-{sequence}'
        self.connection.execute(text('''
            INSERT INTO gps_positions(message_id, device_id, boot_id, sequence_id,
                trip_id, observed_at, received_at, latitude, longitude, speed_kmh,
                gps_valid, location, payload_hash, raw_payload)
            VALUES (:message, :device, :boot, :sequence, :trip, :observed, :received,
                :lat, :lon, :speed, :valid,
                CASE WHEN :valid THEN ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) END,
                :digest, CAST('{"fixture":"PM10"}' AS jsonb))
        '''), {'message': message_id, 'device': self.device_id, 'boot': self.namespace,
               'sequence': sequence, 'trip': trip_id, 'observed': observed_at,
               'received': received_at or self.now, 'lat': latitude if valid else None,
               'lon': longitude if valid else None, 'speed': 10.0 if valid else None,
               'valid': valid, 'digest': hashlib.sha256(message_id.encode()).hexdigest()})

    def test_history_survives_device_reassignment(self):
        trip_id = self.create_trip()
        self.connection.execute(text('''
            UPDATE trips SET status='completed', started_at=:start, ended_at=:end
            WHERE trip_id=:trip
        '''), {'start': self.now - timedelta(minutes=10),
               'end': self.now - timedelta(minutes=5), 'trip': trip_id})
        self.add_gps(trip_id, 1, self.now - timedelta(minutes=9), latitude=-5.35)
        self.add_gps(trip_id, 2, self.now - timedelta(minutes=8))
        before = self.client.get(f'/api/trips/{trip_id}', headers=self.headers['operator']).json()
        moved = self.client.patch(f'/api/devices/{self.device_id}/vehicle',
                                  json={'vehicle_id': self.other_vehicle_id}, headers=self.headers['admin'])
        self.assertEqual(moved.status_code, 200, moved.text)
        after = self.client.get(f'/api/trips/{trip_id}', headers=self.headers['operator']).json()
        history = self.client.get(f'/api/trips/{trip_id}/positions', headers=self.headers['operator'])
        self.assertEqual(len(history.json()), 2, 'Moving a device must preserve historical GPS')
        self.assertEqual(after['position']['latitude'], before['position']['latitude'])
        self.assertEqual(after['distance'], before['distance'])
        self.assertEqual(after['distance']['traveled_points'], 2)
        self.assertEqual(self.client.get(f'/api/trips/{trip_id}', headers=self.headers['other']).status_code, 404)

    def test_public_response_has_no_internal_identifiers(self):
        trip_id = self.create_trip()
        started = self.client.post(f'/api/trips/{trip_id}/start', headers=self.headers['operator'])
        self.assertEqual(started.status_code, 200, started.text)
        public = self.client.get(started.json()['public_path'])
        self.assertEqual(public.status_code, 200)
        forbidden = {'trip_id', 'vehicle_id', 'operator_id', 'target_id', 'received_at',
                     'last_seen', 'raw_payload', 'password_hash', 'public_code_hash'}

        def check(value):
            if isinstance(value, dict):
                self.assertFalse(forbidden.intersection(value), f'Internal keys leaked: {forbidden.intersection(value)}')
                for child in value.values():
                    check(child)
            elif isinstance(value, list):
                for child in value:
                    check(child)
        check(public.json())

    def test_latest_gps_activity_does_not_replace_valid_position(self):
        observed = self.now - timedelta(seconds=10)
        self.add_gps(None, 1, observed, received_at=self.now - timedelta(seconds=2))
        self.add_gps(None, 2, None, valid=False, received_at=self.now - timedelta(seconds=1))
        self.connection.execute(text('''
            UPDATE vehicles SET last_observed_at=:observed,
                last_location=ST_SetSRID(ST_MakePoint(105.24, -5.34), 4326)
            WHERE id=CAST(:id AS uuid)
        '''), {'observed': observed, 'id': self.vehicle_id})
        response = self.client.get(f'/api/vehicles/{self.vehicle_id}/location/latest',
                                   headers=self.headers['operator'])
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload['gps_status'], 'invalid')
        self.assertEqual(payload['location_status'], 'fresh')
        self.assertEqual(payload['latitude'], -5.34)

    def test_login_tokens_and_profile(self):
        user = self.users['operator']
        good = self.client.post('/api/auth/login', json={'email': user['email'].upper(), 'password': self.password})
        self.assertEqual(good.status_code, 200, good.text)
        profile = self.client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + good.json()['access_token']})
        self.assertEqual(profile.json(), user)
        bad = self.client.post('/api/auth/login', json={'email': user['email'], 'password': 'incorrect'})
        self.assertEqual(bad.status_code, 401)
        for headers in ({}, {'Authorization': 'Bearer invalid'},
                        self.token_headers(user['id'], exp=self.now - timedelta(seconds=1)),
                        self.token_headers('invalid-uuid')):
            with self.subTest(headers_present=bool(headers)):
                rejected = self.client.get('/api/auth/me', headers=headers)
                self.assertEqual(rejected.status_code, 401)
                self.assertEqual(rejected.headers.get('www-authenticate'), 'Bearer')

    def test_public_access_boundaries_and_active_cancellation(self):
        trip_id = self.create_trip()
        self.assertEqual(self.client.get(f'/api/trips/{trip_id}/positions').status_code, 401)
        for code in ('wrong', 'incorrect-but-valid-looking-code-123456'):
            self.assertEqual(self.client.get('/api/public/trips/' + code).status_code, 404)
        started = self.client.post(f'/api/trips/{trip_id}/start', headers=self.headers['operator'])
        self.assertEqual(self.client.get(started.json()['public_path']).status_code, 200)
        canceled = self.client.post(f'/api/trips/{trip_id}/cancel', headers=self.headers['operator'])
        self.assertEqual(canceled.json()['status'], 'canceled')
        self.assertEqual(self.client.get(started.json()['public_path']).status_code, 404)

    def test_delayed_and_invalid_gps_preserve_latest_valid_trip_position(self):
        trip_id = self.create_trip()
        self.add_gps(trip_id, 1, self.now - timedelta(seconds=5), latitude=-5.34)
        self.add_gps(trip_id, 2, self.now - timedelta(seconds=45), latitude=-5.36,
                     received_at=self.now + timedelta(seconds=1))
        self.add_gps(trip_id, 3, None, valid=False, received_at=self.now + timedelta(seconds=2))
        response = self.client.get(f'/api/trips/{trip_id}', headers=self.headers['operator'])
        self.assertEqual(response.status_code, 200, response.text)
        position = response.json()['position']
        self.assertEqual(position['latitude'], -5.34)
        self.assertEqual(position['location_status'], 'fresh')
        self.assertEqual(position['gps_status'], 'invalid')
        self.assertGreater(position['last_seen'], position['received_at'])

    def test_vehicle_without_gps_has_explicit_empty_location(self):
        response = self.client.get(f'/api/vehicles/{self.vehicle_id}/location/latest',
                                   headers=self.headers['operator'])
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload['location_status'], 'no_location')
        self.assertEqual(payload['gps_status'], 'no_data')
        self.assertIsNone(payload['latitude'])
        self.assertIsNone(payload['data_age_seconds'])

    def test_operator_cannot_access_other_owners_resources(self):
        trip_id = self.create_trip()
        for path in (f'/api/vehicles/{self.vehicle_id}', f'/api/vehicles/{self.vehicle_id}/location/latest',
                     f'/api/devices/{self.device_id}', f'/api/trips/{trip_id}', f'/api/trips/{trip_id}/positions'):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path, headers=self.headers['other']).status_code, 404)
        for path, payload in (('/api/vehicles/', {'plate_number': self.namespace}),
                              ('/api/devices/', {'device_id': 'new', 'vehicle_id': self.vehicle_id, 'mqtt_username': 'new'})):
            self.assertEqual(self.client.post(path, json=payload, headers=self.headers['operator']).status_code, 403)
        self.assertEqual(self.client.patch(f'/api/vehicles/{self.vehicle_id}', json={'operator_id': self.users['other']['id']},
                                           headers=self.headers['operator']).status_code, 403)
        private_device = self.client.get(f'/api/devices/{self.device_id}', headers=self.headers['operator']).json()
        self.assertNotIn('mqtt_username', private_device)

    def test_trip_lifecycle_active_guard_snapshot_and_public_revocation(self):
        first, second = self.create_trip(), self.create_trip()
        snapshot = self.client.get(f'/api/trips/{first}', headers=self.headers['operator']).json()['targets']
        target = self.client.put('/api/route-targets/1', json={'name': self.namespace, 'latitude': -5.36, 'longitude': 105.22}, headers=self.headers['admin'])
        self.assertEqual(target.status_code, 200, target.text)
        self.assertEqual(self.client.get(f'/api/trips/{first}', headers=self.headers['operator']).json()['targets'], snapshot)
        started = self.client.post(f'/api/trips/{first}/start', headers=self.headers['operator'])
        self.assertEqual(started.status_code, 200, started.text)
        self.assertEqual(self.client.post(f'/api/trips/{second}/start', headers=self.headers['operator']).status_code, 409)
        self.assertEqual(self.client.post(f'/api/trips/{first}/complete', headers=self.headers['operator']).status_code, 409)
        self.assertEqual(self.client.patch(f'/api/vehicles/{self.vehicle_id}', json={'is_active': False}, headers=self.headers['admin']).status_code, 409)
        self.assertEqual(self.client.patch(f'/api/devices/{self.device_id}/vehicle', json={'vehicle_id': self.other_vehicle_id}, headers=self.headers['admin']).status_code, 409)
        arrived = self.client.post(f'/api/trips/{first}/arrive-hajimena', headers=self.headers['operator'])
        self.assertEqual(arrived.json()['status'], 'active')
        public = self.client.get(started.json()['public_path'])
        self.assertEqual(public.status_code, 200)
        self.assertTrue(all(target['eta']['status'] == 'unavailable' for target in public.json()['targets']))
        self.assertIsNone(public.json()['distance']['traveled_gps_segments_m'])
        self.assertEqual(self.client.post(f'/api/trips/{first}/complete', headers=self.headers['operator']).status_code, 200)
        self.assertEqual(self.client.get(started.json()['public_path']).status_code, 404)
        self.assertEqual(self.client.post(f'/api/trips/{second}/cancel', headers=self.headers['operator']).json()['status'], 'canceled')
        self.assertEqual(self.client.post(f'/api/trips/{first}/start', headers=self.headers['operator']).status_code, 409)

    def test_pagination_and_payload_limits(self):
        trip_id = self.create_trip()
        for path in ('/api/vehicles/?limit=101', '/api/devices/?offset=-1',
                     '/api/trips/?status=unknown', f'/api/trips/{trip_id}/positions?limit=201'):
            self.assertEqual(self.client.get(path, headers=self.headers['operator']).status_code, 422)
        self.assertEqual(self.client.post('/api/trips/', json={'vehicle_id': self.vehicle_id, 'status': 'active'}, headers=self.headers['operator']).status_code, 422)
        self.assertEqual(self.client.post('/api/vehicles/', json={'plate_number': '   '}, headers=self.headers['admin']).status_code, 422)

    def test_database_failure_returns_safe_503(self):
        for failure in (OperationalError('SELECT password_hash FROM users', {'password': 'do-not-echo'}, Exception('unavailable')),
                        PoolTimeoutError('do-not-echo: pool exhausted')):
            with self.subTest(error=type(failure).__name__):
                with patch.object(auth.engine, 'connect', side_effect=failure), self.assertLogs('pmtravel.api', level='WARNING') as logs:
                    response = self.client.post('/api/auth/login', json={'email': 'qa@example.invalid', 'password': 'do-not-echo'})
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.headers['retry-after'], '3')
                self.assertIn('detail', response.json())
                for forbidden in ('do-not-echo', 'password_hash'):
                    self.assertNotIn(forbidden, response.text)
                    self.assertNotIn(forbidden, '\n'.join(logs.output))


if __name__ == '__main__':
    unittest.main()
