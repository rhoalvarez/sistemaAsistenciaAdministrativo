"""Configuración y migración segura de la base SQLite local."""

import sqlite3
import shutil
from pathlib import Path

from .security import hash_password

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

DB_PATH = Path(__file__).resolve().parent.parent / "asistencia.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

@event.listens_for(engine, "connect")
def configurar_sqlite(dbapi_connection, connection_record):
    """Activa las claves foráneas y un tiempo de espera para bloqueos breves."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _columnas(conn, tabla):
    return {fila[1] for fila in conn.execute(f'PRAGMA table_info("{tabla}")')}


def migrar_base_local():
    """Agrega la estructura nueva sin borrar los datos existentes."""
    if not DB_PATH.exists():
        return

    # Conserva una copia previa a la primera migración automática de esta versión.
    respaldo_previo = DB_PATH.with_name("asistencia.pre_seguridad.db")
    if not respaldo_previo.exists():
        try:
            shutil.copy2(DB_PATH, respaldo_previo)
        except OSError:
            # Si el sistema no permite escribir el respaldo, no se debe ocultar el error
            # de migración; se continúa y las operaciones SQL reportarán el problema real.
            pass

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys=OFF")
        conn.execute("BEGIN")

        # Carreras
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS carreras (
                id_carrera INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre_carrera VARCHAR(150) NOT NULL UNIQUE,
                activo BOOLEAN NOT NULL DEFAULT 1
            )
            """
        )

        # La carrera actual del sistema.
        conn.execute(
            """
            INSERT OR IGNORE INTO carreras (id_carrera, nombre_carrera, activo)
            VALUES (1, 'Tecnicatura Superior en Desarrollo de Software', 1)
            """
        )

        columnas_usuarios = _columnas(conn, "usuarios")
        if "rol_acceso" not in columnas_usuarios:
            conn.execute("ALTER TABLE usuarios ADD COLUMN rol_acceso VARCHAR(20) NOT NULL DEFAULT 'superadmin'")
        conn.execute("UPDATE usuarios SET rol_acceso = 'superadmin' WHERE rol_acceso IS NULL OR rol_acceso = ''")
        # El perfil de acceso administrativo solo aplica a cuentas admin.
        # Evita que docentes/personal queden etiquetados erróneamente como superadmin.
        conn.execute("UPDATE usuarios SET rol_acceso = 'personal' WHERE tipo_empleado != 'admin'")
        if "activo" not in columnas_usuarios:
            conn.execute(
                "ALTER TABLE usuarios ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1"
            )

        columnas_materias = _columnas(conn, "materias")
        if "hora_inicio" not in columnas_materias:
            conn.execute("ALTER TABLE materias ADD COLUMN hora_inicio VARCHAR(5)")
        if "hora_fin" not in columnas_materias:
            conn.execute("ALTER TABLE materias ADD COLUMN hora_fin VARCHAR(5)")
        if "id_carrera" not in columnas_materias:
            conn.execute("ALTER TABLE materias ADD COLUMN id_carrera INTEGER")
            conn.execute("UPDATE materias SET id_carrera = 1 WHERE id_carrera IS NULL")
        if "activo" not in columnas_materias:
            conn.execute(
                "ALTER TABLE materias ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1"
            )

        conn.execute("UPDATE usuarios SET activo = 1 WHERE activo IS NULL")
        conn.execute("UPDATE materias SET activo = 1 WHERE activo IS NULL")

        # Cuenta administrativa inicial para el acceso al panel.
        # La contraseña se guarda únicamente como hash PBKDF2.
        admin_existente = conn.execute(
            "SELECT id_usuario FROM usuarios WHERE usuario = ? LIMIT 1",
            ("admin",),
        ).fetchone()
        if not admin_existente:
            conn.execute(
                """
                INSERT INTO usuarios
                    (nombre, apellido, usuario, contrasenia, tipo_empleado, activo)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (
                    "Administrador",
                    "IES",
                    "admin",
                    hash_password("Admin123!"),
                    "admin",
                ),
            )

        # Se deja la base con una carrera válida para todos los registros existentes.
        conn.execute("UPDATE materias SET id_carrera = 1 WHERE id_carrera IS NULL")

        # Las asignaciones docente-materia también se conservan como historial.
        # Se agregan con borrado lógico para no perder qué se dictó anteriormente.
        if "docente_materia" in {fila[0] for fila in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}:
            columnas_docente_materia = _columnas(conn, "docente_materia")
            if "activo" not in columnas_docente_materia:
                conn.execute(
                    "ALTER TABLE docente_materia ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1"
                )
            conn.execute("UPDATE docente_materia SET activo = 1 WHERE activo IS NULL")

            if "anio" not in columnas_docente_materia:
                conn.execute("ALTER TABLE docente_materia ADD COLUMN anio INTEGER")
            if "turno" not in columnas_docente_materia:
                conn.execute("ALTER TABLE docente_materia ADD COLUMN turno VARCHAR(20)")

        # Actualiza la restricción antigua de docente_materia para que una misma
        # materia pueda existir el mismo día en distintos años/turnos.
        tablas = {fila[0] for fila in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        if "docente_materia" in tablas:
            indices_dm = conn.execute("PRAGMA index_list('docente_materia')").fetchall()
            necesita_reconstruccion = False
            for indice in indices_dm:
                nombre_indice = indice[1]
                es_unico = bool(indice[2])
                if es_unico:
                    cols = [fila[2] for fila in conn.execute(f'PRAGMA index_info("{nombre_indice}")').fetchall()]
                    if cols == ["id_usuario", "id_materia", "dia_semana"]:
                        necesita_reconstruccion = True
                        break
            if necesita_reconstruccion:
                conn.execute("ALTER TABLE docente_materia RENAME TO docente_materia_migracion")
                conn.execute("""
                    CREATE TABLE docente_materia (
                        id_docente_materia INTEGER PRIMARY KEY AUTOINCREMENT,
                        id_usuario INTEGER NOT NULL,
                        id_materia INTEGER NOT NULL,
                        dia_semana VARCHAR(20) NOT NULL,
                        anio INTEGER,
                        turno VARCHAR(20),
                        activo BOOLEAN NOT NULL DEFAULT 1,
                        CONSTRAINT uq_docente_materia_dia_anio_turno
                            UNIQUE (id_usuario, id_materia, dia_semana, anio, turno)
                    )
                """)
                conn.execute("""
                    INSERT INTO docente_materia
                        (id_docente_materia, id_usuario, id_materia, dia_semana, anio, turno, activo)
                    SELECT id_docente_materia, id_usuario, id_materia, dia_semana,
                           NULL, NULL, COALESCE(activo, 1)
                    FROM docente_materia_migracion
                """)
                conn.execute("DROP TABLE docente_materia_migracion")

        # Licencias: registro histórico e inmutable de inasistencias justificadas.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS licencias (
                id_licencia INTEGER PRIMARY KEY AUTOINCREMENT,
                id_usuario INTEGER NOT NULL,
                id_materia INTEGER NOT NULL,
                id_docente_materia INTEGER NOT NULL,
                fecha VARCHAR(10) NOT NULL,
                dia_semana VARCHAR(20) NOT NULL,
                anio INTEGER NOT NULL,
                turno VARCHAR(20) NOT NULL,
                observacion TEXT NOT NULL,
                fecha_registro DATETIME NOT NULL,
                CONSTRAINT uq_licencia_usuario_asignacion_fecha UNIQUE (id_usuario, id_docente_materia, fecha),
                FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
                FOREIGN KEY(id_materia) REFERENCES materias(id_materia),
                FOREIGN KEY(id_docente_materia) REFERENCES docente_materia(id_docente_materia)
            )
            """
        )

        # Calendario local de feriados nacionales y provinciales de Catamarca.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS feriados (
                id_feriado INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha VARCHAR(10) NOT NULL UNIQUE,
                nombre VARCHAR(200) NOT NULL,
                tipo VARCHAR(30) NOT NULL DEFAULT 'nacional',
                jurisdiccion VARCHAR(80) NOT NULL DEFAULT 'Argentina',
                activo BOOLEAN NOT NULL DEFAULT 1
            )
            """
        )

        feriados_2026 = [
            ("2026-01-01", "Año Nuevo", "nacional", "Argentina"),
            ("2026-02-16", "Carnaval", "nacional", "Argentina"),
            ("2026-02-17", "Carnaval", "nacional", "Argentina"),
            ("2026-03-23", "Día no laborable con fines turísticos", "turistico", "Argentina"),
            ("2026-03-24", "Día Nacional de la Memoria por la Verdad y la Justicia", "nacional", "Argentina"),
            ("2026-04-02", "Día del Veterano y de los Caídos en la Guerra de Malvinas", "nacional", "Argentina"),
            ("2026-04-03", "Viernes Santo", "nacional", "Argentina"),
            ("2026-05-01", "Día del Trabajador", "nacional", "Argentina"),
            ("2026-05-11", "Natalicio de Fray Mamerto Esquiú", "provincial", "Catamarca"),
            ("2026-05-25", "Día de la Revolución de Mayo", "nacional", "Argentina"),
            ("2026-06-17", "Paso a la Inmortalidad del Gral. Martín Miguel de Güemes", "nacional", "Argentina"),
            ("2026-06-20", "Paso a la Inmortalidad del Gral. Manuel Belgrano", "nacional", "Argentina"),
            ("2026-07-09", "Día de la Independencia", "nacional", "Argentina"),
            ("2026-07-10", "Día no laborable con fines turísticos", "turistico", "Argentina"),
            ("2026-08-17", "Paso a la Inmortalidad del Gral. José de San Martín", "nacional", "Argentina"),
            ("2026-08-25", "Autonomía de Catamarca", "provincial", "Catamarca"),
            ("2026-09-07", "Día del Milagro", "provincial", "Catamarca"),
            ("2026-10-12", "Día del Respeto a la Diversidad Cultural", "nacional", "Argentina"),
            ("2026-11-09", "Feriado nacional por visita oficial de Su Santidad el Papa León XIV", "nacional", "Argentina"),
            ("2026-11-20", "Día de la Soberanía Nacional", "nacional", "Argentina"),
            ("2026-12-07", "Día no laborable con fines turísticos", "turistico", "Argentina"),
            ("2026-12-08", "Inmaculada Concepción de María", "nacional", "Argentina"),
            ("2026-12-25", "Navidad", "nacional", "Argentina"),
        ]
        for fecha, nombre, tipo, jurisdiccion in feriados_2026:
            conn.execute(
                """
                INSERT OR IGNORE INTO feriados
                    (fecha, nombre, tipo, jurisdiccion, activo)
                VALUES (?, ?, ?, ?, 1)
                """,
                (fecha, nombre, tipo, jurisdiccion),
            )

        # Campos adicionales de inasistencia, sin perder registros previos.
        if "licencias" in {fila[0] for fila in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}:
            columnas_lic = _columnas(conn, "licencias")
            if "motivo_inasistencia" not in columnas_lic:
                conn.execute("ALTER TABLE licencias ADD COLUMN motivo_inasistencia VARCHAR(50) NOT NULL DEFAULT 'Otro'")
            if "registrado_por" not in columnas_lic:
                conn.execute("ALTER TABLE licencias ADD COLUMN registrado_por INTEGER")
        # Migra las contraseñas antiguas en texto plano a PBKDF2.
        filas = conn.execute("SELECT id_usuario, contrasenia FROM usuarios").fetchall()
        for id_usuario, contrasenia in filas:
            if contrasenia and not str(contrasenia).startswith("pbkdf2_sha256$"):
                conn.execute(
                    "UPDATE usuarios SET contrasenia = ? WHERE id_usuario = ?",
                    (hash_password(str(contrasenia)), id_usuario),
                )

        # La versión antigua hacía único el nombre de materia a nivel global.
        # Ahora la unicidad correcta es nombre + carrera. Se reconstruye solo
        # cuando todavía existe la tabla antigua.
        indices = conn.execute("PRAGMA index_list('materias')").fetchall()
        indice_global = False
        for indice in indices:
            nombre_indice = indice[1]
            es_unico = bool(indice[2])
            if es_unico:
                columnas = [fila[2] for fila in conn.execute(f'PRAGMA index_info("{nombre_indice}")').fetchall()]
                if columnas == ["nombre_materia"]:
                    indice_global = True
                    break

        if indice_global:
            conn.execute("ALTER TABLE materias RENAME TO materias_antigua_migracion")
            conn.execute(
                """
                CREATE TABLE materias (
                    id_materia INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre_materia VARCHAR(150) NOT NULL,
                    id_carrera INTEGER NOT NULL,
                    hora_inicio VARCHAR(5),
                    hora_fin VARCHAR(5),
                    activo BOOLEAN NOT NULL DEFAULT 1,
                    CONSTRAINT uq_materia_carrera UNIQUE (nombre_materia, id_carrera)
                )
                """
            )
            conn.execute(
                """
                INSERT INTO materias (id_materia, nombre_materia, id_carrera, hora_inicio, hora_fin, activo)
                SELECT id_materia, nombre_materia, COALESCE(id_carrera, 1), hora_inicio, hora_fin, COALESCE(activo, 1)
                FROM materias_antigua_migracion
                """
            )
            conn.execute("DROP TABLE materias_antigua_migracion")

        # Repara referencias foráneas antiguas. Versiones anteriores reconstruían
        # materias/docente_materia con ALTER TABLE y podían dejar referencias rotas.
        tablas_actuales = {fila[0] for fila in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        if "docente_materia" in tablas_actuales:
            fks_dm = {fila[2] for fila in conn.execute("PRAGMA foreign_key_list('docente_materia')").fetchall()}
            if not {"usuarios", "materias"}.issubset(fks_dm):
                conn.execute("DROP TABLE IF EXISTS docente_materia_nueva")
                conn.execute("""CREATE TABLE docente_materia_nueva (
                    id_docente_materia INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_usuario INTEGER NOT NULL, id_materia INTEGER NOT NULL,
                    dia_semana VARCHAR(20) NOT NULL, anio INTEGER, turno VARCHAR(20),
                    activo BOOLEAN NOT NULL DEFAULT 1,
                    CONSTRAINT uq_docente_materia_dia_anio_turno UNIQUE (id_usuario, id_materia, dia_semana, anio, turno),
                    FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
                    FOREIGN KEY(id_materia) REFERENCES materias(id_materia)
                )""")
                conn.execute("""INSERT INTO docente_materia_nueva
                    (id_docente_materia,id_usuario,id_materia,dia_semana,anio,turno,activo)
                    SELECT id_docente_materia,id_usuario,id_materia,dia_semana,anio,turno,COALESCE(activo,1) FROM docente_materia""")
                conn.execute("DROP TABLE docente_materia")
                conn.execute("ALTER TABLE docente_materia_nueva RENAME TO docente_materia")

        tablas_actuales = {fila[0] for fila in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        if "asistencias" in tablas_actuales:
            fks_as = {fila[2] for fila in conn.execute("PRAGMA foreign_key_list('asistencias')").fetchall()}
            if "materias" not in fks_as or "materias_antigua_migracion" in fks_as:
                conn.execute("DROP TABLE IF EXISTS asistencias_nueva")
                conn.execute("""CREATE TABLE asistencias_nueva (
                    id_asistencia INTEGER PRIMARY KEY AUTOINCREMENT,
                    id_usuario INTEGER NOT NULL, id_materia INTEGER,
                    fecha_hora_entrada DATETIME NOT NULL, fecha_hora_salida DATETIME,
                    tema_dictado TEXT,
                    FOREIGN KEY(id_usuario) REFERENCES usuarios(id_usuario),
                    FOREIGN KEY(id_materia) REFERENCES materias(id_materia)
                )""")
                conn.execute("""INSERT INTO asistencias_nueva
                    (id_asistencia,id_usuario,id_materia,fecha_hora_entrada,fecha_hora_salida,tema_dictado)
                    SELECT id_asistencia,id_usuario,id_materia,fecha_hora_entrada,fecha_hora_salida,tema_dictado FROM asistencias""")
                conn.execute("DROP TABLE asistencias")
                conn.execute("ALTER TABLE asistencias_nueva RENAME TO asistencias")

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def asegurar_admin_inicial():
    """Crea la cuenta administrativa inicial si todavía no existe."""
    from .models import Usuario, TipoEmpleado

    db = SessionLocal()
    try:
        existente = db.query(Usuario).filter(Usuario.usuario == "admin").first()
        if existente:
            return

        db.add(
            Usuario(
                nombre="Administrador",
                apellido="IES",
                usuario="admin",
                contrasenia=hash_password("Admin123!"),
                tipo_empleado=TipoEmpleado.admin,
                activo=True,
            )
        )
        db.commit()
    finally:
        db.close()
