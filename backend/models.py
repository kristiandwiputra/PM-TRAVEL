from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, mapped_column
from geoalchemy2 import Geometry


class Base(DeclarativeBase):
    pass


# =====================================
# 1. AKUN DAN PERAN
# =====================================

class User(Base):
    __tablename__ = "users"

    id = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    full_name = mapped_column(String(120), nullable=False)
    email = mapped_column(String(255), unique=True, nullable=False)
    password_hash = mapped_column(String(255), nullable=False)
    role = mapped_column(String(30), nullable=False)

    created_at = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


# =====================================
# 2. KENDARAAN
# =====================================

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    plate_number = mapped_column(
        String(30),
        unique=True,
        nullable=False,
    )

    display_name = mapped_column(String(120), nullable=True)
    is_active = mapped_column(Boolean, nullable=False, default=True)

    operator_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    last_observed_at = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_location = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=False),
        nullable=True,
    )


# =====================================
# 3. PERANGKAT GPS
# =====================================

class Device(Base):
    __tablename__ = "devices"

    device_id = mapped_column(String(64), primary_key=True)

    vehicle_id = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id"),
        nullable=False,
    )

    mqtt_username = mapped_column(
        String(120),
        unique=True,
        nullable=False,
    )

    is_active = mapped_column(Boolean, nullable=False, default=True)


# =====================================
# 4. PERJALANAN
# =====================================

class Trip(Base):
    __tablename__ = "trips"

    trip_id = mapped_column(String(64), primary_key=True)

    vehicle_id = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id"),
        nullable=False,
    )

    operator_id = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    public_code_hash = mapped_column(String(64), unique=True, nullable=True)
    arrived_hajimena_at = mapped_column(DateTime(timezone=True), nullable=True)

    started_at = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    ended_at = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    status = mapped_column(
        String(30),
        nullable=False,
        server_default="planned",
    )


# =====================================
# 5. TARGET PERJALANAN
# =====================================

class Target(Base):
    __tablename__ = "targets"

    __table_args__ = (
        UniqueConstraint(
            "trip_id",
            "sequence_no",
            name="uq_target_trip_sequence",
        ),
    )

    id = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )

    trip_id = mapped_column(
        String(64),
        ForeignKey("trips.trip_id"),
        nullable=False,
    )

    name = mapped_column(String(120), nullable=False)
    sequence_no = mapped_column(Integer, nullable=False)

    location = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=False),
        nullable=False,
    )


# =====================================
# 6. RIWAYAT TELEMETRI GPS
# =====================================

class GPSPosition(Base):
    __tablename__ = "gps_positions"

    __table_args__ = (
        UniqueConstraint(
            "device_id",
            "boot_id",
            "sequence_id",
            name="uq_gps_device_boot_sequence",
        ),
        CheckConstraint(
            "latitude BETWEEN -90 AND 90",
            name="ck_gps_latitude",
        ),
        CheckConstraint(
            "longitude BETWEEN -180 AND 180",
            name="ck_gps_longitude",
        ),
        CheckConstraint(
            "speed_kmh >= 0",
            name="ck_gps_speed",
        ),
    )

    id = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )

    message_id = mapped_column(
        String(128),
        unique=True,
        nullable=False,
    )

    device_id = mapped_column(
        String(64),
        ForeignKey("devices.device_id"),
        nullable=False,
    )

    boot_id = mapped_column(String(64), nullable=False)
    sequence_id = mapped_column(BigInteger, nullable=False)

    trip_id = mapped_column(
        String(64),
        ForeignKey("trips.trip_id"),
        nullable=True,
    )

    observed_at = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    received_at = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    latitude = mapped_column(Float, nullable=True)
    longitude = mapped_column(Float, nullable=True)
    speed_kmh = mapped_column(Float, nullable=True)

    gps_valid = mapped_column(Boolean, nullable=False)
    satellites = mapped_column(Integer, nullable=True)
    hdop = mapped_column(Float, nullable=True)

    location = mapped_column(
        Geometry("POINT", srid=4326, spatial_index=False),
        nullable=True,
    )

    payload_hash = mapped_column(String(64), nullable=False)
    raw_payload = mapped_column(JSONB, nullable=False)


# =====================================
# 7. HASIL PREDIKSI ETA
# =====================================

class ETAPrediction(Base):
    __tablename__ = "eta_predictions"

    id = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )

    trip_id = mapped_column(
        String(64),
        ForeignKey("trips.trip_id"),
        nullable=False,
    )

    target_id = mapped_column(
        BigInteger,
        ForeignKey("targets.id"),
        nullable=False,
    )

    predicted_arrival_at = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    predicted_duration_seconds = mapped_column(
        Float,
        nullable=True,
    )

    model_version = mapped_column(String(100), nullable=True)

    created_at = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


# =====================================
# 8. KONFIGURASI TARGET RUTE PM_10
# =====================================

class RouteTarget(Base):
    __tablename__ = "route_targets"

    sequence_no = mapped_column(
        Integer,
        primary_key=True,
    )

    name = mapped_column(
        String(120),
        nullable=False,
    )

    location = mapped_column(
        Geometry(
            "POINT",
            srid=4326,
            spatial_index=False,
        ),
        nullable=False,
    )

    updated_at = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
