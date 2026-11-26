"""One freshness policy for vehicle and trip location responses (PM_02/PM_10)."""
from datetime import datetime, timezone


def location_freshness(observed_at, *, has_location, now=None):
    if not has_location or observed_at is None:
        return {'data_age_seconds': None, 'location_status': 'no_location'}
    if observed_at.tzinfo is None or observed_at.utcoffset() is None:
        return {'data_age_seconds': None, 'location_status': 'invalid_timestamp'}
    age = ((now or datetime.now(timezone.utc)) - observed_at).total_seconds()
    status = ('invalid_timestamp' if age < 0 else 'fresh' if age <= 30
              else 'stale' if age <= 60 else 'no_update')
    return {'data_age_seconds': max(0, int(age)), 'location_status': status}
