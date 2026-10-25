from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth_session import obtener_sesion

router = APIRouter(prefix="/licencias", tags=["Inasistencias"] )

HORA_ARGENTINA = timezone(timedelta(hours=-3))

DIAS_SEMANA_ES = {
    0: "Lunes",
    1: "Martes",
    2: "Miércoles",
    3: "Jueves",
    4: "Viernes",
    5: "Sábado",
    6: "Domingo",
}


def _respuesta(licencia: models.Licencia) -> dict:
    return {
        "id_licencia": licencia.id_licencia,
        "id_usuario": licencia.id_usuario,
        "nombre_docente": f"{licencia.usuario.nombre} {licencia.usuario.apellido}",
        "id_materia": licencia.id_materia,
        "id_docente_materia": licencia.id_docente_materia,
        "nombre_materia": licencia.materia.nombre_materia,
        "nombre_carrera": licencia.materia.carrera.nombre_carrera,
        "fecha": licencia.fecha,
        "dia_semana": licencia.dia_semana,
        "anio": licencia.anio,
        "turno": licencia.turno,
        "observacion": licencia.observacion,
        "motivo_inasistencia": getattr(licencia, "motivo_inasistencia", "Otro"),
        "registrado_por": getattr(licencia, "registrado_por", None),
        "fecha_registro": licencia.fecha_registro,
    }


@router.get("/", response_model=List[schemas.LicenciaOut])
def listar_licencias(
    id_usuario: int | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    db: Session = Depends(get_db),
):
    # Licencia tiene dos FK hacia usuarios: id_usuario (docente) y
    # registrado_por (administrador que cargó la inasistencia). El join
    # implícito es ambiguo en SQLAlchemy; especificamos la relación correcta.
    query = (
        db.query(models.Licencia)
        .join(models.Usuario, models.Licencia.id_usuario == models.Usuario.id_usuario)
        .join(models.Materia, models.Licencia.id_materia == models.Materia.id_materia)
        .order_by(models.Licencia.fecha.desc(), models.Licencia.id_licencia.desc())
    )
    if id_usuario is not None:
        query = query.filter(models.Licencia.id_usuario == id_usuario)
    if desde:
        query = query.filter(models.Licencia.fecha >= desde)
    if hasta:
        query = query.filter(models.Licencia.fecha <= hasta)
    return [_respuesta(item) for item in query.all()]


@router.get("/pendientes")
def listar_inasistencias_pendientes(
    fecha: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    db: Session = Depends(get_db),
):
    """Lista inasistencias sin registrar.

    Sin parámetros conserva el control del día actual para el panel general.
    Con desde/hasta devuelve todos los días del período, incluidos sábados y
    domingos: solo genera pendientes cuando existe una asignación activa para
    ese día de la semana. La fecha viene determinada por la asignación y no se
    modifica desde la interfaz.
    """
    try:
        if desde or hasta:
            if not (desde and hasta):
                raise HTTPException(status_code=400, detail="Indicá ambas fechas del período.")
            inicio = datetime.strptime(desde, "%Y-%m-%d").date()
            fin = datetime.strptime(hasta, "%Y-%m-%d").date()
            if fin < inicio:
                raise HTTPException(status_code=400, detail="La fecha hasta no puede ser anterior a desde.")
            if (fin - inicio).days > 31:
                raise HTTPException(status_code=400, detail="El período no puede superar 32 días.")
            fechas = [inicio + timedelta(days=i) for i in range((fin - inicio).days + 1)]
        else:
            fecha_obj = datetime.strptime(fecha, "%Y-%m-%d").date() if fecha else datetime.now(HORA_ARGENTINA).date()
            fechas = [fecha_obj]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Fecha inválida. Usá el formato AAAA-MM-DD.") from exc

    pendientes = []
    feriados = []
    for fecha_obj in fechas:
        fecha_iso = fecha_obj.isoformat()
        dia_semana = DIAS_SEMANA_ES[fecha_obj.weekday()]

        # En consulta de un solo día se conserva la regla histórica de no
        # presentar el sábado/domingo como pendientes si no hay jornada asignada.
        feriado = (
            db.query(models.Feriado)
            .filter(models.Feriado.fecha == fecha_iso, models.Feriado.activo.is_(True))
            .first()
        )
        if feriado:
            feriados.append({"fecha": fecha_iso, "nombre": feriado.nombre, "tipo": feriado.tipo, "jurisdiccion": feriado.jurisdiccion})
            continue

        asignaciones = (
            db.query(models.DocenteMateria)
            .join(models.Usuario)
            .join(models.Materia)
            .filter(
                models.DocenteMateria.dia_semana == dia_semana,
                models.DocenteMateria.activo.is_(True),
                models.Usuario.activo.is_(True),
                models.Usuario.tipo_empleado == models.TipoEmpleado.docente,
                models.Materia.activo.is_(True),
            )
            .order_by(models.Usuario.apellido, models.Usuario.nombre, models.Materia.nombre_materia)
            .all()
        )

        for asignacion in asignaciones:
            inicio_dia = datetime.combine(fecha_obj, datetime.min.time())
            asistencia = (
                db.query(models.Asistencia)
                .filter(
                    models.Asistencia.id_usuario == asignacion.id_usuario,
                    models.Asistencia.id_materia == asignacion.id_materia,
                    models.Asistencia.fecha_hora_entrada >= inicio_dia,
                    models.Asistencia.fecha_hora_entrada < inicio_dia + timedelta(days=1),
                )
                .first()
            )
            if asistencia:
                continue

            licencia = (
                db.query(models.Licencia)
                .filter(
                    models.Licencia.id_usuario == asignacion.id_usuario,
                    models.Licencia.id_docente_materia == asignacion.id_docente_materia,
                    models.Licencia.fecha == fecha_iso,
                )
                .first()
            )
            if licencia:
                continue

            pendientes.append({
                "id_usuario": asignacion.id_usuario,
                "id_docente_materia": asignacion.id_docente_materia,
                "nombre_docente": f"{asignacion.usuario.nombre} {asignacion.usuario.apellido}",
                "id_materia": asignacion.id_materia,
                "nombre_materia": asignacion.materia.nombre_materia,
                "nombre_carrera": asignacion.materia.carrera.nombre_carrera,
                "fecha": fecha_iso,
                "dia_semana": dia_semana,
                "anio": asignacion.anio,
                "turno": asignacion.turno,
            })

    pendientes.sort(key=lambda item: (item["fecha"], item["nombre_docente"].casefold(), item["nombre_materia"].casefold()))
    if desde or hasta:
        return {
            "desde": fechas[0].isoformat(),
            "hasta": fechas[-1].isoformat(),
            "pendientes": pendientes,
            "feriados": feriados,
        }

    fecha_obj = fechas[0]
    dia_semana = DIAS_SEMANA_ES[fecha_obj.weekday()]
    feriado_hoy = next((item for item in feriados if item["fecha"] == fecha_obj.isoformat()), None)
    return {
        "fecha": fecha_obj.isoformat(),
        "dia_semana": dia_semana,
        "feriado": ({"nombre": feriado_hoy["nombre"], "tipo": feriado_hoy["tipo"], "jurisdiccion": feriado_hoy["jurisdiccion"]} if feriado_hoy else None),
        "pendientes": pendientes,
    }


@router.post("/", response_model=schemas.LicenciaOut, status_code=status.HTTP_201_CREATED)
def crear_licencia(datos: schemas.LicenciaCreate, request: Request, db: Session = Depends(get_db)):
    docente = (
        db.query(models.Usuario)
        .filter(
            models.Usuario.id_usuario == datos.id_usuario,
            models.Usuario.tipo_empleado == models.TipoEmpleado.docente,
            models.Usuario.activo.is_(True),
        )
        .first()
    )
    if not docente:
        raise HTTPException(status_code=404, detail="Docente no encontrado o inactivo")

    asignacion = (
        db.query(models.DocenteMateria)
        .filter(
            models.DocenteMateria.id_docente_materia == datos.id_docente_materia,
            models.DocenteMateria.id_usuario == datos.id_usuario,
            models.DocenteMateria.activo.is_(True),
        )
        .first()
    )
    if not asignacion:
        raise HTTPException(status_code=404, detail="La asignación docente-materia no existe o está inactiva")

    materia = db.query(models.Materia).filter(
        models.Materia.id_materia == asignacion.id_materia,
        models.Materia.activo.is_(True),
    ).first()
    if not materia:
        raise HTTPException(status_code=404, detail="Materia no encontrada o inactiva")

    try:
        fecha_obj = datetime.strptime(datos.fecha, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Fecha inválida") from exc

    dia_semana = DIAS_SEMANA_ES[fecha_obj.weekday()]
    if asignacion.dia_semana != dia_semana:
        raise HTTPException(
            status_code=400,
            detail="La fecha seleccionada no corresponde al día de la asignación.",
        )

    existente = db.query(models.Licencia).filter(
        models.Licencia.id_usuario == datos.id_usuario,
        models.Licencia.id_docente_materia == asignacion.id_docente_materia,
        models.Licencia.fecha == datos.fecha,
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una inasistencia registrada para ese docente, materia y fecha.")

    sesion = obtener_sesion(request.headers.get("X-Admin-Session"))
    licencia = models.Licencia(
        id_usuario=datos.id_usuario,
        id_materia=asignacion.id_materia,
        id_docente_materia=asignacion.id_docente_materia,
        fecha=datos.fecha,
        dia_semana=dia_semana,
        anio=asignacion.anio or 0,
        turno=asignacion.turno or "No informado",
        observacion=datos.observacion.strip(),
        motivo_inasistencia=datos.motivo_inasistencia,
        registrado_por=sesion.get("id_usuario") if sesion else None,
        fecha_registro=datetime.now(HORA_ARGENTINA).replace(tzinfo=None),
    )
    db.add(licencia)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una inasistencia para esa combinación.")
    db.refresh(licencia)
    return _respuesta(licencia)
