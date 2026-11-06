from trips_api import router as trips_router
from public_api import router as public_router
from route_targets_api import router as route_targets_router
from devices_api import router as devices_router
from vehicles_api import router as vehicles_router
from auth import router as auth_router
from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import engine


app = FastAPI(
    title="PM-TRAVEL Backend API",
    description="Backend sistem pelacakan kendaraan PM-TRAVEL",
    version="0.1.0",
)

app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(devices_router)
app.include_router(route_targets_router)

@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "service": "pmtravel-backend",
    }


@app.get("/health/db", tags=["Health"])
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
            "database": "pmtravel_dev",
            "user": db_user,
            "postgis": postgis_version,
        }

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        )
# PM_10 protected routes
app.include_router(trips_router)
app.include_router(public_router)
