from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/carreras", tags=["Carreras"])


@router.post("/", response_model=schemas.CarreraOut, status_code=status.HTTP_201_CREATED)
def crear_carrera(carrera: schemas.CarreraCreate, db: Session = Depends(get_db)):
    nombre = carrera.nombre_carrera.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre de la carrera es obligatorio")

    existente = db.query(models.Carrera).filter(models.Carrera.nombre_carrera == nombre).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una carrera con ese nombre")

    nueva = models.Carrera(nombre_carrera=nombre, activo=True)
    db.add(nueva)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una carrera con ese nombre")
    db.refresh(nueva)
    return nueva


@router.get("/", response_model=List[schemas.CarreraOut])
def listar_carreras(db: Session = Depends(get_db)):
    return (
        db.query(models.Carrera)
        .filter(models.Carrera.activo.is_(True))
        .order_by(models.Carrera.nombre_carrera)
        .all()
    )


@router.get("/{id_carrera}", response_model=schemas.CarreraOut)
def obtener_carrera(id_carrera: int, db: Session = Depends(get_db)):
    carrera = db.query(models.Carrera).filter(models.Carrera.id_carrera == id_carrera, models.Carrera.activo.is_(True)).first()
    if not carrera:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")
    return carrera


@router.delete("/{id_carrera}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_carrera(id_carrera: int, db: Session = Depends(get_db)):
    carrera = db.query(models.Carrera).filter(models.Carrera.id_carrera == id_carrera, models.Carrera.activo.is_(True)).first()
    if not carrera:
        raise HTTPException(status_code=404, detail="Carrera no encontrada")

    materias_activas = db.query(models.Materia).filter(models.Materia.id_carrera == id_carrera, models.Materia.activo.is_(True)).count()
    if materias_activas:
        raise HTTPException(status_code=400, detail="No se puede eliminar una carrera que tiene materias activas")

    carrera.activo = False
    db.commit()
    return None
