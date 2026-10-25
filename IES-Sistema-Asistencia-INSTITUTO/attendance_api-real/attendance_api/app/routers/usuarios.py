from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import hash_password, verificar_password
from ..auth_session import crear_sesion_administrativa, cerrar_sesion_administrativa, obtener_sesion

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


def _normalizar_usuario(valor: str) -> str:
    return valor.strip().lower()


@router.post("/", response_model=schemas.UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario(usuario: schemas.UsuarioCreate, request: Request, db: Session = Depends(get_db)):
    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    if usuario.tipo_empleado == models.TipoEmpleado.admin and (not sesion or sesion.get("rol") != "superadmin"):
        raise HTTPException(status_code=403, detail="Solo un usuario con administrador principal puede crear cuentas administrativas.")

    nombre_usuario = _normalizar_usuario(usuario.usuario)
    if not nombre_usuario or " " in nombre_usuario:
        raise HTTPException(status_code=400, detail="El usuario no puede estar vacío ni contener espacios")

    existente = db.query(models.Usuario).filter(models.Usuario.usuario == nombre_usuario).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese nombre de usuario")

    if usuario.tipo_empleado == models.TipoEmpleado.admin:
        if usuario.rol_acceso not in {"superadmin", "lector", "editor"}:
            raise HTTPException(status_code=400, detail="Rol de acceso inválido")
        cantidad_admins = db.query(models.Usuario).filter(
            models.Usuario.tipo_empleado == models.TipoEmpleado.admin,
            models.Usuario.activo.is_(True),
        ).count()
        if cantidad_admins >= 3:
            raise HTTPException(status_code=400, detail="Solo se permiten hasta 3 administradores activos.")

    nuevo_usuario = models.Usuario(
        nombre=usuario.nombre.strip(),
        apellido=usuario.apellido.strip(),
        usuario=nombre_usuario,
        contrasenia=hash_password(usuario.contrasenia),
        tipo_empleado=usuario.tipo_empleado,
        activo=True,
        rol_acceso=usuario.rol_acceso if usuario.tipo_empleado == models.TipoEmpleado.admin else "personal",
    )
    db.add(nuevo_usuario)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese nombre de usuario")
    db.refresh(nuevo_usuario)
    return nuevo_usuario


@router.get("/", response_model=List[schemas.UsuarioOut])
def listar_usuarios(
    tipo_empleado: models.TipoEmpleado | None = None,
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(models.Usuario)
    if not incluir_inactivos:
        query = query.filter(models.Usuario.activo.is_(True))
    if tipo_empleado is not None:
        query = query.filter(models.Usuario.tipo_empleado == tipo_empleado)
    return query.order_by(models.Usuario.apellido, models.Usuario.nombre).all()


@router.post("/login")
def login(datos: schemas.LoginRequest, db: Session = Depends(get_db)):
    nombre_usuario = _normalizar_usuario(datos.usuario)
    usuario_encontrado = (
        db.query(models.Usuario)
        .filter(models.Usuario.usuario == nombre_usuario, models.Usuario.activo.is_(True))
        .first()
    )

    if not usuario_encontrado or not verificar_password(datos.contrasenia, usuario_encontrado.contrasenia):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    rol_sesion = usuario_encontrado.rol_acceso if usuario_encontrado.tipo_empleado == models.TipoEmpleado.admin else "personal"
    token = crear_sesion_administrativa(usuario_encontrado.id_usuario, usuario_encontrado.usuario, rol_sesion)
    respuesta = {
        "usuario": {
            "id": usuario_encontrado.id_usuario,
            "usuario": usuario_encontrado.usuario,
            "nombre": f"{usuario_encontrado.nombre} {usuario_encontrado.apellido}",
            "rol": usuario_encontrado.tipo_empleado.value,
            "rol_acceso": usuario_encontrado.rol_acceso if usuario_encontrado.tipo_empleado == models.TipoEmpleado.admin else "personal",
        }
    }
    if token:
        respuesta["token"] = token
    return respuesta


@router.get("/{id_usuario}", response_model=schemas.UsuarioOut)
def obtener_usuario(id_usuario: int, db: Session = Depends(get_db)):
    usuario = (
        db.query(models.Usuario)
        .filter(models.Usuario.id_usuario == id_usuario, models.Usuario.activo.is_(True))
        .first()
    )
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


@router.put("/{id_usuario}", response_model=schemas.UsuarioOut)
def actualizar_usuario(id_usuario: int, datos: schemas.UsuarioUpdate, request: Request, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario, models.Usuario.activo.is_(True)).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    rol_sesion = sesion.get("rol") if sesion else None
    if usuario.tipo_empleado == models.TipoEmpleado.admin and rol_sesion != "superadmin":
        raise HTTPException(status_code=403, detail="Solo un usuario con administrador principal puede modificar cuentas administrativas.")

    valores = datos.model_dump(exclude_unset=True)
    if valores.get("tipo_empleado") == models.TipoEmpleado.admin and usuario.tipo_empleado != models.TipoEmpleado.admin and rol_sesion != "superadmin":
        raise HTTPException(status_code=403, detail="Solo un usuario con administrador principal puede crear o convertir cuentas administrativas.")
    if "rol_acceso" in valores and valores["rol_acceso"] not in {"superadmin", "lector", "editor"}:
        raise HTTPException(status_code=400, detail="Rol de acceso inválido")
    if usuario.tipo_empleado == models.TipoEmpleado.admin and usuario.rol_acceso == "superadmin" and valores.get("rol_acceso", "superadmin") != "superadmin":
        otros_superadmins = db.query(models.Usuario).filter(models.Usuario.tipo_empleado == models.TipoEmpleado.admin, models.Usuario.rol_acceso == "superadmin", models.Usuario.activo.is_(True), models.Usuario.id_usuario != id_usuario).count()
        if otros_superadmins == 0:
            raise HTTPException(status_code=400, detail="Debe quedar al menos un usuario con administrador principal.")
    if valores.get("tipo_empleado") == models.TipoEmpleado.admin and usuario.tipo_empleado != models.TipoEmpleado.admin:
        cantidad_admins = db.query(models.Usuario).filter(
            models.Usuario.tipo_empleado == models.TipoEmpleado.admin,
            models.Usuario.activo.is_(True),
            models.Usuario.id_usuario != id_usuario,
        ).count()
        if cantidad_admins >= 3:
            raise HTTPException(status_code=400, detail="Solo se permiten hasta 3 administradores activos.")
    if "usuario" in valores:
        nombre_usuario = _normalizar_usuario(valores["usuario"])
        if not nombre_usuario or " " in nombre_usuario:
            raise HTTPException(status_code=400, detail="El usuario no puede estar vacío ni contener espacios")
        otro = (
            db.query(models.Usuario)
            .filter(models.Usuario.usuario == nombre_usuario, models.Usuario.id_usuario != id_usuario)
            .first()
        )
        if otro:
            raise HTTPException(status_code=400, detail="Ya existe otro usuario con ese nombre de usuario")
        valores["usuario"] = nombre_usuario

    if valores.get("tipo_empleado", usuario.tipo_empleado) != models.TipoEmpleado.admin:
        valores["rol_acceso"] = "personal"
    if "contrasenia" in valores and valores["contrasenia"] is not None:
        valores["contrasenia"] = hash_password(valores["contrasenia"])

    for campo, valor in valores.items():
        if isinstance(valor, str) and campo in {"nombre", "apellido"}:
            valor = valor.strip()
        setattr(usuario, campo, valor)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se pudo actualizar el usuario")
    db.refresh(usuario)
    return usuario


@router.delete("/{id_usuario}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(id_usuario: int, request: Request, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario, models.Usuario.activo.is_(True)).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    if usuario.tipo_empleado == models.TipoEmpleado.admin and (not sesion or sesion.get("rol") != "superadmin"):
        raise HTTPException(status_code=403, detail="Solo un usuario con administrador principal puede desactivar cuentas administrativas.")

    if usuario.tipo_empleado == models.TipoEmpleado.admin:
        if usuario.rol_acceso == "superadmin":
            cantidad_superadmins = db.query(models.Usuario).filter(models.Usuario.tipo_empleado == models.TipoEmpleado.admin, models.Usuario.rol_acceso == "superadmin", models.Usuario.activo.is_(True)).count()
            if cantidad_superadmins <= 1:
                raise HTTPException(status_code=400, detail="Debe quedar al menos un usuario con administrador principal.")
        cantidad_admins = db.query(models.Usuario).filter(
            models.Usuario.tipo_empleado == models.TipoEmpleado.admin,
            models.Usuario.activo.is_(True),
        ).count()
        if cantidad_admins <= 1:
            raise HTTPException(status_code=400, detail="Debe quedar al menos un administrador activo.")

    usuario.activo = False
    db.commit()
    return None


@router.post("/{id_usuario}/reactivar", response_model=schemas.UsuarioOut)
def reactivar_usuario(id_usuario: int, request: Request, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    if usuario.tipo_empleado == models.TipoEmpleado.admin and (not sesion or sesion.get("rol") != "superadmin"):
        raise HTTPException(status_code=403, detail="Solo un usuario con administrador principal puede reactivar cuentas administrativas.")
    if usuario.activo:
        raise HTTPException(status_code=400, detail="El usuario ya está activo")

    if usuario.tipo_empleado == models.TipoEmpleado.admin:
        cantidad_admins = db.query(models.Usuario).filter(
            models.Usuario.tipo_empleado == models.TipoEmpleado.admin,
            models.Usuario.activo.is_(True),
        ).count()
        if cantidad_admins >= 3:
            raise HTTPException(status_code=400, detail="Solo se permiten hasta 3 administradores activos.")

    usuario.activo = True
    db.commit()
    db.refresh(usuario)
    return usuario


@router.post("/logout")
def logout(request: Request):
    cerrar_sesion_administrativa(request.headers.get("X-Admin-Session"))
    return {"mensaje": "Sesión cerrada"}
