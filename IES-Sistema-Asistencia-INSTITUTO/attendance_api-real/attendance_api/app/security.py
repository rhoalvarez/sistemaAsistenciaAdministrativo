"""Funciones de seguridad para almacenar y verificar contraseñas."""

import hashlib
import os

_ITERACIONES = 310_000
_ALGORITMO = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _ITERACIONES
    )
    return f"{_ALGORITMO}${_ITERACIONES}${salt.hex()}${digest.hex()}"


def verificar_password(password: str, almacenada: str) -> bool:
    if not almacenada or not almacenada.startswith(f"{_ALGORITMO}$"):
        return False

    try:
        _, iteraciones, salt_hex, digest_hex = almacenada.split("$", 3)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iteraciones),
        )
        return digest.hex() == digest_hex
    except (ValueError, TypeError):
        return False
