import { useEffect, useState } from "react";

import {
  obtenerAsistenciasAPI,
  registrarEntradaAPI,
  registrarSalidaAPI,
} from "../services/asistenciaService";

import "../styles/Asistencia.css";

// ======================================================
// FORMATEAR HORA
// ======================================================

const formatearFechaHora = (fechaHora) => {
  if (!fechaHora) return "";

  // Si ya viene solamente como HH:mm:ss
  if (
    typeof fechaHora === "string" &&
    /^\d{2}:\d{2}:\d{2}$/.test(fechaHora)
  ) {
    return fechaHora;
  }

  const fecha = new Date(fechaHora);

  if (Number.isNaN(fecha.getTime())) {
    return "";
  }

  return fecha.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

// ======================================================
// SABER SI UNA FECHA ES DE HOY
// ======================================================

const esDeHoy = (fechaHora) => {
  if (!fechaHora) return false;

  const fecha = new Date(fechaHora);

  if (Number.isNaN(fecha.getTime())) {
    return false;
  }

  const hoy = new Date();

  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
};

// ======================================================
// COMPONENTE
// ======================================================

function Asistencia({
  datosClase,
  onVolverLogin,
  onVolverMaterias,
}) {
  const [ahora, setAhora] = useState(new Date());

  const [asistencia, setAsistencia] = useState(null);

  const [cargandoAsistencia, setCargandoAsistencia] =
    useState(true);

  const [cargando, setCargando] = useState(false);

  const [mensaje, setMensaje] = useState("");

  const [mostrarCuentaRegresiva, setMostrarCuentaRegresiva] =
    useState(false);

  const [segundosRestantes, setSegundosRestantes] =
    useState(10);

  // ======================================================
  // RELOJ
  // ======================================================

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAhora(new Date());
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  // ======================================================
  // BUSCAR ASISTENCIA DE HOY
  // ======================================================

  useEffect(() => {
    const cargarAsistencia = async () => {
      if (!datosClase.id_usuario) {
        setCargandoAsistencia(false);
        return;
      }

      try {
        setCargandoAsistencia(true);
        setMensaje("");

        const asistencias = await obtenerAsistenciasAPI(
          datosClase.id_usuario
        );

        // Buscar solamente la asistencia de hoy
        // y de la materia seleccionada.
        const asistenciaHoy = asistencias.find((item) => {
          const mismaMateria =
            datosClase.rol === "docente"
              ? Number(item.id_materia) ===
                Number(datosClase.id_materia)
              : item.id_materia === null;

          return (
            mismaMateria &&
            esDeHoy(item.fecha_hora_entrada)
          );
        });

        if (asistenciaHoy) {
          setAsistencia(asistenciaHoy);

          if (asistenciaHoy.fecha_hora_salida) {
            setMensaje(
              "Ya registraste la asistencia de hoy para esta materia."
            );
          }
        } else {
          setAsistencia(null);
        }
      } catch (error) {
        console.error(
          "Error al consultar asistencia:",
          error
        );

        setMensaje(
          "No se pudo consultar la asistencia."
        );
      } finally {
        setCargandoAsistencia(false);
      }
    };

    cargarAsistencia();
  }, [
    datosClase.id_usuario,
    datosClase.id_materia,
    datosClase.rol,
  ]);

  // ======================================================
  // CUENTA REGRESIVA AL INICIO
  // ======================================================

  useEffect(() => {
    if (!mostrarCuentaRegresiva) {
      return;
    }

    setSegundosRestantes(10);
  }, [mostrarCuentaRegresiva]);

  useEffect(() => {
    if (!mostrarCuentaRegresiva) {
      return;
    }

    if (segundosRestantes <= 0) {
      onVolverLogin();
      return;
    }

    const temporizador = setTimeout(() => {
      setSegundosRestantes((segundos) => Math.max(0, segundos - 1));
    }, 1000);

    return () => clearTimeout(temporizador);
  }, [mostrarCuentaRegresiva, segundosRestantes, onVolverLogin]);

  // ======================================================
  // REGISTRAR ENTRADA
  // ======================================================

  const registrarEntrada = async () => {
    if (asistencia) {
      if (asistencia.fecha_hora_salida) {
        setMensaje(
          "Ya registraste la asistencia de hoy para esta materia."
        );
      } else {
        setMensaje(
          "Ya existe una entrada abierta."
        );
      }

      return;
    }

    if (!datosClase.id_usuario) {
      setMensaje(
        "No se encontró el usuario."
      );

      return;
    }

    try {
      setCargando(true);
      setMensaje("");

      const nuevaAsistencia =
        await registrarEntradaAPI(
          datosClase.id_usuario,
          datosClase.rol === "docente"
            ? datosClase.id_materia
            : null
        );

      setAsistencia(nuevaAsistencia);

      setMensaje(
        "Entrada registrada correctamente."
      );
    } catch (error) {
      console.error(
        "Error al registrar entrada:",
        error
      );

      setMensaje(
        error.response?.data?.detail ||
          "No se pudo registrar la entrada."
      );
    } finally {
      setCargando(false);
    }
  };

  // ======================================================
  // REGISTRAR SALIDA
  // ======================================================

  const registrarSalida = async () => {
    if (!asistencia) {
      setMensaje(
        "Primero debe registrar la entrada."
      );

      return;
    }

    if (asistencia.fecha_hora_salida) {
      setMensaje(
        "La salida ya fue registrada."
      );

      return;
    }

    try {
      setCargando(true);
      setMensaje("");

      const asistenciaActualizada =
        await registrarSalidaAPI(
          asistencia.id_asistencia
        );

      setAsistencia(asistenciaActualizada);

      setMensaje(
        datosClase.rol === "no_docente"
          ? "Jornada finalizada correctamente."
          : "Asistencia finalizada correctamente."
      );

      // Después de registrar la salida,
      // comienza el regreso automático al inicio.
      setMostrarCuentaRegresiva(true);
    } catch (error) {
      console.error(
        "Error al registrar salida:",
        error
      );

      setMensaje(
        error.response?.data?.detail ||
          "No se pudo registrar la salida."
      );
    } finally {
      setCargando(false);
    }
  };

  // ======================================================
  // VOLVER A SELECCIONAR MATERIA
  // ======================================================

  const volverAMaterias = () => {
    setMostrarCuentaRegresiva(false);
    setMensaje("");

    if (onVolverMaterias) {
      onVolverMaterias();
    }
  };

  // ======================================================
  // VOLVER AL INICIO
  // ======================================================

  const volverAlInicio = () => {
    setMostrarCuentaRegresiva(false);
    setMensaje("");

    if (onVolverLogin) {
      onVolverLogin();
    }
  };

  // ======================================================
  // DATOS
  // ======================================================

  const esNoDocente =
    datosClase.rol === "no_docente";

  const tieneEntrada =
    Boolean(asistencia?.fecha_hora_entrada);

  const tieneSalida =
    Boolean(asistencia?.fecha_hora_salida);

  // ======================================================
  // RELOJ ACTUAL
  // ======================================================

  const horaActual =
    ahora.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  const fechaActual =
    ahora.toLocaleDateString("es-AR");

  // ======================================================
  // INTERFAZ
  // ======================================================

  return (
    <div className="asistencia-container">

      <div className="asistencia-card">

        <div className="asistencia-encabezado">
          <p className="asistencia-seccion">
            CONTROL DE PERSONAL
          </p>

          <h1>
            Registro de asistencia
          </h1>
        </div>

        {/* ==================================================
            RELOJ
        ================================================== */}

        <div className="reloj">

          <strong>
            Hora actual
          </strong>

          <span>
            {horaActual}
          </span>

          <small>
            {fechaActual}
          </small>

        </div>

        {/* ==================================================
            DATOS DE LA PERSONA / CLASE
        ================================================== */}

        <div className="datos-clase">

          <p>

            <strong>
              {esNoDocente
                ? "Personal:"
                : "Docente:"}
            </strong>

            {" "}

            {datosClase.nombre}

          </p>

          {!esNoDocente && datosClase.materia && (
            <>
              <p>
                <strong>Cátedra:</strong>{" "}
                <span className="dato-destacado">{datosClase.materia}</span>
              </p>
            </>
          )}

          {!esNoDocente && datosClase.carrera && (
            <p>
              <strong>Carrera:</strong>{" "}
              {datosClase.carrera}
            </p>
          )}

          {!esNoDocente && datosClase.anio && (
            <p>
              <strong>Curso:</strong>{" "}
              {datosClase.anio}.º año
            </p>
          )}

          {!esNoDocente && datosClase.turno && (
            <p>
              <strong>Turno:</strong>{" "}
              {datosClase.turno}
            </p>
          )}

          {!esNoDocente &&
            datosClase.dia && (

              <p>

                <strong>
                  Día:
                </strong>

                {" "}

                {datosClase.dia}

              </p>

            )}

        </div>

        {/* ==================================================
            CARGANDO
        ================================================== */}

        {cargandoAsistencia && (

          <div className="estado-consulta">
            Consultando asistencia...
          </div>

        )}

        {/* ==================================================
            REGISTROS
        ================================================== */}

        <div className="registro">

          {/* ==================================================
              ENTRADA
          ================================================== */}

          <div className="registro-item">

            <h2>
              Entrada
            </h2>

            <p className="hora-registro">

              {formatearFechaHora(
                asistencia?.fecha_hora_entrada
              ) || "--:--:--"}

            </p>

            {!tieneEntrada && (

              <>
                <button
                  type="button"
                  className="boton-principal boton-entrada"
                  onClick={registrarEntrada}
                  disabled={
                    cargando ||
                    cargandoAsistencia
                  }
                >

                  {cargando
                    ? "Registrando..."
                    : "Registrar entrada"}

                </button>

                <p className="estado-registro">
                  La entrada está disponible.
                </p>
              </>

            )}

            {tieneEntrada && (

              <p className="estado-registro registrado">
                Entrada registrada
              </p>

            )}

          </div>

          {/* ==================================================
              SALIDA
          ================================================== */}

          <div className="registro-item">

            <h2>
              Salida
            </h2>

            <p className="hora-registro">

              {formatearFechaHora(
                asistencia?.fecha_hora_salida
              ) || "--:--:--"}

            </p>

            {tieneEntrada &&
              !tieneSalida && (

                <>
                  <button
                    type="button"
                    className="boton-principal boton-salida"
                    onClick={registrarSalida}
                    disabled={
                      cargando ||
                      cargandoAsistencia
                    }
                  >

                    {cargando
                      ? "Registrando..."
                      : "Registrar salida"}

                  </button>

                  <p className="estado-registro">
                    Puede registrar su salida.
                  </p>
                </>

              )}

            {!tieneEntrada && (

              <p className="estado-registro bloqueado">
                Primero registre la entrada.
              </p>

            )}

            {tieneSalida && (

              <p className="estado-registro registrado">
                Salida registrada
              </p>

            )}

          </div>

        </div>

        {/* ==================================================
            MENSAJE
        ================================================== */}

        {mensaje && (

          <div
            className={
              tieneSalida
                ? "mensaje-exito mensaje-final"
                : "mensaje-exito"
            }
          >

            <p>
              {mensaje}
            </p>

          </div>

        )}

        {/* ==================================================
            CUENTA REGRESIVA
        ================================================== */}

        {mostrarCuentaRegresiva && (

          <div className="cuenta-regresiva">

            <p>
              Regresando al inicio en{" "}
              <strong>
                {segundosRestantes}
              </strong>{" "}
              segundos.
            </p>

          </div>

        )}

        {/* ==================================================
            ACCIONES
        ================================================== */}

        <div className="asistencia-acciones">

          {onVolverMaterias && (
            <button
              type="button"
              className="boton-secundario"
              onClick={volverAMaterias}
              disabled={cargando}
            >
              Volver a seleccionar materia
            </button>
          )}

          <button
            type="button"
            className="boton-inicio"
            onClick={volverAlInicio}
            disabled={cargando}
          >
            Volver al inicio
          </button>

        </div>

      </div>

    </div>
  );
}

export default Asistencia;