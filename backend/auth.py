
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from dotenv import dotenv_values
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from sqlalchemy import text

from database import engine, ENV_FILE


router = APIRouter(prefix="/api/auth", tags=["Authentication"])
bearer = HTTPBearer(auto_error=False)
hasher = PasswordHash.recommended()

ALGORITHM = "HS256"
TOKEN_MINUTES = 30
ISSUER = "pmtravel"
ALLOWED_ROLES = {"operator", "admin"}

DUMMY_HASH = hasher.hash("dummy-password-for-timing")


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def get_jwt_secret():
    local_config = dotenv_values(ENV_FILE)
    secret = os.getenv("JWT_SECRET") or local_config.get("JWT_SECRET")

    if not secret or len(secret) < 32:
        raise HTTPException(
            status_code=503,
            detail="Konfigurasi autentikasi belum tersedia"
        )

    return secret


def unauthorized():
    return HTTPException(
        status_code=401,
        detail="Email, password, atau token tidak valid",
        headers={"WWW-Authenticate": "Bearer"}
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    with engine.connect() as conn:
        user = conn.execute(
            text("""
                SELECT id::text AS id, email, password_hash, role
                FROM users
                WHERE LOWER(email) = :email
            """),
            {"email": payload.email.strip().lower()}
        ).mappings().first()

    stored_hash = user["password_hash"] if user else DUMMY_HASH

    if not hasher.verify(payload.password, stored_hash) or user is None:
        raise unauthorized()

    if user["role"] not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Peran akun tidak diizinkan"
        )

    now = datetime.now(timezone.utc)

    token = jwt.encode(
        {
            "sub": user["id"],
            "iss": ISSUER,
            "iat": now,
            "exp": now + timedelta(minutes=TOKEN_MINUTES),
        },
        get_jwt_secret(),
        algorithm=ALGORITHM,
    )

    return TokenResponse(access_token=token)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
):
    if credentials is None:
        raise unauthorized()

    try:
        payload = jwt.decode(
            credentials.credentials,
            get_jwt_secret(),
            algorithms=[ALGORITHM],
            issuer=ISSUER,
            options={"require": ["sub", "exp", "iat", "iss"]},
        )
        user_id = str(UUID(payload["sub"]))
    except (InvalidTokenError, ValueError, KeyError, TypeError):
        raise unauthorized()

    with engine.connect() as conn:
        user = conn.execute(
            text("""
                SELECT id::text AS id, email, role
                FROM users
                WHERE id = CAST(:user_id AS UUID)
            """),
            {"user_id": user_id}
        ).mappings().first()

    if user is None or user["role"] not in ALLOWED_ROLES:
        raise unauthorized()

    return dict(user)


def require_roles(*allowed_roles):
    def check_access(user=Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Tidak memiliki izin akses"
            )
        return user

    return check_access


@router.get("/me")
def my_profile(user=Depends(get_current_user)):
    return user
