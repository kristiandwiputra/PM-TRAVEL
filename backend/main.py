import logging

from trips_api import router as trips_router
from public_api import router as public_router
from route_targets_api import router as route_targets_router
from devices_api import router as devices_router
from vehicles_api import router as vehicles_router
from auth import router as auth_router
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError, TimeoutError as PoolTimeoutError

from database import engine, settings
from api_schemas import DatabaseHealthResponse, ErrorResponse, HealthResponse

logger = logging.getLogger('pmtravel.api')


app = FastAPI(
    title="PM-TRAVEL Backend API",
    description=(
        'API operasional PM-TRAVEL untuk koridor Tanjung Karang → Hajimena → Kotabumi.\n\n'
        '**Akses:** admin mengelola armada; operator hanya mengakses sumber daya miliknya. '
        'Masuk melalui `/api/auth/login`, lalu masukkan JWT pada **Authorize**. '
        'Penumpang menggunakan kode publik yang hanya berlaku selama trip aktif.\n\n'
        '**Waktu dan jarak:** waktu berzona UTC, usia posisi dihitung dari `observed_at`, '
        'jarak dalam meter. Jarak GPS/garis lurus bukan jarak rute jalan. '
        'ETA tetap `unavailable` sampai integrasi PM_15 tersedia.'
    ),
    version="0.2.0",
    openapi_tags=[
        {'name': 'Health', 'description': 'Kesehatan proses API dan koneksi PostgreSQL/PostGIS.'},
        {'name': 'Authentication', 'description': 'Login JWT 30 menit dan profil admin/operator.'},
        {'name': 'Vehicles', 'description': 'Armada, penugasan, dan posisi valid terakhir.'},
        {'name': 'Devices', 'description': 'Metadata perangkat; kredensial MQTT tidak dikembalikan.'},
        {'name': 'Route Targets', 'description': 'Konfigurasi dua target untuk trip berikutnya.'},
        {'name': 'Trips', 'description': 'Siklus perjalanan, snapshot target, jarak, dan riwayat GPS internal.'},
        {'name': 'Passenger', 'description': 'Ringkasan aktif melalui kode publik, tanpa ID internal.'},
    ],
    swagger_ui_parameters={
        'docExpansion': 'none', 'displayRequestDuration': True, 'filter': True,
        'persistAuthorization': False,
    },
)


@app.exception_handler(OperationalError)
@app.exception_handler(PoolTimeoutError)
async def database_unavailable(request: Request, exc: Exception):
    # Do not log the URL (public trip code), SQL parameters, tokens, or connection string.
    logger.warning('Database connection unavailable: %s', type(exc).__name__)
    return JSONResponse(
        status_code=503,
        content={'detail': 'Layanan data sementara tidak tersedia. Silakan coba kembali.'},
        headers={'Retry-After': '3'},
    )

app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(devices_router)
app.include_router(route_targets_router)
app.include_router(trips_router)
app.include_router(public_router)

@app.get("/health", tags=["Health"], response_model=HealthResponse,
         summary="Periksa proses API tanpa menghubungi database")
def health():
    return {
        "status": "ok",
        "service": "pmtravel-backend",
    }


@app.get("/health/db", tags=["Health"], response_model=DatabaseHealthResponse,
         summary="Periksa koneksi PostgreSQL dan ekstensi PostGIS",
         responses={503: {'model': ErrorResponse, 'description': 'Database/PostGIS tidak tersedia.'}})
def database_health():
    try:
        with engine.connect() as connection:
            db_user = connection.execute(
                text("SELECT current_user")
            ).scalar_one()

            postgis_version = connection.execute(
                text("SELECT PostGIS_Version()")
            ).scalar_one()

        return {
            "status": "ok",
            "database": settings.pg_database,
            "user": db_user,
            "postgis": postgis_version,
        }

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        )
