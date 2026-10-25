from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/materias", tags=["Materias"])


@router.post("/", response_model=schemas.MateriaOut, status_code=status.HTTP_201_CREATED)
def crear_materia(materia: schemas.MateriaCreate, db: Session = Depends(get_db)):
    id_carrera = materia.id_carrera
    if id_carrera is None:
        raise HTTPException(status_code=400, detail="Seleccioná una carrera para la materia")
    carrera = db.query(models.Carrera).filter(models.Carrera.id_carrera == id_carrera, models.Carrera.activo.is_(True)).first()
    if not carrera:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")

    nombre = materia.nombre_materia.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre de la materia es obligatorio")

    existente = (
        db.query(models.Materia)
        .filter(models.Materia.nombre_materia == nombre, models.Materia.id_carrera == id_carrera)
        .first()
    )
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una materia con ese nombre en esa carrera")

    nueva_materia = models.Materia(nombre_materia=nombre, id_carrera=id_carrera, hora_inicio=materia.hora_inicio, hora_fin=materia.hora_fin, activo=True)
    db.add(nueva_materia)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una materia con ese nombre en esa carrera")
    db.refresh(nueva_materia)
    return nueva_materia


@router.get("/", response_model=List[schemas.MateriaOut])
def listar_materias(
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(models.Materia)
    if not incluir_inactivos:
        query = query.filter(models.Materia.activo.is_(True))
    return (
        query
        .order_by(models.Materia.nombre_materia)
        .all()
    )


@router.get("/{id_materia}", response_model=schemas.MateriaOut)
def obtener_materia(id_materia: int, db: Session = Depends(get_db)):
    materia = db.query(models.Materia).filter(models.Materia.id_materia == id_materia, models.Materia.activo.is_(True)).first()
    if not materia:
        raise HTTPException(status_code=404, detail="Materia no encontrada")
    return materia


@router.put("/{id_materia}", response_model=schemas.MateriaOut)
def actualizar_materia(id_materia: int, datos: schemas.MateriaCreate, db: Session = Depends(get_db)):
    materia = db.query(models.Materia).filter(models.Materia.id_materia == id_materia, models.Materia.activo.is_(True)).first()
    if not materia:
        raise HTTPException(status_code=404, detail="Materia no encontrada")
    carrera_id = datos.id_carrera or materia.id_carrera
    carrera = db.query(models.Carrera).filter(models.Carrera.id_carrera == carrera_id, models.Carrera.activo.is_(True)).first()
    if not carrera:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    nombre = datos.nombre_materia.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre de la materia es obligatorio")
    duplicada = db.query(models.Materia).filter(models.Materia.nombre_materia == nombre, models.Materia.id_carrera == carrera_id, models.Materia.id_materia != id_materia).first()
    if duplicada:
        raise HTTPException(status_code=400, detail="Ya existe una materia con ese nombre en esa carrera")
    materia.nombre_materia = nombre
    materia.id_carrera = carrera_id
    materia.hora_inicio = datos.hora_inicio or None
    materia.hora_fin = datos.hora_fin or None
    db.commit(); db.refresh(materia)
    return materia


@router.delete("/{id_materia}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_materia(id_materia: int, db: Session = Depends(get_db)):
    materia = db.query(models.Materia).filter(models.Materia.id_materia == id_materia, models.Materia.activo.is_(True)).first()
    if not materia:
        raise HTTPException(status_code=404, detail="Materia no encontrada")

    materia.activo = False
    db.commit()
    return None
