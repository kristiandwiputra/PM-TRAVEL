"""PM_10 request policy and explicit operator/passenger response contracts."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

TripStatus = Literal['planned', 'active', 'completed', 'canceled']
LocationStatus = Literal['fresh', 'stale', 'no_update', 'no_location', 'invalid_timestamp']
GpsStatus = Literal['valid', 'invalid', 'no_data']


class RequestModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: Literal['ok']
    service: str


class DatabaseHealthResponse(BaseModel):
    status: Literal['ok']
    database: str
    user: str
    postgis: str


PROTECTED_RESPONSES = {
    401: {'model': ErrorResponse, 'description': 'Token tidak ada, tidak valid, atau kedaluwarsa.'},
    403: {'model': ErrorResponse, 'description': 'Peran akun tidak diizinkan melakukan tindakan ini.'},
    404: {'model': ErrorResponse, 'description': 'Data tidak ditemukan atau bukan kewenangan akun.'},
    409: {'model': ErrorResponse, 'description': 'Konflik data atau transisi status perjalanan.'},
    503: {'model': ErrorResponse, 'description': 'Koneksi layanan data sementara tidak tersedia.'},
}


class UserProfile(BaseModel):
    id: UUID
    email: str
    role: Literal['operator', 'admin']


class VehicleResponse(BaseModel):
    vehicle_id: UUID
    plate_number: str
    display_name: str | None
    is_active: bool
    operator_id: UUID | None


class VehicleLocationResponse(BaseModel):
    vehicle_id: UUID
    plate_number: str
    latitude: float | None
    longitude: float | None
    observed_at: datetime | None
    received_at: datetime | None
    speed_kmh: float | None
    gps_valid: bool | None = Field(description='Validitas pesan yang mendasari posisi terakhir, bukan pesan terbaru.')
    trip_id: str | None
    last_seen_at: datetime | None
    gps_status: GpsStatus = Field(description='Validitas pesan GPS terakhir berdasarkan waktu penerimaan.')
    data_age_seconds: int | None
    location_status: LocationStatus = Field(description='Usia observed_at: fresh ≤30s, stale >30–60s, no_update >60s.')


class DeviceResponse(BaseModel):
    device_id: str
    vehicle_id: UUID
    is_active: bool


class DeviceDetailResponse(DeviceResponse):
    plate_number: str


class RouteTargetResponse(BaseModel):
    sequence_no: int
    name: str
    latitude: float
    longitude: float
    updated_at: datetime


class TripSummary(BaseModel):
    trip_id: str
    vehicle_id: UUID
    plate_number: str
    status: TripStatus
    started_at: datetime | None
    ended_at: datetime | None
    arrived_hajimena_at: datetime | None


class PassengerPosition(BaseModel):
    latitude: float | None
    longitude: float | None
    speed_kmh: float | None
    observed_at: datetime | None
    data_age_seconds: int | None
    location_status: LocationStatus
    gps_status: GpsStatus


class OperatorPosition(PassengerPosition):
    received_at: datetime | None
    last_seen: datetime | None
    satellites: int | None
    hdop: float | None


class UnavailableETA(BaseModel):
    status: Literal['unavailable']
    predicted_arrival_at: None = None
    predicted_duration_seconds: None = None
    model_version: None = None
    reason: Literal['PM_15_not_integrated']


class PassengerTarget(BaseModel):
    sequence_no: int
    name: str
    latitude: float
    longitude: float
    remaining_straight_line_m: float | None
    eta: UnavailableETA


class OperatorTarget(PassengerTarget):
    target_id: int


class TripDistance(BaseModel):
    traveled_gps_segments_m: float | None
    traveled_method: str
    traveled_points: int
    traveled_note: str
    remaining_method: str
    unit: Literal['meter']


class PassengerTripResponse(BaseModel):
    status: Literal['active']
    started_at: datetime | None
    ended_at: datetime | None
    arrived_hajimena_at: datetime | None
    position: PassengerPosition
    targets: list[PassengerTarget]
    distance: TripDistance


class OperatorTripResponse(BaseModel):
    trip_id: str
    vehicle_id: UUID
    operator_id: UUID | None
    plate_number: str
    status: TripStatus
    started_at: datetime | None
    ended_at: datetime | None
    arrived_hajimena_at: datetime | None
    position: OperatorPosition
    targets: list[OperatorTarget]
    distance: TripDistance


class TripCreatedResponse(BaseModel):
    trip_id: str
    vehicle_id: UUID
    status: Literal['planned']
    message: str


class TripStartedResponse(BaseModel):
    trip_id: str
    status: Literal['active']
    public_code: str = Field(description='Kode acak 192-bit; hanya dikembalikan saat mulai. Simpan seperti kunci akses.')
    public_path: str
    warning: str


class TripArrivalResponse(BaseModel):
    trip_id: str
    status: Literal['active']
    arrived_hajimena_at: datetime
    message: str


class TripEndedResponse(BaseModel):
    trip_id: str
    status: Literal['completed', 'canceled']
    ended_at: datetime


class GPSHistoryResponse(BaseModel):
    id: int
    observed_at: datetime | None
    received_at: datetime
    latitude: float | None
    longitude: float | None
    speed_kmh: float | None
    gps_valid: bool
    satellites: int | None
    hdop: float | None
