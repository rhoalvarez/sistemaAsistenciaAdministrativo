"""Esquemas Pydantic de la API."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from .models import TipoEmpleado


class UsuarioBase(BaseModel):
    nombre: str
    apellido: str
    tipo_empleado: TipoEmpleado
    rol_acceso: str = "superadmin"


class LoginRequest(BaseModel):
    usuario: str
    contrasenia: str


class UsuarioCreate(UsuarioBase):
    usuario: str
    contrasenia: str

    @field_validator("contrasenia")
    @classmethod
    def validar_contrasenia_segura(cls, v: str) -> str:
        if len(v) < 6 or not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe tener al menos 6 caracteres e incluir una letra y un número")
        return v


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    tipo_empleado: Optional[TipoEmpleado] = None
    usuario: Optional[str] = None
    contrasenia: Optional[str] = None
    rol_acceso: Optional[str] = None

    @field_validator("contrasenia")
    @classmethod
    def validar_contrasenia_segura(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "": return v
        if len(v) < 6 or not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe tener al menos 6 caracteres e incluir una letra y un número")
        return v


class UsuarioOut(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)
    id_usuario: int
    usuario: str
    activo: bool


class CarreraBase(BaseModel):
    nombre_carrera: str


class CarreraCreate(CarreraBase):
    pass


class CarreraOut(CarreraBase):
    model_config = ConfigDict(from_attributes=True)
    id_carrera: int
    activo: bool


class MateriaBase(BaseModel):
    nombre_materia: str
    id_carrera: Optional[int] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None

    @field_validator("hora_inicio", "hora_fin")
    @classmethod
    def validar_hora_materia(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        try:
            datetime.strptime(v, "%H:%M")
        except ValueError as exc:
            raise ValueError("La hora debe tener formato HH:MM") from exc
        return v

    @model_validator(mode="after")
    def validar_rango_horario(self):
        if self.hora_inicio and self.hora_fin and self.hora_fin <= self.hora_inicio:
            raise ValueError("La hora de finalización debe ser posterior a la hora de inicio")
        return self


class MateriaCreate(MateriaBase):
    pass


class MateriaOut(MateriaBase):
    model_config = ConfigDict(from_attributes=True)
    id_materia: int
    id_carrera: int
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    activo: bool


DIAS_VALIDOS = {"Lunes", "Martes", "Miércoles", "Jueves", "Viernes"}


class DocenteMateriaBase(BaseModel):
    id_usuario: int
    id_materia: int
    dia_semana: str
    anio: int | None = None
    turno: str | None = None

    @field_validator("dia_semana")
    @classmethod
    def validar_dia(cls, v: str) -> str:
        if v not in DIAS_VALIDOS:
            raise ValueError(
                f"dia_semana debe ser uno de: {sorted(DIAS_VALIDOS)}"
            )
        return v

    @field_validator("anio")
    @classmethod
    def validar_anio(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v < 1 or v > 10:
            raise ValueError("anio debe estar entre 1 y 10")
        return v

    @field_validator("turno")
    @classmethod
    def validar_turno(cls, v: str | None) -> str | None:
        if v is None:
            return v
        valores = {"Mañana", "Tarde", "Noche"}
        if v not in valores:
            raise ValueError("turno debe ser Mañana, Tarde o Noche")
        return v


class DocenteMateriaCreate(BaseModel):
    id_usuario: int
    id_materia: int
    dia_semana: str
    anio: int
    turno: str

    @field_validator("dia_semana")
    @classmethod
    def validar_dia(cls, v: str) -> str:
        if v not in DIAS_VALIDOS:
            raise ValueError(f"dia_semana debe ser uno de: {sorted(DIAS_VALIDOS)}")
        return v

    @field_validator("anio")
    @classmethod
    def validar_anio(cls, v: int) -> int:
        if v < 1 or v > 10:
            raise ValueError("anio debe estar entre 1 y 10")
        return v

    @field_validator("turno")
    @classmethod
    def validar_turno(cls, v: str) -> str:
        if v not in {"Mañana", "Tarde", "Noche"}:
            raise ValueError("turno debe ser Mañana, Tarde o Noche")
        return v


class DocenteMateriaOut(DocenteMateriaBase):
    model_config = ConfigDict(from_attributes=True)
    id_docente_materia: int
    activo: bool


class MateriaDelDiaOut(BaseModel):
    id_docente_materia: int
    id_materia: int
    nombre_materia: str
    nombre_carrera: str
    dia_semana: str
    anio: int | None = None
    turno: str | None = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None


class AsistenciaEntradaCreate(BaseModel):
    id_usuario: int
    id_materia: Optional[int] = None


class AsistenciaSalidaUpdate(BaseModel):
    fecha_hora_salida: Optional[datetime] = None


class AsistenciaTemaUpdate(BaseModel):
    id_materia: int
    tema_dictado: str


class AsistenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_asistencia: int
    id_usuario: int
    id_materia: Optional[int] = None
    fecha_hora_entrada: datetime
    fecha_hora_salida: Optional[datetime] = None
    tema_dictado: Optional[str] = None




class LicenciaCreate(BaseModel):
    id_usuario: int
    id_docente_materia: int
    fecha: str
    observacion: str
    motivo_inasistencia: str = "Otro"

    @field_validator("motivo_inasistencia")
    @classmethod
    def validar_motivo(cls, v: str) -> str:
        permitidos = {"Enfermedad", "Licencia médica", "Licencia personal", "Trámite personal", "Familiar", "Fuerza mayor", "Otro"}
        if v not in permitidos: raise ValueError("El motivo de inasistencia no es válido")
        return v

    @field_validator("fecha")
    @classmethod
    def validar_fecha_licencia(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("fecha debe tener formato YYYY-MM-DD") from exc
        return v

    @field_validator("observacion")
    @classmethod
    def validar_observacion(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("La observación es obligatoria")
        return v.strip()


class LicenciaOut(BaseModel):
    id_licencia: int
    motivo_inasistencia: str = "Otro"
    registrado_por: Optional[int] = None
    id_usuario: int
    nombre_docente: str
    id_materia: int
    id_docente_materia: int
    nombre_materia: str
    nombre_carrera: str
    fecha: str
    dia_semana: str
    anio: int
    turno: str
    observacion: str
    fecha_registro: datetime

class FeriadoBase(BaseModel):
    fecha: str
    nombre: str
    tipo: str = "nacional"
    jurisdiccion: str = "Argentina"

    @field_validator("fecha")
    @classmethod
    def validar_fecha(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("fecha debe tener formato YYYY-MM-DD") from exc
        return v

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El nombre del feriado es obligatorio")
        return v.strip()


class FeriadoCreate(FeriadoBase):
    pass


class FeriadoOut(FeriadoBase):
    model_config = ConfigDict(from_attributes=True)
    id_feriado: int
    activo: bool
