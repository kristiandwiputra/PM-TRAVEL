
from sqlalchemy import text

from database import engine
from telemetry_status import location_freshness


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

            activity.last_seen_at,
            activity.latest_gps_valid

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
                p.received_at AS last_seen_at,
                p.gps_valid AS latest_gps_valid
            FROM gps_positions p
            JOIN devices d
                ON d.device_id = p.device_id
            WHERE d.vehicle_id = v.id
            ORDER BY p.received_at DESC, p.id DESC
            LIMIT 1
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
    latest_gps_valid = result.pop('latest_gps_valid')
    result['gps_status'] = ('no_data' if latest_gps_valid is None
                            else 'valid' if latest_gps_valid else 'invalid')
    result.update(location_freshness(result['observed_at'],
                  has_location=result['latitude'] is not None and result['longitude'] is not None))
    return result
