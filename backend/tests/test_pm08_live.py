"""MQTT regression tests; never connect to a broker or publish live GPS."""
import json
import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.exc import OperationalError
import mqtt_subscriber as subscriber
import run_live


class MQTTReceiverTests(unittest.TestCase):
    def test_default_client_ids_are_unique_for_each_backend(self):
        with patch.dict(os.environ, {'MQTT_CLIENT_ID': ''}):
            first, second = subscriber.create_client(), subscriber.create_client()
        self.assertNotEqual(first._client_id, second._client_id)
        self.assertTrue(first._client_id.startswith(b'pmtravel-backend-'))

    def test_explicit_client_id_is_validated(self):
        with patch.dict(os.environ, {'MQTT_CLIENT_ID': 'qa-backend-unique'}):
            client = subscriber.create_client()
        self.assertEqual(client._client_id, b'qa-backend-unique')
        with patch.dict(os.environ, {'MQTT_CLIENT_ID': 'bad id with spaces'}):
            with self.assertRaises(ValueError):
                subscriber.create_client()

    def test_connection_failure_does_not_claim_subscription_success(self):
        client = MagicMock()
        with self.assertLogs(subscriber.logger, level='ERROR'):
            subscriber.on_connect(client, None, None, SimpleNamespace(is_failure=True), None)
        client.subscribe.assert_not_called()

    def test_broker_subscription_rejection_is_reported(self):
        with self.assertLogs(subscriber.logger, level='ERROR') as logs:
            subscriber.on_subscribe(None, None, 1, [SimpleNamespace(is_failure=True)], None)
        self.assertIn('menolak subscription', '\n'.join(logs.output))

    def test_ack_is_only_published_after_storage_succeeds(self):
        client = MagicMock()
        client.publish.return_value.rc = subscriber.mqtt.MQTT_ERR_SUCCESS
        telemetry = SimpleNamespace(device_id='QA-PM08', message_id='QA-MESSAGE')
        def stored(*args):
            client.publish.assert_not_called()
            return telemetry, 'stored'
        message = SimpleNamespace(topic='pmtravel/QA-PM08/telemetry', payload=b'{}')
        with patch.object(subscriber, 'store_telemetry', side_effect=stored):
            subscriber.on_message(client, None, message)
        self.assertEqual(client.publish.call_args.args[0], 'pmtravel/QA-PM08/ack')
        self.assertEqual(json.loads(client.publish.call_args.kwargs['payload'])['status'], 'stored')
        self.assertFalse(client.publish.call_args.kwargs['retain'])

    def test_database_failure_never_sends_ack_or_logs_parameters(self):
        client = MagicMock()
        error = OperationalError('SELECT secret', {'secret': 'do-not-echo'}, Exception('unavailable'))
        message = SimpleNamespace(topic='pmtravel/QA-PM08/telemetry', payload=b'{}')
        with patch.object(subscriber, 'store_telemetry', side_effect=error), self.assertLogs(subscriber.logger, level='ERROR') as logs:
            subscriber.on_message(client, None, message)
        client.publish.assert_not_called()
        self.assertNotIn('do-not-echo', '\n'.join(logs.output))

    def test_invalid_payload_never_sends_ack(self):
        client = MagicMock()
        message = SimpleNamespace(topic='pmtravel/QA-PM08/telemetry', payload=b'{}')
        with self.assertLogs(subscriber.logger, level='WARNING'):
            subscriber.on_message(client, None, message)
        client.publish.assert_not_called()

    def test_planned_trip_is_rejected_instead_of_crashing_timestamp_comparison(self):
        connection = MagicMock()
        def result(value):
            row = MagicMock()
            row.mappings.return_value.first.return_value = value
            return row
        connection.execute.side_effect = [result({'vehicle_id': 'qa-vehicle'}), result(None),
                                          result({'started_at': None, 'ended_at': None})]
        engine = MagicMock()
        engine.begin.return_value.__enter__.return_value = connection
        payload = json.dumps({
            'device_id': 'QA-PM08', 'boot_id': 'qa-boot', 'sequence_id': 1,
            'message_id': 'qa-message', 'trip_id': 'qa-planned-trip',
            'observed_at': datetime.now(timezone.utc).isoformat(),
            'latitude': -5.34, 'longitude': 105.24, 'speed_kmh': 0, 'gps_valid': True,
        }).encode()
        with patch.object(subscriber, 'engine', engine):
            with self.assertRaisesRegex(ValueError, 'Trip belum dimulai'):
                subscriber.store_telemetry('pmtravel/QA-PM08/telemetry', payload)


class LiveRunnerTests(unittest.TestCase):
    def test_runner_starts_receiver_and_cleans_up_when_api_exits(self):
        client = MagicMock()
        with patch.object(run_live, 'port_available', return_value=True), \
             patch.object(subscriber, 'create_client', return_value=client), \
             patch('uvicorn.run', side_effect=RuntimeError('API stopped')):
            with self.assertRaisesRegex(RuntimeError, 'API stopped'):
                run_live.main([])
        client.connect_async.assert_called_once()
        client.loop_start.assert_called_once()
        client.disconnect.assert_called_once()
        client.loop_stop.assert_called_once()


if __name__ == '__main__':
    unittest.main()
