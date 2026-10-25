"""Modelos ORM del sistema de asistencia."""

import enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Enum as SqlEnum,
    UniqueConstraint,
    Boolean,
)
from sqlalchemy.orm import relationship

from .database import Base


class TipoEmpleado(str, enum.Enum):
    docente = "docente"
    no_docente = "no_docente"
    admin = "admin"


class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    usuario = Column(String(50), nullable=True, unique=True)
    contrasenia = Column(String(255), nullable=True)
    tipo_empleado = Column(SqlEnum(TipoEmpleado), nullable=False)
    activo = Column(Boolean, nullable=False, default=True, server_default="1")
    rol_acceso = Column(String(20), nullable=False, default="superadmin", server_default="superadmin")

    # No se usa delete-orphan: el borrado de un usuario es lógico y el
    # historial de asignaciones/asistencias debe permanecer.
    materias_asignadas = relationship("DocenteMateria", back_populates="usuario")
    asistencias = relationship("Asistencia", back_populates="usuario")


class Carrera(Base):
    __tablename__ = "carreras"

    id_carrera = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre_carrera = Column(String(150), nullable=False, unique=True)
    activo = Column(Boolean, nullable=False, default=True, server_default="1")

    materias = relationship("Materia", back_populates="carrera")


class Materia(Base):
    __tablename__ = "materias"

    id_materia = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre_materia = Column(String(150), nullable=False)
    id_carrera = Column(Integer, ForeignKey("carreras.id_carrera"), nullable=False)
    hora_inicio = Column(String(5), nullable=True)
    hora_fin = Column(String(5), nullable=True)
    activo = Column(Boolean, nullable=False, default=True, server_default="1")

    carrera = relationship("Carrera", back_populates="materias")
    docentes_asignados = relationship("DocenteMateria", back_populates="materia")
    asistencias = relationship("Asistencia", back_populates="materia")

    __table_args__ = (
        UniqueConstraint("nombre_materia", "id_carrera", name="uq_materia_carrera"),
    )


class DocenteMateria(Base):
    __tablename__ = "docente_materia"
    __table_args__ = (
        UniqueConstraint(
            "id_usuario", "id_materia", "dia_semana", "anio", "turno", name="uq_docente_materia_dia_anio_turno"
        ),
    )

    id_docente_materia = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    id_materia = Column(Integer, ForeignKey("materias.id_materia"), nullable=False)
    dia_semana = Column(String(20), nullable=False)
    anio = Column(Integer, nullable=True)
    turno = Column(String(20), nullable=True)
    activo = Column(Boolean, nullable=False, default=True, server_default="1")

    usuario = relationship("Usuario", back_populates="materias_asignadas")
    materia = relationship("Materia", back_populates="docentes_asignados")


class Asistencia(Base):
    __tablename__ = "asistencias"

    id_asistencia = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    id_materia = Column(Integer, ForeignKey("materias.id_materia"), nullable=True)
    fecha_hora_entrada = Column(DateTime, nullable=False)
    fecha_hora_salida = Column(DateTime, nullable=True)
    tema_dictado = Column(Text, nullable=True)

    usuario = relationship("Usuario", back_populates="asistencias")
    materia = relationship("Materia", back_populates="asistencias")




class Licencia(Base):
    __tablename__ = "licencias"
    __table_args__ = (
        UniqueConstraint("id_usuario", "id_docente_materia", "fecha", name="uq_licencia_usuario_asignacion_fecha"),
    )

    id_licencia = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    id_materia = Column(Integer, ForeignKey("materias.id_materia"), nullable=False)
    id_docente_materia = Column(Integer, ForeignKey("docente_materia.id_docente_materia"), nullable=False)
    fecha = Column(String(10), nullable=False)
    dia_semana = Column(String(20), nullable=False)
    anio = Column(Integer, nullable=False)
    turno = Column(String(20), nullable=False)
    observacion = Column(Text, nullable=False)
    motivo_inasistencia = Column(String(50), nullable=False, default="Otro", server_default="Otro")
    fecha_registro = Column(DateTime, nullable=False)
    registrado_por = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=True)

    usuario = relationship("Usuario", foreign_keys=[id_usuario])
    materia = relationship("Materia")
    asignacion = relationship("DocenteMateria")

class Feriado(Base):
    __tablename__ = "feriados"
    __table_args__ = (
        UniqueConstraint("fecha", name="uq_feriado_fecha"),
    )

    id_feriado = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fecha = Column(String(10), nullable=False)
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(30), nullable=False, default="nacional")
    jurisdiccion = Column(String(80), nullable=False, default="Argentina")
    activo = Column(Boolean, nullable=False, default=True, server_default="1")
