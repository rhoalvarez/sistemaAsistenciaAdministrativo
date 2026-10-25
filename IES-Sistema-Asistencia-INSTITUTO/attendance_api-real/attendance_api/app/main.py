from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .auth_session import sesion_administrativa_valida, obtener_sesion

from .database import Base, engine, migrar_base_local, asegurar_admin_inicial
from . import models
from .routers import usuarios, materias, docente_materia, asistencias, carreras, feriados, licencias

# Primero adapta la base existente y después crea las estructuras que falten.
migrar_base_local()
Base.metadata.create_all(bind=engine)
asegurar_admin_inicial()

app = FastAPI(
    title="API de Asistencia - Instituto Educativo",
    description="Sistema de fichaje y control de asistencia para personal docente y no docente.",
    version="2.0.0",
)

CORS_CONFIG = {
    # Orígenes locales explícitos para las dos aplicaciones Vite.
    "allow_origins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    "allow_origin_regex": r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$",
    "allow_credentials": False,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "X-Admin-Session", "Authorization"],
}

app.include_router(usuarios.router)
app.include_router(carreras.router)
app.include_router(materias.router)
app.include_router(docente_materia.router)
app.include_router(asistencias.router)
app.include_router(feriados.router)
app.include_router(licencias.router)

@app.middleware("http")
async def seguridad_de_sesion(request: Request, call_next):
    ruta = request.url.path
    metodo = request.method.upper()
    # Las solicitudes preflight CORS no llevan la sesión; deben pasar sin autenticación.
    if metodo == "OPTIONS":
        return await call_next(request)

    token = request.headers.get("X-Admin-Session")
    sesion = obtener_sesion(token)
    es_login = ruta == "/usuarios/login" and metodo == "POST"
    es_logout = ruta == "/usuarios/logout" and metodo == "POST"
    # La administración y el fichaje exigen sesión incluso para lecturas; el personal
    # solo accede a su propio perfil, materias asignadas y asistencias propias.
    prefijos_admin = ("/usuarios", "/materias", "/carreras", "/docente-materia", "/feriados", "/licencias", "/asistencias")
    es_ruta_admin = ruta.startswith(prefijos_admin) and not es_login and not es_logout
    es_materias_hoy_personal = ruta.startswith("/docente-materia/materias-hoy/") and metodo == "GET"
    if es_ruta_admin and not sesion:
        return JSONResponse(status_code=401, content={"detail": "Iniciá sesión para acceder a la administración."})
    if es_ruta_admin and sesion:
        rol = sesion.get("rol", "superadmin")
        # El personal solo puede consultar su propio perfil y registrar asistencia;
        # nunca acceder a administración, usuarios ajenos ni catálogos administrativos.
        if rol == "personal":
            es_perfil_propio = ruta.startswith("/usuarios/") and ruta.split("/")[-1].isdigit() and int(ruta.split("/")[-1]) == sesion.get("id_usuario") and metodo == "GET"
            es_fichaje = ruta.startswith("/asistencias/") and metodo in {"POST", "PUT"}
            es_consulta_asistencia = ruta.startswith("/asistencias") and metodo == "GET"
            es_materias_propias = es_materias_hoy_personal and ruta.split("/")[-1].isdigit() and int(ruta.split("/")[-1]) == sesion.get("id_usuario")
            if not (es_perfil_propio or es_fichaje or es_consulta_asistencia or es_materias_propias):
                return JSONResponse(status_code=403, content={"detail": "Tu usuario no tiene permisos para acceder a esta sección."})
        if rol not in {"personal", "superadmin", "editor", "lector"}:
            return JSONResponse(status_code=403, content={"detail": "Rol de acceso no reconocido."})
        if rol == "lector" and metodo in {"POST", "PUT", "PATCH", "DELETE"}:
            return JSONResponse(status_code=403, content={"detail": "Tu perfil tiene permisos de solo lectura."})
        if rol == "editor" and metodo == "DELETE":
            return JSONResponse(status_code=403, content={"detail": "Tu perfil puede editar, pero no eliminar."})
    return await call_next(request)

@app.get("/", tags=["Root"])
def root():
    return {"mensaje": "API de Asistencia funcionando correctamente"}


# Envolver la aplicación completa garantiza encabezados CORS incluso en respuestas
# 401/403 y errores producidos por middleware, no solo en respuestas exitosas.
app = CORSMiddleware(app=app, **CORS_CONFIG)
