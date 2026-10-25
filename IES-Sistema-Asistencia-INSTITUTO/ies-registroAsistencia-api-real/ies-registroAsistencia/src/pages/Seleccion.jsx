import { useEffect, useState } from "react";
import { obtenerMateriasDeHoy } from "../services/docenteMateriaService";
import { obtenerAsistenciasAPI } from "../services/asistenciaService";
import logoIES from "../assets/logo-ies.jpeg";
import "../styles/Seleccion.css";

function Seleccion({
  onContinuar,
  onVolverInicio,
  nombre,
  id_usuario,
}) {
  const [materiaSeleccionada, setMateriaSeleccionada] =
    useState(null);

  const [materias, setMaterias] = useState([]);
  const [asistenciaAbierta, setAsistenciaAbierta] = useState(null);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [segundosRestantes, setSegundosRestantes] =
    useState(10);

  // ======================================================
  // CARGAR MATERIAS DEL DÍA
  // ======================================================

  useEffect(() => {
    let activo = true;

    const cargarMaterias = async () => {
      if (!id_usuario) {
        if (activo) {
          setError("No se encontró el usuario.");
          setCargando(false);
        }

        return;
      }

      try {
        setCargando(true);
        setError("");
        setMateriaSeleccionada(null);
        setAsistenciaAbierta(null);

        const [respuestaMaterias, respuestaAsistencias] =
          await Promise.all([
            obtenerMateriasDeHoy(id_usuario),
            obtenerAsistenciasAPI(id_usuario),
          ]);

        if (!activo) return;

        const listaMaterias = Array.isArray(respuestaMaterias)
          ? respuestaMaterias
          : [];

        const abierta = Array.isArray(respuestaAsistencias)
          ? respuestaAsistencias.find(
              (asistencia) =>
                asistencia.fecha_hora_salida === null,
            )
          : null;

        setMaterias(listaMaterias);
        setAsistenciaAbierta(abierta || null);
      } catch (errorApi) {
        console.error(
          "Error al obtener materias:",
          errorApi
        );

        if (!activo) return;

        setError(
          "No se pudieron cargar las materias desde el servidor."
        );

        setMaterias([]);
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarMaterias();

    return () => {
      activo = false;
    };
  }, [id_usuario]);

  // ======================================================
  // VOLVER AL INICIO
  // ======================================================

  const volverAlInicio = () => {
    if (onVolverInicio) {
      onVolverInicio();
    }
  };

  // ======================================================
  // INICIAR CUENTA REGRESIVA CUANDO NO HAY MATERIAS
  // ======================================================

  useEffect(() => {
    if (
      cargando ||
      error ||
      materias.length > 0
    ) {
      return;
    }

    setSegundosRestantes(10);

    const intervalo = setInterval(() => {
      setSegundosRestantes((segundos) => {
        if (segundos <= 1) {
          return 0;
        }

        return segundos - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalo);
    };
  }, [cargando, error, materias.length]);

  // ======================================================
  // VOLVER AUTOMÁTICAMENTE AL INICIO
  // ======================================================

  useEffect(() => {
    if (
      cargando ||
      error ||
      materias.length > 0
    ) {
      return;
    }

    if (segundosRestantes === 0) {
      volverAlInicio();
    }
  }, [
    segundosRestantes,
    cargando,
    error,
    materias.length,
  ]);

  // ======================================================
  // CONTINUAR
  // ======================================================

  const handleContinuar = () => {
    if (!materiaSeleccionada) {
      return;
    }

    const idAsistenciaAbierta =
      asistenciaAbierta?.id_materia ===
      materiaSeleccionada.id_materia
        ? asistenciaAbierta.id_asistencia
        : null;

    onContinuar({
      id_usuario,
      nombre,
      rol: "docente",
      id_materia: materiaSeleccionada.id_materia,
      materia: materiaSeleccionada.nombre_materia,
      carrera: materiaSeleccionada.nombre_carrera || "",
      dia: materiaSeleccionada.dia_semana,
      anio: materiaSeleccionada.anio ?? null,
      turno: materiaSeleccionada.turno ?? "",
      id_asistencia: idAsistenciaAbierta,
    });
  };

  // ======================================================
  // INTERFAZ
  // ======================================================

  return (
    <div className="seleccion-container">
      <div className="seleccion-card">

        {/* LOGO */}

        <img
          src={logoIES}
          alt="Logo del IES"
          className="seleccion-logo"
        />

        {/* ENCABEZADO */}

        <div className="seleccion-header">

          <p className="seleccion-etiqueta">
            SISTEMA INSTITUCIONAL
          </p>

          <div className="icono-seleccion">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="4"
                width="18"
                height="17"
                rx="2"
              />

              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <path d="M3 10h18" />
              <path d="M8 14h2" />
              <path d="M14 14h2" />
              <path d="M8 18h2" />
              <path d="M14 18h2" />
            </svg>
          </div>

          <h1>
            Registro de asistencia
          </h1>

          <p className="bienvenida">
            Bienvenido/a{" "}
            <strong>{nombre}</strong>
          </p>

        </div>

        {/* FORMULARIO */}

        <div className="seleccion-form">

          <div className="seleccion-form-group">

            <label htmlFor="materia">
              Materia de hoy
            </label>

            {/* CARGANDO */}

            {cargando && (
              <div className="estado-seleccion cargando">

                <span className="indicador-carga">
                  ...
                </span>

                <p>
                  Consultando materias asignadas...
                </p>

              </div>
            )}

            {/* ERROR */}

            {!cargando && error && (
              <div className="estado-seleccion error">

                <div className="estado-icono">
                  !
                </div>

                <div>

                  <strong>
                    No se pudo consultar la información
                  </strong>

                  <p>
                    {error}
                  </p>

                </div>

              </div>
            )}

            {/* SIN MATERIAS */}

            {!cargando &&
              !error &&
              materias.length === 0 && (

                <div className="sin-clases">

                  <div className="sin-clases-icono">
                    —
                  </div>

                  <div className="sin-clases-contenido">

                    <strong>
                      No hay materias asignadas para hoy
                    </strong>

                    <p>
                      No tiene clases registradas para
                      este día.
                    </p>

                  </div>

                </div>
            )}

            {/* SELECT DE MATERIAS */}

            {!cargando &&
              !error &&
              materias.length > 0 && (

                <div className="select-container">

                  <span
                    className="select-icon"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="17"
                        rx="2"
                      />

                      <path d="M8 2v4" />
                      <path d="M16 2v4" />
                      <path d="M3 10h18" />
                      <path d="M8 14h8" />
                      <path d="M8 17h5" />
                    </svg>
                  </span>

                  <select
                    id="materia"
                    value={
                      materiaSeleccionada?.id_docente_materia ??
                      ""
                    }
                    onChange={(event) => {
                      const idAsignacion =
                        Number(event.target.value);

                      const materia =
                        materias.find(
                          (item) =>
                            item.id_docente_materia ===
                            idAsignacion,
                        );

                      setMateriaSeleccionada(
                        materia ?? null
                      );
                    }}
                  >
                    <option value="">
                      Seleccione una materia
                    </option>

                    {materias.map((materia) => (
                      <option
                        key={
                          materia.id_docente_materia
                        }
                        value={
                          materia.id_docente_materia
                        }
                      >
                        {materia.nombre_materia}
                        {materia.hora_inicio || materia.hora_fin ? ` · ${materia.hora_inicio || "--:--"}-${materia.hora_fin || "--:--"}` : ""}
                        {materia.nombre_carrera ? ` · ${materia.nombre_carrera}` : ""}
                        {materia.anio
                          ? ` · ${materia.anio}.º año`
                          : ""}
                        {materia.turno
                          ? ` · ${materia.turno}`
                          : ""}
                      </option>
                    ))}
                  </select>

                </div>
            )}

          </div>

          {/* MATERIA SELECCIONADA */}

          {materiaSeleccionada && (
            <div className="clase-seleccionada">

              <div className="clase-check">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </div>

              <div className="clase-seleccionada-texto">

                <strong>
                  Materia seleccionada
                </strong>

                <span>
                  {materiaSeleccionada.nombre_materia}
                </span>

                <span>
                  {materiaSeleccionada.nombre_carrera || "Carrera no disponible"}
                </span>

                <span>
                  Horario de materia: {materiaSeleccionada.hora_inicio || "--:--"} a {materiaSeleccionada.hora_fin || "--:--"}
                </span>

                <span>
                  {materiaSeleccionada.dia_semana}
                  {materiaSeleccionada.anio
                    ? ` · ${materiaSeleccionada.anio}.º año`
                    : ""}
                  {materiaSeleccionada.turno
                    ? ` · ${materiaSeleccionada.turno}`
                    : ""}
                </span>

              </div>

            </div>
          )}

          {materiaSeleccionada &&
            asistenciaAbierta?.id_materia ===
              materiaSeleccionada.id_materia && (
              <div className="aviso-asistencia-abierta">
                Hay una entrada abierta para esta materia.
                Al continuar podrás registrar la salida.
              </div>
            )}

          {/* BOTÓN CONTINUAR */}

          {materias.length > 0 &&
            !cargando &&
            !error && (

              <button
                type="button"
                className="boton-continuar"
                onClick={handleContinuar}
                disabled={!materiaSeleccionada}
              >
                Continuar

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>

              </button>
          )}

          {/* VOLVER AL INICIO */}

          {!cargando &&
            !error &&
            materias.length === 0 && (

              <div className="volver-inicio-seleccion">

                <p>
                  Regresando al inicio en{" "}
                  <strong>
                    {segundosRestantes}
                  </strong>{" "}
                  segundos.
                </p>

                <button
                  type="button"
                  className="boton-volver-inicio"
                  onClick={volverAlInicio}
                >
                  Volver al inicio
                </button>

              </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default Seleccion;