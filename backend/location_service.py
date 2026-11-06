
from datetime import datetime, timezone

from sqlalchemy import text

from database import engine


def get_latest_location(vehicle_id: str):
    query = text("""
        SELECT
            v.id::text AS vehicle_id,
            v.plate_number,
            ST_Y(v.last_location) AS latitude,
            ST_X(v.last_location) AS longitude,
            v.last_observed_at AS observed_at,

            gps.received_at,
            gps.speed_kmh,
            gps.gps_valid,
            gps.trip_id,

            activity.last_seen_at

        FROM vehicles v

        LEFT JOIN LATERAL (
            SELECT
                p.received_at,
                p.speed_kmh,
                p.gps_valid,
                p.trip_id
            FROM gps_positions p
            JOIN devices d
                ON d.device_id = p.device_id
            WHERE d.vehicle_id = v.id
              AND p.gps_valid = TRUE
              AND p.observed_at = v.last_observed_at
            ORDER BY p.received_at DESC, p.id DESC
            LIMIT 1
        ) gps ON TRUE

        LEFT JOIN LATERAL (
            SELECT
                MAX(p.received_at) AS last_seen_at
            FROM gps_positions p
            JOIN devices d
                ON d.device_id = p.device_id
            WHERE d.vehicle_id = v.id
        ) activity ON TRUE

        WHERE v.id = CAST(:vehicle_id AS UUID)
    """)

    with engine.connect() as connection:
        row = connection.execute(
            query,
            {"vehicle_id": vehicle_id}
        ).mappings().first()

    if row is None:
        return None

    result = dict(row)
    observed_at = result["observed_at"]

    if (
        observed_at is None
        or result["latitude"] is None
        or result["longitude"] is None
    ):
        result["data_age_seconds"] = None
        result["location_status"] = "no_location"
        return result

    age = (
        datetime.now(timezone.utc) - observed_at
    ).total_seconds()

    if age < 0:
        result["data_age_seconds"] = 0
        result["location_status"] = "invalid_timestamp"
    else:
        result["data_age_seconds"] = int(age)

        if age <= 30:
            result["location_status"] = "fresh"
        elif age <= 60:
            result["location_status"] = "stale"
        else:
            result["location_status"] = "no_update"

    return result
