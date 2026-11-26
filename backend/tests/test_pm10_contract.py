"""Deterministic contract/freshness checks; no database connections."""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api_schemas import PassengerTripResponse
from main import app
from telemetry_status import location_freshness


class FreshnessTests(unittest.TestCase):
    def test_thresholds_are_based_on_observed_at(self):
        now = datetime(2026, 11, 26, 0, 0, tzinfo=timezone.utc)
        for seconds, status in ((0, 'fresh'), (30, 'fresh'), (30.001, 'stale'),
                                (60, 'stale'), (60.001, 'no_update'), (-1, 'invalid_timestamp')):
            with self.subTest(seconds=seconds):
                result = location_freshness(now - timedelta(seconds=seconds), has_location=True, now=now)
                self.assertEqual(result['location_status'], status)
                self.assertEqual(result['data_age_seconds'], max(0, int(seconds)))

    def test_missing_coordinates_or_time_never_become_fresh(self):
        now = datetime.now(timezone.utc)
        for observed, has_location in ((None, True), (now, False), (None, False)):
            result = location_freshness(observed, has_location=has_location, now=now)
            self.assertEqual(result, {'location_status': 'no_location', 'data_age_seconds': None})
        naive = location_freshness(now.replace(tzinfo=None), has_location=True, now=now)
        self.assertEqual(naive['location_status'], 'invalid_timestamp')


class OpenAPIContractTests(unittest.TestCase):
    def test_every_successful_operation_has_an_explicit_response_schema(self):
        schema = app.openapi()
        operations = []
        for path, methods in schema['paths'].items():
            for method, operation in methods.items():
                operations.append(operation['operationId'])
                for status, response in operation['responses'].items():
                    if status.startswith('2'):
                        with self.subTest(method=method, path=path, status=status):
                            self.assertTrue(response['content']['application/json']['schema'])
        self.assertEqual(len(operations), len(set(operations)))

    def test_passenger_schema_cannot_include_internal_target_or_position_fields(self):
        schema = PassengerTripResponse.model_json_schema()
        for name, model in schema['$defs'].items():
            for field in ('target_id', 'vehicle_id', 'operator_id', 'received_at', 'last_seen'):
                with self.subTest(model=name, field=field):
                    self.assertNotIn(field, model.get('properties', {}))

    def test_status_enum_and_pagination_limits_are_documented(self):
        trips = app.openapi()['paths']['/api/trips/']['get']['parameters']
        status = next(parameter for parameter in trips if parameter['name'] == 'status')
        self.assertEqual(status['schema']['anyOf'][0]['enum'], ['planned', 'active', 'completed', 'canceled'])
        positions = app.openapi()['paths']['/api/trips/{trip_id}/positions']['get']['parameters']
        limit = next(parameter for parameter in positions if parameter['name'] == 'limit')
        self.assertEqual(limit['schema']['maximum'], 200)


if __name__ == '__main__':
    unittest.main()
