
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    StrictBool,
    StrictInt,
    StrictStr,
    ValidationError,
    model_validator,
)
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import engine, settings


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("pmtravel-subscriber")

TOPIC_PATTERN = re.compile(
    r"^pmtravel/([A-Za-z0-9_-]+)/telemetry$"
)

# Firmware Sendi yang lama mengirim JSON ke /test setiap sekitar 30 detik.
# Adapter digabung di sini agar hanya ada satu proses subscriber.
LEGACY_DEVICE_ID = os.environ.get("LEGACY_DEVICE_ID", "PMT-001")
if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", LEGACY_DEVICE_ID):
    raise ValueError("LEGACY_DEVICE_ID tidak valid")

LEGACY_TOPIC = f"pmtravel/{LEGACY_DEVICE_ID}/test"
LEGACY_PAYLOAD_LIMIT = 512


def normalize_legacy(topic: str, payload: bytes, *, received_at=None):
    """Ubah payload Sendi dari /test menjadi kontrak telemetry PM_08."""
    if topic != LEGACY_TOPIC:
        raise ValueError("Topik legacy tidak sesuai")
    if len(payload) > LEGACY_PAYLOAD_LIMIT:
        raise ValueError("Payload legacy melebihi 512 byte")

    raw = json.loads(payload.decode("utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Payload legacy harus berupa objek JSON")
    if raw.get("device_id") != LEGACY_DEVICE_ID:
        raise ValueError("device_id legacy tidak cocok dengan topik")

    gps_valid = raw.get("gps_valid")
    if type(gps_valid) is not bool:
        raise ValueError("gps_valid legacy harus boolean")

    now = received_at or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("received_at harus memiliki zona waktu")

    timestamp = raw.get("timestamp")
    observed = None
    if timestamp is not None:
        if not isinstance(timestamp, str):
            raise ValueError("timestamp legacy harus string atau null")
        try:
            observed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("timestamp legacy tidak valid") from exc
        if observed.tzinfo is None:
            raise ValueError("timestamp legacy memerlukan zona waktu")
        observed = observed.astimezone(timezone.utc)

    if gps_valid and observed is None:
        raise ValueError("GPS valid membutuhkan timestamp")

    # Firmware lama belum menyediakan message_id. Identitas ini best effort;
    # QoS 1 belum menjamin deduplikasi aplikasi bila timestamp kosong.
    sequence = int(observed.timestamp()) if observed else int(now.timestamp() // 30)
    fingerprint = hashlib.sha256(
        json.dumps(
            raw,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    ).hexdigest()[:16]
    message_id = f"{LEGACY_DEVICE_ID}-LEGACY-{sequence}-{fingerprint}"

    normalized = {
        "device_id": LEGACY_DEVICE_ID,
        "boot_id": "LEGACY-ADAPTER",
        "sequence_id": sequence,
        "message_id": message_id,
        "trip_id": None,
        "observed_at": (
            observed.isoformat().replace("+00:00", "Z") if gps_valid else None
        ),
        "latitude": raw.get("latitude") if gps_valid else None,
        "longitude": raw.get("longitude") if gps_valid else None,
        "speed_kmh": raw.get("speed_kmh") if gps_valid else None,
        "gps_valid": gps_valid,
        "satellites": raw.get("satellites"),
        "hdop": raw.get("hdop"),
    }
    converted = json.dumps(
        normalized,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    if len(converted) > 512:
        raise ValueError("Payload setelah konversi melebihi 512 byte")

    return f"pmtravel/{LEGACY_DEVICE_ID}/telemetry", converted, message_id


class Telemetry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: StrictStr = Field(min_length=1, max_length=64)
    boot_id: StrictStr = Field(min_length=1, max_length=64)
    sequence_id: StrictInt = Field(ge=0)
    message_id: StrictStr = Field(min_length=1, max_length=128)

    trip_id: StrictStr | None = None
    observed_at: AwareDatetime | None = None

    latitude: FiniteFloat | None = Field(default=None, ge=-90, le=90)
    longitude: FiniteFloat | None = Field(default=None, ge=-180, le=180)
    speed_kmh: FiniteFloat | None = Field(default=None, ge=0)

    gps_valid: StrictBool

    satellites: StrictInt | None = Field(default=None, ge=0)
    hdop: FiniteFloat | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_gps(self):
        gps_fields = (
            self.observed_at,
            self.latitude,
            self.longitude,
            self.speed_kmh,
        )

        if self.gps_valid and any(value is None for value in gps_fields):
            raise ValueError(
                "GPS valid membutuhkan waktu, koordinat, dan kecepatan"
            )

        if not self.gps_valid and any(
            value is not None for value in gps_fields
        ):
            raise ValueError(
                "GPS invalid harus memiliki waktu, koordinat, "
                "dan kecepatan bernilai null"
            )

        return self


def store_telemetry(topic: str, payload: bytes):
    topic_match = TOPIC_PATTERN.fullmatch(topic)

    if topic_match is None:
        raise ValueError("Topik MQTT tidak sesuai")

    if len(payload) > 512:
        raise ValueError("Payload melebihi 512 byte")

    raw = json.loads(payload.decode("utf-8"))

    if not isinstance(raw, dict):
        raise ValueError("Payload harus berupa objek JSON")

    telemetry = Telemetry.model_validate(raw)

    if telemetry.device_id != topic_match.group(1):
        raise ValueError("device_id tidak cocok dengan topik MQTT")

    canonical_payload = json.dumps(
        raw,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )

    payload_hash = hashlib.sha256(
        canonical_payload.encode("utf-8")
    ).hexdigest()

    with engine.begin() as conn:
        device = conn.execute(
            text("""
                SELECT vehicle_id
                FROM devices
                WHERE device_id = :device_id
                  AND is_active = TRUE
                FOR UPDATE
            """),
            {"device_id": telemetry.device_id},
        ).mappings().first()

        if device is None:
            raise ValueError("Perangkat tidak terdaftar atau tidak aktif")

        vehicle_id = device["vehicle_id"]

        existing = conn.execute(
            text("""
                SELECT device_id, payload_hash
                FROM gps_positions
                WHERE message_id = :message_id
            """),
            {"message_id": telemetry.message_id},
        ).mappings().first()

        if existing is not None:
            if (
                existing["device_id"] == telemetry.device_id
                and existing["payload_hash"] == payload_hash
            ):
                return telemetry, "duplicate"

            raise ValueError(
                "message_id sudah dipakai oleh payload berbeda"
            )

        assigned_trip_id = None

        if telemetry.trip_id is not None:
            trip = conn.execute(
                text("""
                    SELECT started_at, ended_at
                    FROM trips
                    WHERE trip_id = :trip_id
                      AND vehicle_id = :vehicle_id
                """),
                {
                    "trip_id": telemetry.trip_id,
                    "vehicle_id": vehicle_id,
                },
            ).mappings().first()

            if trip is None:
                raise ValueError(
                    "Trip tidak terdaftar untuk kendaraan ini"
                )

            if telemetry.observed_at is not None:
                observed = telemetry.observed_at

                if observed < trip["started_at"]:
                    raise ValueError(
                        "Waktu GPS lebih awal daripada awal trip"
                    )

                if (
                    trip["ended_at"] is not None
                    and observed > trip["ended_at"]
                ):
                    raise ValueError(
                        "Waktu GPS melewati akhir trip"
                    )

                assigned_trip_id = telemetry.trip_id

        elif telemetry.observed_at is not None:
            matching_trips = conn.execute(
                text("""
                    SELECT trip_id
                    FROM trips
                    WHERE vehicle_id = :vehicle_id
                      AND started_at <= :observed_at
                      AND (
                          ended_at IS NULL
                          OR ended_at >= :observed_at
                      )
                    ORDER BY started_at DESC
                    LIMIT 2
                """),
                {
                    "vehicle_id": vehicle_id,
                    "observed_at": telemetry.observed_at,
                },
            ).fetchall()

            if len(matching_trips) > 1:
                raise ValueError(
                    "Ada lebih dari satu trip untuk waktu pengamatan"
                )

            if matching_trips:
                assigned_trip_id = matching_trips[0][0]

        conn.execute(
            text("""
                INSERT INTO gps_positions (
                    message_id,
                    device_id,
                    boot_id,
                    sequence_id,
                    trip_id,
                    observed_at,
                    latitude,
                    longitude,
                    speed_kmh,
                    gps_valid,
                    satellites,
                    hdop,
                    location,
                    payload_hash,
                    raw_payload
                )
                VALUES (
                    :message_id,
                    :device_id,
                    :boot_id,
                    :sequence_id,
                    :trip_id,
                    :observed_at,
                    :latitude,
                    :longitude,
                    :speed_kmh,
                    :gps_valid,
                    :satellites,
                    :hdop,
                    CASE
                        WHEN :gps_valid THEN
                            ST_SetSRID(
                                ST_MakePoint(:longitude, :latitude),
                                4326
                            )
                        ELSE NULL
                    END,
                    :payload_hash,
                    CAST(:raw_payload AS jsonb)
                )
            """),
            {
                "message_id": telemetry.message_id,
                "device_id": telemetry.device_id,
                "boot_id": telemetry.boot_id,
                "sequence_id": telemetry.sequence_id,
                "trip_id": assigned_trip_id,
                "observed_at": telemetry.observed_at,
                "latitude": telemetry.latitude,
                "longitude": telemetry.longitude,
                "speed_kmh": telemetry.speed_kmh,
                "gps_valid": telemetry.gps_valid,
                "satellites": telemetry.satellites,
                "hdop": telemetry.hdop,
                "payload_hash": payload_hash,
                "raw_payload": canonical_payload,
            },
        )

        if telemetry.gps_valid:
            conn.execute(
                text("""
                    UPDATE vehicles
                    SET last_observed_at = :observed_at,
                        last_location = ST_SetSRID(
                            ST_MakePoint(:longitude, :latitude),
                            4326
                        )
                    WHERE id = :vehicle_id
                      AND (
                          last_observed_at IS NULL
                          OR last_observed_at < :observed_at
                      )
                """),
                {
                    "vehicle_id": vehicle_id,
                    "observed_at": telemetry.observed_at,
                    "longitude": telemetry.longitude,
                    "latitude": telemetry.latitude,
                },
            )

    # Blok transaksi sudah selesai dan berhasil commit.
    return telemetry, "stored"


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        logger.error("Koneksi MQTT ditolak: %s", reason_code)
        return

    result, _ = client.subscribe(
        [
            ("pmtravel/+/telemetry", 1),
            (LEGACY_TOPIC, 1),
        ]
    )

    if result == mqtt.MQTT_ERR_SUCCESS:
        logger.info("Terhubung. Subscriber aktif.")
    else:
        logger.error("Gagal melakukan subscribe MQTT")


def on_message(client, userdata, message):
    logger.info("MQTT MASUK | topic=%s | bytes=%d", message.topic, len(message.payload))

    try:
        topic = message.topic
        payload = message.payload

        if topic == LEGACY_TOPIC:
            topic, payload, _ = normalize_legacy(topic, payload)

        telemetry, status = store_telemetry(
            topic,
            payload,
        )

    except (ValidationError, ValueError, UnicodeError) as exc:
        logger.warning(
            "Pesan ditolak dari %s: %s",
            message.topic,
            type(exc).__name__,
        )
        return

    except SQLAlchemyError:
        logger.exception(
            "Penyimpanan database gagal pada topik %s",
            message.topic,
        )
        return

    except Exception:
        logger.exception("Kesalahan subscriber")
        return

    ack_topic = f"pmtravel/{telemetry.device_id}/ack"

    ack_payload = json.dumps({
        "device_id": telemetry.device_id,
        "message_id": telemetry.message_id,
        "status": status,
    })

    result = client.publish(
        ack_topic,
        payload=ack_payload,
        qos=1,
        retain=False,
    )

    if result.rc != mqtt.MQTT_ERR_SUCCESS:
        logger.error(
            "Gagal mengantre ACK untuk %s",
            telemetry.message_id,
        )
        return

    logger.info(
        "GPS %s | device=%s | message=%s",
        status,
        telemetry.device_id,
        telemetry.message_id,
    )


def main():
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id="pmtravel-backend-subscriber",
        protocol=mqtt.MQTTv311,
    )

    client.username_pw_set(
        settings.mqtt_username,
        settings.mqtt_password,
    )

    client.on_connect = on_connect
    client.on_message = on_message

    client.reconnect_delay_set(
        min_delay=1,
        max_delay=30,
    )

    logger.info("Menghubungkan subscriber ke broker MQTT...")

    client.connect(
        settings.mqtt_host,
        settings.mqtt_port,
        keepalive=60,
    )

    client.loop_forever()


if __name__ == "__main__":
    main()
