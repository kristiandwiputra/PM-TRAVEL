import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL, create_engine


ENV_FILE = (
    Path(os.environ["LOCALAPPDATA"])
    / "PM-TRAVEL"
    / "backend.env"
)


class Settings(BaseSettings):
    pg_host: str = "127.0.0.1"
    pg_port: int = 5432
    pg_database: str = "pmtravel_dev"
    pg_user: str = "pmtravel_app"
    pg_password: str

    mqtt_host: str = "127.0.0.1"
    mqtt_port: int = 1884
    mqtt_username: str
    mqtt_password: str

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

database_url = URL.create(
    "postgresql+psycopg",
    username=settings.pg_user,
    password=settings.pg_password,
    host=settings.pg_host,
    port=settings.pg_port,
    database=settings.pg_database,
)

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 3},
)