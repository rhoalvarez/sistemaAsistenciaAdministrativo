from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth_session import obtener_sesion
from .docente_materia import DIAS_SEMANA_ES

HORA_ARGENTINA = timezone(timedelta(hours=-3))


def ahora_argentina():
    return datetime.now(HORA_ARGENTINA).replace(tzinfo=None)


def normalizar_hora_argentina(valor: datetime) -> datetime:
    """Convierte horas con zona horaria a Argentina y deja las horas sin tz.

    SQLite las almacena como DATETIME sin zona; normalizar evita comparar
    datetimes aware con naive y elimina el error 500 al registrar salida.
    """
    if valor.tzinfo is not None:
        return valor.astimezone(HORA_ARGENTINA).replace(tzinfo=None)
    return valor


router = APIRouter(prefix="/asistencias", tags=["Asistencias"])


@router.post("/entrada", response_model=schemas.AsistenciaOut, status_code=status.HTTP_201_CREATED)
def registrar_entrada(datos: schemas.AsistenciaEntradaCreate, request: Request, db: Session = Depends(get_db)):
    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    if sesion and sesion.get("rol") == "personal" and sesion.get("id_usuario") != datos.id_usuario:
        raise HTTPException(status_code=403, detail="Solo podés registrar tu propia asistencia")
    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == datos.id_usuario, models.Usuario.activo.is_(True)).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario.tipo_empleado == models.TipoEmpleado.docente and datos.id_materia is None:
        raise HTTPException(status_code=400, detail="Un docente debe indicar la materia para registrar la asistencia")

    id_materia = None
    if usuario.tipo_empleado == models.TipoEmpleado.docente:
        materia = db.query(models.Materia).filter(models.Materia.id_materia == datos.id_materia, models.Materia.activo.is_(True)).first()
        if not materia:
            raise HTTPException(status_code=404, detail="Materia no encontrada")

        dia_actual = DIAS_SEMANA_ES[ahora_argentina().weekday()]
        asignacion = (
            db.query(models.DocenteMateria)
            .filter(
                models.DocenteMateria.id_usuario == usuario.id_usuario,
                models.DocenteMateria.id_materia == datos.id_materia,
                models.DocenteMateria.dia_semana == dia_actual,
                models.DocenteMateria.activo.is_(True),
            )
            .first()
        )
        if not asignacion:
            raise HTTPException(
                status_code=400,
                detail=f"La materia indicada no está asignada a este docente para el día {dia_actual}",
            )
        id_materia = datos.id_materia

    ahora = ahora_argentina()
    inicio_dia = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    fin_dia = ahora.replace(hour=23, minute=59, second=59, microsecond=999999)

    asistencias_hoy = (
        db.query(models.Asistencia)
        .filter(
            models.Asistencia.id_usuario == datos.id_usuario,
            models.Asistencia.fecha_hora_entrada >= inicio_dia,
            models.Asistencia.fecha_hora_entrada <= fin_dia,
        )
        .all()
    )
    for registro in asistencias_hoy:
        if registro.id_materia == id_materia:
            raise HTTPException(status_code=400, detail="Ya existe una asistencia registrada para hoy para esta materia.")

    entrada_abierta = (
        db.query(models.Asistencia)
        .filter(
            models.Asistencia.id_usuario == datos.id_usuario,
            models.Asistencia.fecha_hora_salida.is_(None),
        )
        .first()
    )
    if entrada_abierta:
        raise HTTPException(status_code=400, detail="El usuario ya tiene una entrada abierta sin salida marcada")

    nueva_asistencia = models.Asistencia(
        id_usuario=datos.id_usuario,
        id_materia=id_materia,
        fecha_hora_entrada=ahora,
        fecha_hora_salida=None,
        tema_dictado=None,
    )
    db.add(nueva_asistencia)
    db.commit()
    db.refresh(nueva_asistencia)
    return nueva_asistencia


@router.put("/salida/{id_asistencia}", response_model=schemas.AsistenciaOut)
def registrar_salida(id_asistencia: int, datos: schemas.AsistenciaSalidaUpdate, request: Request, db: Session = Depends(get_db)):
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.id_asistencia == id_asistencia).first()
    if not asistencia:
        raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")
    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    if sesion and sesion.get("rol") == "personal" and sesion.get("id_usuario") != asistencia.id_usuario:
        raise HTTPException(status_code=403, detail="Solo podés registrar tu propia salida")
    if asistencia.fecha_hora_salida is not None:
        raise HTTPException(status_code=400, detail="Este registro ya tiene una salida marcada")

    salida = normalizar_hora_argentina(datos.fecha_hora_salida) if datos.fecha_hora_salida else ahora_argentina()
    entrada = normalizar_hora_argentina(asistencia.fecha_hora_entrada)

    asistencia.fecha_hora_entrada = entrada
    asistencia.fecha_hora_salida = salida
    if salida < entrada:
        raise HTTPException(status_code=400, detail="La hora de salida no puede ser anterior a la hora de entrada")

    db.commit()
    db.refresh(asistencia)
    return asistencia


@router.put("/tema/{id_asistencia}", response_model=schemas.AsistenciaOut)
def cargar_tema_dictado(id_asistencia: int, datos: schemas.AsistenciaTemaUpdate, request: Request, db: Session = Depends(get_db)):
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.id_asistencia == id_asistencia).first()
    if not asistencia:
        raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")
    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    if sesion and sesion.get("rol") == "personal" and sesion.get("id_usuario") != asistencia.id_usuario:
        raise HTTPException(status_code=403, detail="Solo podés modificar tu propio registro")

    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == asistencia.id_usuario, models.Usuario.activo.is_(True)).first()
    if not usuario or usuario.tipo_empleado != models.TipoEmpleado.docente:
        raise HTTPException(status_code=400, detail="Solo los docentes pueden cargar tema dictado")

    materia = db.query(models.Materia).filter(models.Materia.id_materia == datos.id_materia, models.Materia.activo.is_(True)).first()
    if not materia:
        raise HTTPException(status_code=404, detail="Materia no encontrada")

    asignacion_valida = (
        db.query(models.DocenteMateria)
        .filter(
            models.DocenteMateria.id_usuario == usuario.id_usuario,
            models.DocenteMateria.id_materia == datos.id_materia,
            models.DocenteMateria.dia_semana == DIAS_SEMANA_ES[ahora_argentina().weekday()],
            models.DocenteMateria.activo.is_(True),
        )
        .first()
    )
    if not asignacion_valida:
        raise HTTPException(status_code=400, detail="La materia indicada no está asignada a este docente para el día actual")

    asistencia.id_materia = datos.id_materia
    asistencia.tema_dictado = datos.tema_dictado.strip()
    db.commit()
    db.refresh(asistencia)
    return asistencia


@router.get("/", response_model=List[schemas.AsistenciaOut])
def listar_asistencias(request: Request, id_usuario: Optional[int] = None, db: Session = Depends(get_db)):
    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    if sesion and sesion.get("rol") == "personal":
        if id_usuario is not None and id_usuario != sesion.get("id_usuario"):
            raise HTTPException(status_code=403, detail="Solo podés consultar tus propias asistencias")
        id_usuario = sesion.get("id_usuario")
    query = db.query(models.Asistencia)
    if id_usuario is not None:
        query = query.filter(models.Asistencia.id_usuario == id_usuario)
    return query.order_by(models.Asistencia.fecha_hora_entrada.desc()).all()


@router.get("/{id_asistencia}", response_model=schemas.AsistenciaOut)
def obtener_asistencia(id_asistencia: int, request: Request, db: Session = Depends(get_db)):
    asistencia = db.query(models.Asistencia).filter(models.Asistencia.id_asistencia == id_asistencia).first()
    if not asistencia:
        raise HTTPException(status_code=404, detail="Registro de asistencia no encontrado")
    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    if sesion and sesion.get("rol") == "personal" and sesion.get("id_usuario") != asistencia.id_usuario:
        raise HTTPException(status_code=403, detail="Solo podés consultar tu propio registro")
    return asistencia
