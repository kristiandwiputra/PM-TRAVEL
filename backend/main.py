from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from database import engine


app = FastAPI(
    title="PM-TRAVEL Backend API",
    description="Backend sistem pelacakan kendaraan PM-TRAVEL",
    version="0.1.0",
)


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