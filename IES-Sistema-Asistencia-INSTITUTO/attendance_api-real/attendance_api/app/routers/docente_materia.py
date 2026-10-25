from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/docente-materia", tags=["Docente-Materia"])

HORA_ARGENTINA = timezone(timedelta(hours=-3))
DIAS_SEMANA_ES = {
    0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves", 4: "Viernes", 5: "Sábado", 6: "Domingo"
}


@router.post("/", response_model=schemas.DocenteMateriaOut, status_code=status.HTTP_201_CREATED)
def asignar_materia_a_docente(asignacion: schemas.DocenteMateriaCreate, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == asignacion.id_usuario, models.Usuario.activo.is_(True)).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if usuario.tipo_empleado != models.TipoEmpleado.docente:
        raise HTTPException(status_code=400, detail="Solo se pueden asignar materias a usuarios de tipo 'docente'")

    materia = db.query(models.Materia).filter(models.Materia.id_materia == asignacion.id_materia, models.Materia.activo.is_(True)).first()
    if not materia:
        raise HTTPException(status_code=404, detail="Materia no encontrada")

    existente_inactivo = (
        db.query(models.DocenteMateria)
        .filter(
            models.DocenteMateria.id_usuario == asignacion.id_usuario,
            models.DocenteMateria.id_materia == asignacion.id_materia,
            models.DocenteMateria.dia_semana == asignacion.dia_semana,
            models.DocenteMateria.anio == asignacion.anio,
            models.DocenteMateria.turno == asignacion.turno,
            models.DocenteMateria.activo.is_(False),
        )
        .first()
    )
    if existente_inactivo:
        existente_inactivo.activo = True
        db.commit()
        db.refresh(existente_inactivo)
        return existente_inactivo

    nueva_asignacion = models.DocenteMateria(**asignacion.model_dump(), activo=True)
    db.add(nueva_asignacion)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Esa combinación de docente, materia y día ya está registrada")
    db.refresh(nueva_asignacion)
    return nueva_asignacion


@router.get("/", response_model=List[schemas.DocenteMateriaOut])
def listar_asignaciones(id_usuario: int | None = None, db: Session = Depends(get_db)):
    query = (
        db.query(models.DocenteMateria)
        .join(models.Usuario)
        .join(models.Materia)
        .filter(
            models.Usuario.activo.is_(True),
            models.Materia.activo.is_(True),
            models.DocenteMateria.activo.is_(True),
        )
    )
    if id_usuario is not None:
        query = query.filter(models.DocenteMateria.id_usuario == id_usuario)
    return query.all()


@router.get("/materias-hoy/{id_usuario}", response_model=List[schemas.MateriaDelDiaOut])
def materias_del_dia(id_usuario: int, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario, models.Usuario.activo.is_(True)).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if usuario.tipo_empleado != models.TipoEmpleado.docente:
        raise HTTPException(status_code=400, detail="El usuario indicado no es docente")

    dia_actual = DIAS_SEMANA_ES[datetime.now(HORA_ARGENTINA).weekday()]
    asignaciones = (
        db.query(models.DocenteMateria)
        .join(models.Materia)
        .filter(
            models.DocenteMateria.id_usuario == id_usuario,
            models.DocenteMateria.dia_semana == dia_actual,
            models.DocenteMateria.activo.is_(True),
            models.Materia.activo.is_(True),
        )
        .all()
    )

    return [
        schemas.MateriaDelDiaOut(
            id_docente_materia=a.id_docente_materia,
            id_materia=a.materia.id_materia,
            nombre_materia=a.materia.nombre_materia,
            nombre_carrera=a.materia.carrera.nombre_carrera,
            dia_semana=a.dia_semana,
            anio=a.anio,
            turno=a.turno,
            hora_inicio=a.materia.hora_inicio,
            hora_fin=a.materia.hora_fin,
        )
        for a in asignaciones
    ]


@router.delete("/{id_docente_materia}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_asignacion(id_docente_materia: int, db: Session = Depends(get_db)):
    asignacion = db.query(models.DocenteMateria).filter(models.DocenteMateria.id_docente_materia == id_docente_materia).first()
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    asignacion.activo = False
    db.commit()
    return None
