"""Helpers for PM_10. No public access to raw GPS rows."""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import text


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z') if dt else None


def owned_trip(conn, trip_id, user, for_update=False):
    q = """
        SELECT t.trip_id, t.vehicle_id::text AS vehicle_id,
               t.operator_id::text AS operator_id,
               t.status, t.started_at, t.ended_at, t.arrived_hajimena_at,
               v.plate_number, v.is_active AS vehicle_is_active
        FROM trips t JOIN vehicles v ON v.id = t.vehicle_id
        WHERE t.trip_id = :trip_id
          AND (:is_admin OR (t.operator_id = CAST(:user_id AS uuid)
              AND v.operator_id = CAST(:user_id AS uuid)))
    """
    if for_update:
        q += ' FOR UPDATE OF t'
    row = conn.execute(text(q), {'trip_id': trip_id,
                                 'is_admin': user['role'] == 'admin',
                                 'user_id': user['id']}).mappings().first()
    if row is None:
        raise HTTPException(404, 'Perjalanan tidak ditemukan atau bukan kewenangan akun')
    return dict(row)


def trip_targets(conn, trip_id):
    rows = conn.execute(text('''
        SELECT id AS target_id, sequence_no, name,
               ST_Y(location) AS latitude, ST_X(location) AS longitude
        FROM targets WHERE trip_id = :trip_id ORDER BY sequence_no
    '''), {'trip_id': trip_id}).mappings().all()
    return [dict(r) for r in rows]


def location_for_trip(conn, trip_id, include_internal=False):
    # GPS position must belong to this trip; another trip's vehicle cache is not used.
    valid = conn.execute(text('''
        SELECT p.observed_at, p.received_at, p.latitude, p.longitude,
               p.speed_kmh, p.satellites, p.hdop
        FROM gps_positions p
        JOIN devices d ON d.device_id=p.device_id
        JOIN trips t ON t.trip_id=p.trip_id AND t.vehicle_id=d.vehicle_id
        WHERE p.trip_id=:trip_id AND p.gps_valid=TRUE
          AND p.observed_at IS NOT NULL AND p.location IS NOT NULL
          AND p.latitude BETWEEN -90 AND 90 AND p.longitude BETWEEN -180 AND 180
        ORDER BY p.observed_at DESC, p.id DESC LIMIT 1
    '''), {'trip_id': trip_id}).mappings().first()
    activity = conn.execute(text('''
        SELECT received_at, gps_valid FROM gps_positions p
        JOIN devices d ON d.device_id=p.device_id
        JOIN trips t ON t.trip_id=p.trip_id AND t.vehicle_id=d.vehicle_id
        WHERE p.trip_id=:trip_id ORDER BY p.received_at DESC, p.id DESC LIMIT 1
    '''), {'trip_id': trip_id}).mappings().first()
    result = {'latitude': None, 'longitude': None, 'speed_kmh': None,
              'observed_at': None, 'data_age_seconds': None,
              'location_status': 'no_location', 'gps_status': 'no_data'}
    if activity:
        result['gps_status'] = 'valid' if activity['gps_valid'] else 'invalid'
    if valid:
        at = valid['observed_at']
        age = (datetime.now(timezone.utc) - at).total_seconds()
        status = ('invalid_timestamp' if age < 0 else 'fresh' if age <= 30
                  else 'stale' if age <= 60 else 'no_update')
        result.update(latitude=valid['latitude'], longitude=valid['longitude'],
                      speed_kmh=valid['speed_kmh'], observed_at=iso(at),
                      data_age_seconds=max(0, int(age)), location_status=status)
    if include_internal:
        result['received_at'] = iso(valid['received_at']) if valid else None
        result['last_seen'] = iso(activity['received_at']) if activity else None
        result['satellites'] = valid['satellites'] if valid else None
        result['hdop'] = valid['hdop'] if valid else None
    return result


def distance_for_trip(conn, trip_id, location, targets):
    """Great-circle between GPS fixes, NOT roadway distance or an odometer."""
    traveled = conn.execute(text('''
       WITH fixes AS (
         SELECT p.observed_at, p.id, p.location,
                LAG(p.location) OVER (ORDER BY p.observed_at, p.id) AS prev
         FROM gps_positions p JOIN trips t ON t.trip_id=p.trip_id
         JOIN devices d ON d.device_id=p.device_id AND d.vehicle_id=t.vehicle_id
         WHERE p.trip_id=:trip_id AND p.gps_valid=TRUE
           AND p.observed_at IS NOT NULL AND p.location IS NOT NULL
           AND p.observed_at >= t.started_at
           AND (t.ended_at IS NULL OR p.observed_at <= t.ended_at)
       )
       SELECT COUNT(*) AS points,
              COALESCE(SUM(ST_DistanceSphere(prev, location)) FILTER
                  (WHERE prev IS NOT NULL), 0) AS meters
       FROM fixes
    '''), {'trip_id': trip_id}).mappings().one()
    # Do not return 0 when GPS telemetry is absent.
    traveled_m = round(float(traveled['meters']), 1) if traveled['points'] >= 2 else None
    remaining = []
    for t in targets:
        meters = None
        if location['latitude'] is not None and location['longitude'] is not None:
            meters = conn.execute(text('''
               SELECT ST_DistanceSphere(
                  ST_SetSRID(ST_MakePoint(:lon,:lat),4326),
                  location
               ) FROM targets WHERE id=:target_id AND trip_id=:trip_id
            '''), {'lon': location['longitude'], 'lat': location['latitude'],
                   'target_id': t['target_id'], 'trip_id': trip_id}).scalar_one()
        remaining.append({'target_id': t['target_id'],
                          'remaining_straight_line_m': round(float(meters), 1)
                          if meters is not None else None})
    return {'traveled_gps_segments_m': traveled_m,
            'traveled_method': 'sum_of_great_circle_distances_between_valid_gps_fixes',
            'traveled_points': traveled['points'],
            'traveled_note': 'Estimasi lintasan dari fix GPS; bukan odometer atau jarak rute jalan. Outlier GPS dapat memengaruhi hasil.',
            'remaining_method': 'great_circle_direct_to_target_not_road_distance',
            'unit': 'meter', 'per_target': remaining}


def trip_view(conn, trip, include_internal=False):
    targets = trip_targets(conn, trip['trip_id'])
    location = location_for_trip(conn, trip['trip_id'], include_internal)
    distances = distance_for_trip(conn, trip['trip_id'], location, targets)
    remaining_by_id = {x['target_id']: x['remaining_straight_line_m']
                       for x in distances.pop('per_target')}
    for t in targets:
        t['remaining_straight_line_m'] = remaining_by_id.get(t['target_id'])
        t['eta'] = {'status': 'unavailable', 'predicted_arrival_at': None,
                    'predicted_duration_seconds': None, 'model_version': None,
                    'reason': 'PM_15_not_integrated'}
    payload = {'status': trip['status'], 'started_at': iso(trip['started_at']),
               'ended_at': iso(trip['ended_at']),
               'arrived_hajimena_at': iso(trip['arrived_hajimena_at']),
               'position': location, 'targets': targets, 'distance': distances}
    if include_internal:
        payload.update(trip_id=trip['trip_id'], vehicle_id=trip['vehicle_id'],
                       operator_id=trip['operator_id'], plate_number=trip['plate_number'])
    return payload
