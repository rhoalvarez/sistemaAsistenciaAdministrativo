from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/feriados", tags=["Feriados"])


@router.get("/", response_model=List[schemas.FeriadoOut])
def listar_feriados(
    desde: str | None = None,
    hasta: str | None = None,
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(models.Feriado)
    if not incluir_inactivos:
        query = query.filter(models.Feriado.activo.is_(True))
    if desde:
        query = query.filter(models.Feriado.fecha >= desde)
    if hasta:
        query = query.filter(models.Feriado.fecha <= hasta)
    return query.order_by(models.Feriado.fecha).all()


@router.post("/", response_model=schemas.FeriadoOut, status_code=status.HTTP_201_CREATED)
def crear_feriado(datos: schemas.FeriadoCreate, db: Session = Depends(get_db)):
    existente = db.query(models.Feriado).filter(models.Feriado.fecha == datos.fecha).first()
    if existente:
        if not existente.activo:
            existente.activo = True
            existente.nombre = datos.nombre
            existente.tipo = datos.tipo
            existente.jurisdiccion = datos.jurisdiccion
            db.commit(); db.refresh(existente); return existente
        raise HTTPException(status_code=400, detail="Ya existe un feriado registrado para esa fecha")
    feriado = models.Feriado(**datos.model_dump(), activo=True)
    db.add(feriado)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe un feriado registrado para esa fecha")
    db.refresh(feriado)
    return feriado


@router.put("/{id_feriado}", response_model=schemas.FeriadoOut)
def editar_feriado(id_feriado: int, datos: schemas.FeriadoCreate, db: Session = Depends(get_db)):
    feriado = db.query(models.Feriado).filter(models.Feriado.id_feriado == id_feriado).first()
    if not feriado:
        raise HTTPException(status_code=404, detail="Feriado no encontrado")
    otro = db.query(models.Feriado).filter(models.Feriado.fecha == datos.fecha, models.Feriado.id_feriado != id_feriado).first()
    if otro:
        raise HTTPException(status_code=400, detail="Ya existe otro feriado para esa fecha")
    for campo, valor in datos.model_dump().items():
        setattr(feriado, campo, valor)
    feriado.activo = True
    db.commit(); db.refresh(feriado)
    return feriado


@router.delete("/{id_feriado}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_feriado(id_feriado: int, db: Session = Depends(get_db)):
    feriado = db.query(models.Feriado).filter(models.Feriado.id_feriado == id_feriado, models.Feriado.activo.is_(True)).first()
    if not feriado:
        raise HTTPException(status_code=404, detail="Feriado no encontrado")
    feriado.activo = False
    db.commit()
