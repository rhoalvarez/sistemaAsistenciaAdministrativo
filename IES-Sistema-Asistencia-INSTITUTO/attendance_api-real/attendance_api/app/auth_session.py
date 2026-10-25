"""Sesiones administrativas en memoria con permisos explícitos."""
import secrets
from datetime import datetime, timedelta, timezone

ADMIN_SESSIONS: dict[str, dict] = {}
SESSION_TTL = timedelta(hours=8)

def crear_sesion_administrativa(id_usuario: int, usuario: str, rol: str) -> str:
    token = secrets.token_urlsafe(48)
    ADMIN_SESSIONS[token] = {"id_usuario": id_usuario, "usuario": usuario, "rol": rol, "creada": datetime.now(timezone.utc)}
    return token

def obtener_sesion(token: str | None) -> dict | None:
    if not token:
        return None
    sesion = ADMIN_SESSIONS.get(token)
    if not sesion:
        return None
    if datetime.now(timezone.utc) - sesion["creada"] > SESSION_TTL:
        ADMIN_SESSIONS.pop(token, None)
        return None
    return sesion

def sesion_administrativa_valida(token: str | None) -> bool:
    return obtener_sesion(token) is not None

def cerrar_sesion_administrativa(token: str | None) -> None:
    if token:
        ADMIN_SESSIONS.pop(token, None)
