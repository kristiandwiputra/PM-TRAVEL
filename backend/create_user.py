
from getpass import getpass

from pwdlib import PasswordHash
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import engine


password_hasher = PasswordHash.recommended()

ALLOWED_ROLES = {"operator", "admin"}


def create_user():
    print("=== Tambah Akun PM-TRAVEL ===")

    full_name = input("Nama lengkap: ").strip()
    email = input("Email: ").strip().lower()
    role = input("Role (operator/admin): ").strip().lower()

    if not full_name or not email or "@" not in email:
        print("Nama atau email tidak valid.")
        return

    if role not in ALLOWED_ROLES:
        print("Role harus operator atau admin.")
        return

    password = getpass("Password: ")
    confirm = getpass("Konfirmasi password: ")

    if len(password) < 12:
        print("Password minimal 12 karakter.")
        return

    if password != confirm:
        print("Konfirmasi password tidak cocok.")
        return

    hashed_password = password_hasher.hash(password)

    try:
        with engine.begin() as conn:
            user_id = conn.execute(
                text("""
                    INSERT INTO users (
                        full_name,
                        email,
                        password_hash,
                        role
                    )
                    VALUES (
                        :full_name,
                        :email,
                        :password_hash,
                        :role
                    )
                    RETURNING id
                """),
                {
                    "full_name": full_name,
                    "email": email,
                    "password_hash": hashed_password,
                    "role": role,
                }
            ).scalar_one()

        print("\nAkun berhasil dibuat.")
        print(f"User ID: {user_id}")
        print(f"Email: {email}")
        print(f"Role: {role}")

    except IntegrityError:
        print("Email sudah terdaftar.")


if __name__ == "__main__":
    create_user()
