/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { adminFetch } from "./adminApi";
import { useEffect, useState } from "react";
import logoIES from "./assets/logo-ies.jpeg";
import Reportes from "./Reportes";
import Licencias from "./Licencias";
import "./App.css";
import { getAdminHeaders } from "./adminSession";
import { detalleErrorApi, contraseniaValida } from "./apiErrors";

const API_URL =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const ADMIN_HEADERS = {};

const actualizarAdminSession = (token) => {
  if (token) {
    sessionStorage.setItem("ies_admin_session", token);
    ADMIN_HEADERS["X-Admin-Session"] = token;
  } else {
    sessionStorage.removeItem("ies_admin_session");
    delete ADMIN_HEADERS["X-Admin-Session"];
  }
};

const cargarAdminSession = () => {
  const token = sessionStorage.getItem("ies_admin_session");
  if (token) ADMIN_HEADERS["X-Admin-Session"] = token;
};

cargarAdminSession();

const formularioVacio = {
  nombre: "",
  apellido: "",
  usuario: "",
  contrasenia: "",
  tipo_empleado: "docente",
};

const obtenerFechaLocal = () => {
  const ahora = new Date();
  const año = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");

  return `${año}-${mes}-${dia}`;
};

const formatearHora = (fecha) => {
  if (!fecha) return "—";

  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return "—";
  }

  return fechaObj.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const formatearFecha = (fecha) => {
  if (!fecha) return "—";

  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return "—";
  }

  return fechaObj.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const obtenerDiaFecha = (fecha) => {
  if (!fecha) return "—";

  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return "—";
  }

  return fechaObj.toLocaleDateString("es-AR", {
    weekday: "long",
  });
};

const obtenerFechaComparacion = (fecha) => {
  if (!fecha) return "";

  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return "";
  }

  const año = fechaObj.getFullYear();
  const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
  const dia = String(fechaObj.getDate()).padStart(2, "0");

  return `${año}-${mes}-${dia}`;
};

function Modal({ abierto, titulo, subtitulo, onCerrar, children }) {
  if (!abierto) return null;

  return (
    <div
      className="admin-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCerrar();
        }
      }}
    >
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div>
            <h2>{titulo}</h2>

            {subtitulo && <p>{subtitulo}</p>}
          </div>

          <button
            type="button"
            className="admin-modal-close"
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );
}

function PantallaAsistencias() {
  const [registros, setRegistros] = useState([]);
  const [registrosNoDocentes, setRegistrosNoDocentes] = useState([]);
  const [inasistenciasPendientes, setInasistenciasPendientes] = useState([]);
  const [fechaInasistencias, setFechaInasistencias] = useState("");
  const [feriadoInasistencias, setFeriadoInasistencias] = useState(null);
  const [cargandoInasistencias, setCargandoInasistencias] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [fechaDesde, setFechaDesde] = useState(obtenerFechaLocal());
  const [fechaHasta, setFechaHasta] = useState(obtenerFechaLocal());
  const [busquedaDocente, setBusquedaDocente] = useState("");

  const cargarAsistencias = async () => {
    try {
      setCargando(true);
      setMensaje("");

      if (fechaDesde > fechaHasta) {
        throw new Error(
          "La fecha desde no puede ser posterior a la fecha hasta.",
        );
      }

      const respuestaDocentes = await adminFetch(
        `${API_URL}/usuarios/?tipo_empleado=docente&incluir_inactivos=true`,
      );

      if (!respuestaDocentes.ok) {
        throw new Error("No se pudieron cargar los docentes.");
      }

      const docentes = await respuestaDocentes.json();

      const respuestaNoDocentes = await adminFetch(
        `${API_URL}/usuarios/?tipo_empleado=no_docente&incluir_inactivos=true`,
      );

      if (!respuestaNoDocentes.ok) {
        throw new Error("No se pudo cargar el personal.");
      }

      const noDocentes = await respuestaNoDocentes.json();

      const [respuestaMaterias, respuestaCarreras] = await Promise.all([
        adminFetch(`${API_URL}/materias/?incluir_inactivos=true`),
        adminFetch(`${API_URL}/carreras/?incluir_inactivos=true`),
      ]);

      if (!respuestaMaterias.ok || !respuestaCarreras.ok) {
        throw new Error("No se pudieron cargar las materias y carreras.");
      }

      const materias = await respuestaMaterias.json();
      const carreras = await respuestaCarreras.json();

      const registrosDocentes = [];

      for (const docente of docentes) {
        const respuestaAsignaciones = await adminFetch(
          `${API_URL}/docente-materia/?id_usuario=${docente.id_usuario}`,
        );

        if (!respuestaAsignaciones.ok) {
          continue;
        }

        const asignaciones = await respuestaAsignaciones.json();

        const respuestaAsistencias = await adminFetch(
          `${API_URL}/asistencias/?id_usuario=${docente.id_usuario}`,
        );

        if (!respuestaAsistencias.ok) {
          continue;
        }

        const asistencias = await respuestaAsistencias.json();

        for (const asistencia of asistencias) {
          if (!asistencia.fecha_hora_entrada) {
            continue;
          }

          const materia = materias.find(
            (item) => item.id_materia === asistencia.id_materia,
          );

          const diaRegistro = obtenerDiaFecha(asistencia.fecha_hora_entrada);
          const asignacion = asignaciones.find(
            (item) =>
              item.id_materia === asistencia.id_materia &&
              item.dia_semana?.toLowerCase() === diaRegistro.toLowerCase(),
          ) || asignaciones.find(
            (item) => item.id_materia === asistencia.id_materia,
          );

          const carrera = carreras.find(
            (item) => item.id_carrera === materia?.id_carrera,
          );

          const fechaRegistro = obtenerFechaComparacion(
            asistencia.fecha_hora_entrada,
          );

          if (fechaRegistro < fechaDesde || fechaRegistro > fechaHasta) {
            continue;
          }

          registrosDocentes.push({
            id: asistencia.id_asistencia,
            docente: `${docente.nombre} ${docente.apellido}`,
            materia: materia?.nombre_materia || "Materia no disponible",
            horarioMateria: materia?.hora_inicio || materia?.hora_fin ? `${materia?.hora_inicio || "--:--"} a ${materia?.hora_fin || "--:--"}` : "Sin definir",
            carrera: carrera?.nombre_carrera || "Carrera no disponible",
            anio: asignacion?.anio || null,
            turno: asignacion?.turno || "—",
            fecha: asistencia.fecha_hora_entrada,
            dia: diaRegistro,
            entrada: asistencia.fecha_hora_entrada,
            salida: asistencia.fecha_hora_salida,
            asignacion,
          });
        }
      }

      registrosDocentes.sort(
        (a, b) => new Date(b.fecha) - new Date(a.fecha),
      );

      setRegistros(registrosDocentes);

      // Control automático de inasistencias del día actual.
      // El backend excluye fines de semana, feriados y ausencias ya justificadas.
      setCargandoInasistencias(true);
      try {
        const respuestaPendientes = await adminFetch(`${API_URL}/licencias/pendientes`);
        if (respuestaPendientes.ok) {
          const datosPendientes = await respuestaPendientes.json();
          setFechaInasistencias(datosPendientes.fecha || obtenerFechaLocal());
          setFeriadoInasistencias(datosPendientes.feriado || null);
          setInasistenciasPendientes(datosPendientes.pendientes || []);
        } else {
          setInasistenciasPendientes([]);
        }
      } catch {
        setInasistenciasPendientes([]);
      } finally {
        setCargandoInasistencias(false);
      }

      const registrosNoDocentesFinales = [];

      for (const empleado of noDocentes) {
        const respuestaAsistencias = await adminFetch(
          `${API_URL}/asistencias/?id_usuario=${empleado.id_usuario}`,
        );

        if (!respuestaAsistencias.ok) {
          continue;
        }

        const asistencias = await respuestaAsistencias.json();

        for (const asistencia of asistencias) {
          if (!asistencia.fecha_hora_entrada) {
            continue;
          }

          const fechaRegistro = obtenerFechaComparacion(
            asistencia.fecha_hora_entrada,
          );

          if (fechaRegistro < fechaDesde || fechaRegistro > fechaHasta) {
            continue;
          }

          registrosNoDocentesFinales.push({
            id: asistencia.id_asistencia,
            empleado: `${empleado.nombre} ${empleado.apellido}`,
            fecha: asistencia.fecha_hora_entrada,
            dia: obtenerDiaFecha(asistencia.fecha_hora_entrada),
            entrada: asistencia.fecha_hora_entrada,
            salida: asistencia.fecha_hora_salida,
          });
        }
      }

      registrosNoDocentesFinales.sort(
        (a, b) => new Date(b.fecha) - new Date(a.fecha),
      );

      setRegistrosNoDocentes(registrosNoDocentesFinales);
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message || "No se pudieron cargar las asistencias.",
      );
    } finally {
      setCargando(false);
    }
  };

  const registrosDocentesFiltrados = registros.filter((registro) => {
    const texto = busquedaDocente.trim().toLowerCase();

    if (texto) {
      return registro.docente.toLowerCase().includes(texto);
    }

    const fechaRegistro = obtenerFechaComparacion(registro.fecha);
    return fechaRegistro >= fechaDesde && fechaRegistro <= fechaHasta;
  });

  const inasistenciasAgrupadas = Object.entries(
    inasistenciasPendientes.reduce((grupos, item) => {
      const clave = item.nombre_materia || "Materia sin identificar";
      if (!grupos[clave]) grupos[clave] = [];
      grupos[clave].push(item);
      return grupos;
    }, {}),
  );

  useEffect(() => {
    cargarAsistencias();
  }, []);

  return (
    <section className="admin-section-card admin-attendance-screen">
      <div className="admin-section-header">
        <div>
          <span className="admin-section-kicker">
            CONTROL DE PERSONAL
          </span>

          <h2>Registro de asistencias</h2>

          <p>
            Consulta y seguimiento de entradas y salidas registradas.
          </p>
        </div>

        <button
          type="button"
          className="admin-primary-button"
          onClick={cargarAsistencias}
          disabled={cargando}
        >
          {cargando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="admin-filter-card">
        <div className="admin-filter-title">
          Período de consulta
        </div>

        <div className="admin-filter-grid">
          <div className="admin-field">
            <label htmlFor="fechaDesde">Desde</label>

            <input
              id="fechaDesde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="fechaHasta">Hasta</label>

            <input
              id="fechaHasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          <div className="admin-filter-action">
            <button
              type="button"
              className="admin-secondary-button"
              onClick={cargarAsistencias}
            >
              Consultar período
            </button>
          </div>
        </div>
      </div>

      <div className="admin-search-panel admin-attendance-search">
        <label
          className="admin-search-label"
          htmlFor="busquedaDocenteAsistencias"
        >
          Buscar docente
        </label>

        <div className="admin-search-box">
          <svg
            className="admin-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>

          <input
            id="busquedaDocenteAsistencias"
            type="text"
            value={busquedaDocente}
            onChange={(e) => setBusquedaDocente(e.target.value)}
            placeholder="Buscar por nombre o apellido..."
            autoComplete="off"
          />

          {busquedaDocente && (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => setBusquedaDocente("")}
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        {busquedaDocente.trim() && (
          <p className="admin-search-help">
            Al buscar un docente se muestran todas sus asistencias registradas.
          </p>
        )}
      </div>

      {mensaje && (
        <div className="admin-alert admin-alert-error">
          {mensaje}
        </div>
      )}

      {cargando ? (
        <div className="admin-empty-state">
          <div className="admin-loader" />

          <p>Cargando registros de asistencia...</p>
        </div>
      ) : (
        <>
          <div className="admin-data-block">
            <div className="admin-data-block-header">
              <div>
                <span className="admin-section-kicker">
                  PERSONAL
                </span>

                <h3>Asistencias de docentes</h3>
              </div>

              <span className="admin-counter">
                {registrosDocentesFiltrados.length} registros
              </span>
            </div>

            {registrosDocentesFiltrados.length === 0 ? (
              <div className="admin-empty-state compact">
                <p>
                  {busquedaDocente.trim()
                    ? "No se encontraron asistencias para ese docente."
                    : "No existen asistencias de docentes dentro del período seleccionado."}
                </p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table admin-attendance-table">
                  <thead>
                    <tr>
                      <th>Docente</th>
                      <th>Materia</th>
                      <th>Horario de materia</th>
                      <th>Carrera</th>
                      <th>Curso / turno</th>
                      <th>Fecha</th>
                      <th>Entrada</th>
                      <th>Salida</th>
                    </tr>
                  </thead>

                  <tbody>
                    {registrosDocentesFiltrados.map((registro) => (
                      <tr key={registro.id}>
                        <td data-label="Docente">
                          <strong>{registro.docente}</strong>
                        </td>

                        <td data-label="Materia">
                          <strong>{registro.materia}</strong>
                        </td>

                        <td data-label="Horario de materia">
                          <span className="admin-cell-secondary">{registro.horarioMateria || "Sin definir"}</span>
                        </td>

                        <td data-label="Carrera">
                          {registro.carrera}
                        </td>

                        <td data-label="Curso / turno">
                          {registro.anio ? `${registro.anio}.º año` : "—"}
                          {registro.turno && registro.turno !== "—" ? ` · ${registro.turno}` : ""}
                          <small className="admin-cell-secondary">{registro.dia}</small>
                        </td>

                        <td data-label="Fecha">
                          {formatearFecha(registro.fecha)}
                        </td>

                        <td data-label="Entrada">
                          <span className="admin-status admin-status-success">
                            {formatearHora(registro.entrada)}
                          </span>
                        </td>

                        <td data-label="Salida">
                          {registro.salida ? (
                            <span className="admin-status admin-status-success">
                              {formatearHora(registro.salida)}
                            </span>
                          ) : (
                            <span className="admin-status admin-status-warning">
                              Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-data-block admin-inasistencias-block">
            <div className="admin-data-block-header">
              <div>
                <span className="admin-section-kicker">
                  CONTROL AUTOMÁTICO
                </span>
                <h3>Inasistencias pendientes</h3>
                <p className="admin-data-block-description">
                  Docentes con una materia asignada para hoy que todavía no registraron su asistencia.
                </p>
              </div>
              <div className="admin-inasistencia-meta">
                {fechaInasistencias && (
                  <span>{formatearFecha(fechaInasistencias)}</span>
                )}
                <span className="admin-counter">
                  {inasistenciasPendientes.length} pendiente{inasistenciasPendientes.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {feriadoInasistencias ? (
              <div className="admin-holiday-notice">
                <strong>📅 {feriadoInasistencias.nombre}</strong>
                <span>No se generan inasistencias porque hoy corresponde a un feriado.</span>
              </div>
            ) : cargandoInasistencias ? (
              <div className="admin-empty-state compact">
                <p>Comprobando las asistencias del día...</p>
              </div>
            ) : inasistenciasAgrupadas.length === 0 ? (
              <div className="admin-empty-state compact admin-success-empty">
                <p>✓ Todos los docentes con materia asignada registraron su asistencia de hoy.</p>
              </div>
            ) : (
              <div className="admin-inasistencia-groups">
                {inasistenciasAgrupadas.map(([materia, items]) => (
                  <article className="admin-inasistencia-group" key={materia}>
                    <div className="admin-inasistencia-group-header">
                      <div>
                        <span>MATERIA</span>
                        <h4>{materia}</h4>
                      </div>
                      <strong>{items.length} docente{items.length === 1 ? "" : "s"}</strong>
                    </div>

                    <div className="admin-inasistencia-list">
                      {items.map((item) => (
                        <div className="admin-inasistencia-item" key={item.id_docente_materia}>
                          <div>
                            <span className="admin-inasistencia-label">PROFESOR</span>
                            <strong>{item.nombre_docente}</strong>
                          </div>
                          <div>
                            <span>Carrera</span>
                            <strong>{item.nombre_carrera || "—"}</strong>
                          </div>
                          <div>
                            <span>Curso</span>
                            <strong>{item.anio ? `${item.anio}.º año` : "—"}</strong>
                          </div>
                          <div>
                            <span>Turno</span>
                            <strong>{item.turno || "—"}</strong>
                          </div>
                          <div>
                            <span>Día</span>
                            <strong>{item.dia_semana || "—"}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="admin-data-block">
            <div className="admin-data-block-header">
              <div>
                <span className="admin-section-kicker">
                  PERSONAL
                </span>

                <h3>Asistencias de personal</h3>
              </div>

              <span className="admin-counter">
                {registrosNoDocentes.length} registros
              </span>
            </div>

            {registrosNoDocentes.length === 0 ? (
              <div className="admin-empty-state compact">
                <p>
                  No existen asistencias de personal
                  dentro del período seleccionado.
                </p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Personal</th>
                      <th>Fecha</th>
                      <th>Día</th>
                      <th>Entrada</th>
                      <th>Salida</th>
                    </tr>
                  </thead>

                  <tbody>
                    {registrosNoDocentes.map((registro) => (
                      <tr key={registro.id}>
                        <td data-label="Personal">
                          <strong>{registro.empleado}</strong>
                        </td>

                        <td data-label="Fecha">
                          {formatearFecha(registro.fecha)}
                        </td>

                        <td data-label="Día">
                          {registro.dia}
                        </td>

                        <td data-label="Entrada">
                          <span className="admin-status admin-status-success">
                            {formatearHora(registro.entrada)}
                          </span>
                        </td>

                        <td data-label="Salida">
                          {registro.salida ? (
                            <span className="admin-status admin-status-success">
                              {formatearHora(registro.salida)}
                            </span>
                          ) : (
                            <span className="admin-status admin-status-warning">
                              Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function App() {
  const [mostrarAdministracion, setMostrarAdministracion] =
    useState(false);
  const [rolAccesoActual, setRolAccesoActual] = useState(sessionStorage.getItem("ies_rol_acceso") || "superadmin");
  const soloLectura = rolAccesoActual === "lector";
  const puedeEliminar = rolAccesoActual === "superadmin";

  const [usuarioAdministracion, setUsuarioAdministracion] =
    useState("");
  const [claveAdministracion, setClaveAdministracion] =
    useState("");
  const [errorAdministracion, setErrorAdministracion] =
    useState("");
  const [cargandoAdministracion, setCargandoAdministracion] =
    useState(false);

  const [seccion, setSeccion] = useState("docente");
  const [administradores, setAdministradores] = useState([]);
  const [mostrarFormularioAdmin, setMostrarFormularioAdmin] = useState(false);
  const [adminEditando, setAdminEditando] = useState(null);
  const [formularioAdmin, setFormularioAdmin] = useState({ nombre: "", apellido: "", usuario: "", contrasenia: "", rol_acceso: "superadmin" });
  const [mostrarClaveAdmin, setMostrarClaveAdmin] = useState(false);

  const [personal, setPersonal] = useState([]);
  const [personalPapelera, setPersonalPapelera] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [idCarreraMateria, setIdCarreraMateria] = useState("");
  const [carreraFiltroMaterias, setCarreraFiltroMaterias] = useState("todas");
  const [idCarreraAsignacion, setIdCarreraAsignacion] = useState("");

  const [busquedaPersonal, setBusquedaPersonal] = useState("");
  const [busquedaMaterias, setBusquedaMaterias] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [notificacion, setNotificacion] = useState({
    visible: false,
    mensaje: "",
    tipo: "success",
  });

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);
  const [mostrarClavePersonal, setMostrarClavePersonal] = useState(false);

  const [editando, setEditando] = useState(null);

  const [formulario, setFormulario] =
    useState(formularioVacio);

  const [docenteSeleccionado, setDocenteSeleccionado] =
    useState(null);

  const [asignaciones, setAsignaciones] = useState([]);

  const [materiaSeleccionada, setMateriaSeleccionada] =
    useState("");

  const [diasSeleccionados, setDiasSeleccionados] =
    useState([]);

  const [anioAsignacion, setAnioAsignacion] = useState("");
  const [turnoAsignacion, setTurnoAsignacion] = useState("");

  const [cargandoAsignaciones, setCargandoAsignaciones] =
    useState(false);

  const [mostrarMateriaFormulario, setMostrarMateriaFormulario] =
    useState(false);
  const [materiaEditando, setMateriaEditando] = useState(null);

  const [mostrarCarreraFormulario, setMostrarCarreraFormulario] =
    useState(false);

  const [nombreMateria, setNombreMateria] = useState("");
  const [horaInicioMateria, setHoraInicioMateria] = useState("");
  const [horaFinMateria, setHoraFinMateria] = useState("");
  const [nombreCarrera, setNombreCarrera] = useState("");

  const esDocente = seccion === "docente";
  const esNoDocente = seccion === "no_docente";
  const esMaterias = seccion === "materias";
  const esAsistencias = seccion === "asistencias";
  const esReportes = seccion === "reportes";
  const esLicencias = seccion === "licencias";
  const esPapelera = seccion === "papelera";
  const esAdministradores = seccion === "administradores";

  const mostrarNotificacion = (texto, tipo = "success") => {
    setNotificacion({
      visible: true,
      mensaje: texto,
      tipo,
    });
  };

  useEffect(() => {
    if (!notificacion.visible) {
      return;
    }

    const temporizador = setTimeout(() => {
      setNotificacion({
        visible: false,
        mensaje: "",
        tipo: "success",
      });
    }, 3000);

    return () => clearTimeout(temporizador);
  }, [notificacion.visible]);

  const cerrarNotificacion = () => {
    setNotificacion({
      visible: false,
      mensaje: "",
      tipo: "success",
    });
  };

  const cargarPersonal = async (tipo = seccion) => {
    try {
      const respuesta = await adminFetch(
        `${API_URL}/usuarios/?tipo_empleado=${tipo}`,
      );

      if (!respuesta.ok) {
        throw new Error("No se pudo cargar el personal.");
      }

      const datos = await respuesta.json();

      setPersonal(datos);
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message || "No se pudo cargar el personal.",
      );
    }
  };

  const cargarPapelera = async () => {
    try {
      const respuesta = await adminFetch(
        `${API_URL}/usuarios/?incluir_inactivos=true`,
      );

      if (!respuesta.ok) {
        throw new Error("No se pudo cargar la papelera.");
      }

      const datos = await respuesta.json();
      setPersonalPapelera(datos.filter((persona) => !persona.activo));
    } catch (error) {
      console.error(error);
      setPersonalPapelera([]);
      setMensaje(error.message || "No se pudo cargar la papelera.");
    }
  };

  const cargarMaterias = async () => {
    try {
      const respuesta = await adminFetch(`${API_URL}/materias/`);

      if (!respuesta.ok) {
        throw new Error("No se pudieron cargar las materias.");
      }

      const datos = await respuesta.json();

      setMaterias(datos);
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message || "No se pudieron cargar las materias.",
      );
    }
  };

  const cargarCarreras = async () => {
    try {
      const respuesta = await adminFetch(`${API_URL}/carreras/`);
      if (!respuesta.ok) throw new Error("No se pudieron cargar las carreras.");
      const datos = await respuesta.json();
      setCarreras(datos);
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudieron cargar las carreras.");
    }
  };

  useEffect(() => {
    // No consultar rutas protegidas antes de que el administrador inicie sesión.
    if (!mostrarAdministracion) return;
    if (seccion === "docente" || seccion === "no_docente") {
      cargarPersonal(seccion);
    }
  }, [seccion, mostrarAdministracion]);

  useEffect(() => {
    // Las consultas de catálogos se ejecutan cuando ya existe una sesión válida.
    if (!mostrarAdministracion) return;
    cargarMaterias();
    cargarCarreras();
  }, [mostrarAdministracion]);

  const cargarAdministradores = async () => {
    try {
      const respuesta = await adminFetch(`${API_URL}/usuarios/?tipo_empleado=admin&incluir_inactivos=false`, {
        headers: getAdminHeaders(),
      });
      if (!respuesta.ok) throw new Error("No se pudieron cargar los administradores.");
      setAdministradores(await respuesta.json());
    } catch (error) {
      setAdministradores([]);
      setMensaje(error.message || "No se pudieron cargar los administradores.");
    }
  };

  const abrirNuevoAdministrador = () => {
    if (administradores.length >= 3) {
      mostrarNotificacion("Solo se permiten hasta 3 administradores activos.", "error");
      return;
    }
    setAdminEditando(null);
    setFormularioAdmin({ nombre: "", apellido: "", usuario: "", contrasenia: "", rol_acceso: "superadmin" });
    setMostrarClaveAdmin(false);
    setMensaje("");
    setMostrarFormularioAdmin(true);
  };

  const editarAdministrador = (admin) => {
    setAdminEditando(admin);
    setFormularioAdmin({ nombre: admin.nombre || "", apellido: admin.apellido || "", usuario: admin.usuario || "", contrasenia: "", rol_acceso: admin.rol_acceso || "superadmin" });
    setMostrarClaveAdmin(false);
    setMensaje("");
    setMostrarFormularioAdmin(true);
  };

  const guardarAdministrador = async (event) => {
    event.preventDefault();
    if (!puedeEliminar) { mostrarNotificacion("Solo el administrador principal puede administrar cuentas.", "error"); return; }
    if (!formularioAdmin.nombre.trim() || !formularioAdmin.apellido.trim() || !formularioAdmin.usuario.trim()) {
      mostrarNotificacion("Nombre, apellido y usuario son obligatorios.", "error");
      return;
    }
    if (!adminEditando && !formularioAdmin.contrasenia.trim()) {
      mostrarNotificacion("La contraseña es obligatoria.", "error");
      return;
    }
    if (formularioAdmin.contrasenia.trim() && !contraseniaValida(formularioAdmin.contrasenia)) {
      mostrarNotificacion("La contraseña debe tener al menos 6 caracteres e incluir una letra y un número.", "error");
      return;
    }
    try {
      const payload = {
        nombre: formularioAdmin.nombre.trim(),
        apellido: formularioAdmin.apellido.trim(),
        usuario: formularioAdmin.usuario.trim(),
        tipo_empleado: "admin",
        rol_acceso: formularioAdmin.rol_acceso || "superadmin",
      };
      if (formularioAdmin.contrasenia.trim()) payload.contrasenia = formularioAdmin.contrasenia;
      const respuesta = await adminFetch(
        adminEditando ? `${API_URL}/usuarios/${adminEditando.id_usuario}` : `${API_URL}/usuarios/`,
        {
          method: adminEditando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", ...getAdminHeaders() },
          body: JSON.stringify(payload),
        },
      );
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) throw new Error(detalleErrorApi(datos?.detail, "No se pudo guardar el administrador."));
      setMostrarFormularioAdmin(false);
      setAdminEditando(null);
      setFormularioAdmin({ nombre: "", apellido: "", usuario: "", contrasenia: "", rol_acceso: "superadmin" });
      await cargarAdministradores();
      mostrarNotificacion(adminEditando ? "Administrador actualizado correctamente." : "Administrador creado correctamente.");
    } catch (error) {
      mostrarNotificacion(error.message || "No se pudo guardar el administrador.", "error");
    }
  };

  const eliminarAdministrador = async (admin) => {
    if (!puedeEliminar) return;
    if (!window.confirm(`¿Deseás desactivar al administrador ${admin.nombre} ${admin.apellido}?`)) return;
    try {
      const respuesta = await adminFetch(`${API_URL}/usuarios/${admin.id_usuario}`, { method: "DELETE", headers: getAdminHeaders() });
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) throw new Error(detalleErrorApi(datos?.detail, "No se pudo desactivar el administrador."));
      await cargarAdministradores();
      mostrarNotificacion("Administrador desactivado correctamente.");
    } catch (error) {
      mostrarNotificacion(error.message || "No se pudo desactivar el administrador.", "error");
    }
  };

  const cambiarSeccion = (nuevaSeccion) => {
    setSeccion(nuevaSeccion);
    setMensaje("");
    cerrarNotificacion();

    setBusquedaPersonal("");
    setBusquedaMaterias("");
    setMostrarFormulario(false);
    setMostrarMateriaFormulario(false);
    setMostrarCarreraFormulario(false);
    setIdCarreraMateria("");
    setCarreraFiltroMaterias("todas");
    setIdCarreraAsignacion("");
    setNombreCarrera("");

    setEditando(null);

    setDocenteSeleccionado(null);
    setAsignaciones([]);

    setMateriaSeleccionada("");
    setIdCarreraAsignacion("");
    setDiasSeleccionados([]);
    setAnioAsignacion("");
    setTurnoAsignacion("");

    if (nuevaSeccion === "materias") {
      cargarMaterias();
    }

    if (
      nuevaSeccion === "docente" ||
      nuevaSeccion === "no_docente"
    ) {
      cargarPersonal(nuevaSeccion);
    }

    if (nuevaSeccion === "papelera") {
      cargarPapelera();
    }

    if (nuevaSeccion === "administradores") {
      cargarAdministradores();
    }
  };

  const manejarCambio = (e) => {
    setFormulario({
      ...formulario,
      [e.target.name]: e.target.value,
    });
  };

  const nuevoPersonal = () => {
    setEditando(null);

    setFormulario({
      ...formularioVacio,
      tipo_empleado: esNoDocente
        ? "no_docente"
        : "docente",
    });

    setMensaje("");
    setMostrarClavePersonal(false);
    setMostrarFormulario(true);
  };

  const editarPersonal = (persona) => {
    setEditando(persona);

    setFormulario({
      nombre: persona.nombre || "",
      apellido: persona.apellido || "",
      usuario: persona.usuario || "",
      contrasenia: "",
      tipo_empleado:
        persona.tipo_empleado || "docente",
    });

    setMensaje("");
    setMostrarClavePersonal(false);
    setMostrarFormulario(true);
  };

  const guardarPersonal = async (e) => {
    e.preventDefault();
    if (soloLectura) { mostrarNotificacion("Tu perfil es de solo lectura.", "error"); return; }
    if (formulario.contrasenia.trim() && !contraseniaValida(formulario.contrasenia)) {
      mostrarNotificacion("La contraseña debe tener al menos 6 caracteres e incluir una letra y un número.", "error");
      return;
    }
    if (!editando && !contraseniaValida(formulario.contrasenia)) {
      mostrarNotificacion("La contraseña debe tener al menos 6 caracteres e incluir una letra y un número.", "error");
      return;
    }

    if (!formulario.nombre.trim() || !formulario.apellido.trim()) {
      mostrarNotificacion("El nombre y el apellido son obligatorios.", "error");
      return;
    }
    if (!editando && (!formulario.usuario.trim() || !formulario.contrasenia.trim())) {
      mostrarNotificacion("El usuario y la contraseña son obligatorios.", "error");
      return;
    }

    try {
      let respuesta;

      if (editando) {
        const datosActualizar = {
          nombre: formulario.nombre.trim(),
          apellido: formulario.apellido.trim(),
          tipo_empleado: formulario.tipo_empleado,
        };

        if (formulario.usuario.trim()) {
          datosActualizar.usuario =
            formulario.usuario.trim();
        }

        if (formulario.contrasenia.trim()) {
          datosActualizar.contrasenia =
            formulario.contrasenia;
        }

        respuesta = await adminFetch(
          `${API_URL}/usuarios/${editando.id_usuario}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...getAdminHeaders(),
            },
            body: JSON.stringify(datosActualizar),
          },
        );
      } else {
        respuesta = await adminFetch(
          `${API_URL}/usuarios/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAdminHeaders(),
            },
            body: JSON.stringify({
              nombre: formulario.nombre.trim(),
              apellido: formulario.apellido.trim(),
              usuario: formulario.usuario.trim(),
              contrasenia: formulario.contrasenia,
              tipo_empleado:
                formulario.tipo_empleado,
            }),
          },
        );
      }

      const datos = await respuesta
        .json()
        .catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          detalleErrorApi(datos?.detail, "No se pudo guardar el personal."),
        );
      }

      const mensajeExito = editando
        ? "Los datos del personal fueron actualizados correctamente."
        : "El nuevo personal fue registrado correctamente.";

      setMensaje("");

      mostrarNotificacion(mensajeExito);

      setMostrarFormulario(false);
      setEditando(null);
      setFormulario(formularioVacio);

      await cargarPersonal(seccion);
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "Ocurrió un error al guardar.", "error");
    }
  };

  const eliminarPersonal = async (persona) => {
    if (!puedeEliminar) { mostrarNotificacion("Tu perfil no permite eliminar registros.", "error"); return; }
    const confirmar = window.confirm(
      `¿Deseás eliminar a ${persona.nombre} ${persona.apellido}?`,
    );

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await adminFetch(
        `${API_URL}/usuarios/${persona.id_usuario}`,
        {
          method: "DELETE",
          headers: getAdminHeaders(),
        },
      );

      const datos = await respuesta
        .json()
        .catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          detalleErrorApi(datos?.detail, "No se pudo eliminar el personal."),
        );
      }

      setMensaje("");

      mostrarNotificacion(
        "El registro fue eliminado correctamente.",
      );

      if (
        docenteSeleccionado?.id_usuario ===
        persona.id_usuario
      ) {
        setDocenteSeleccionado(null);
      }

      await cargarPersonal(seccion);
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message ||
          "No se pudo eliminar el registro.",
      );
    }
  };

  const reactivarPersonal = async (persona) => {
    if (soloLectura) { mostrarNotificacion("Tu perfil es de solo lectura.", "error"); return; }
    if (!window.confirm(`¿Deseás reactivar a ${persona.nombre} ${persona.apellido}?`)) {
      return;
    }

    try {
      const respuesta = await adminFetch(
        `${API_URL}/usuarios/${persona.id_usuario}/reactivar`,
        { method: "POST", headers: getAdminHeaders() },
      );
      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        throw new Error(detalleErrorApi(datos?.detail, "No se pudo reactivar el personal."));
      }

      await cargarPapelera();
      if (seccion === "docente" || seccion === "no_docente") {
        await cargarPersonal(seccion);
      }
      mostrarNotificacion(`${persona.nombre} ${persona.apellido} fue reactivado correctamente.`);
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo reactivar el registro.", "error");
    }
  };

  const cargarAsignaciones = async (idUsuario) => {
    try {
      setCargandoAsignaciones(true);

      const respuesta = await adminFetch(
        `${API_URL}/docente-materia/?id_usuario=${idUsuario}`,
      );

      if (!respuesta.ok) {
        throw new Error(
          "No se pudieron cargar las asignaciones.",
        );
      }

      const datos = await respuesta.json();

      setAsignaciones(datos);
    } catch (error) {
      console.error(error);

      setAsignaciones([]);

      setMensaje(
        error.message ||
          "No se pudieron cargar las materias del docente.",
      );
    } finally {
      setCargandoAsignaciones(false);
    }
  };

  const abrirMaterias = async (docente) => {
    setDocenteSeleccionado(docente);

    setMateriaSeleccionada("");
    setDiasSeleccionados("");

    setDiasSeleccionados([]);
    setAnioAsignacion("");
    setTurnoAsignacion("");

    setMensaje("");

    await cargarMaterias();

    await cargarAsignaciones(
      docente.id_usuario,
    );
  };

  const cerrarMaterias = () => {
    setDocenteSeleccionado(null);
    setAsignaciones([]);
    setMateriaSeleccionada("");
    setIdCarreraAsignacion("");
    setDiasSeleccionados([]);
    setAnioAsignacion("");
    setTurnoAsignacion("");
  };

  const cambiarMateriaAsignacion = (e) => {
    const nuevoIdMateria = e.target.value;

    setMateriaSeleccionada(nuevoIdMateria);

    if (!nuevoIdMateria) {
      setDiasSeleccionados([]);
      return;
    }

    const diasYaAsignados = asignaciones
      .filter(
        (asignacion) =>
          String(asignacion.id_materia) ===
          String(nuevoIdMateria),
      )
      .map(
        (asignacion) =>
          asignacion.dia_semana,
      );

    setDiasSeleccionados(diasYaAsignados);
  };

  const alternarDiaAsignacion = (dia) => {
    setDiasSeleccionados(
      (diasActuales) =>
        diasActuales.includes(dia)
          ? diasActuales.filter(
              (diaActual) =>
                diaActual !== dia,
            )
          : [...diasActuales, dia],
    );
  };

  const asignarMateria = async (e) => {
    e.preventDefault();
    if (soloLectura) { mostrarNotificacion("Tu perfil es de solo lectura.", "error"); return; }

    if (!materiaSeleccionada) {
      setMensaje("Seleccioná una materia.");
      return;
    }

    if (diasSeleccionados.length === 0) {
      setMensaje(
        "Seleccioná al menos un día de la semana.",
      );

      return;
    }

    if (!anioAsignacion || !turnoAsignacion) {
      setMensaje("Seleccioná el año/curso y el turno de la asignación.");
      return;
    }

    try {
      const diasNuevos =
        diasSeleccionados.filter(
          (dia) =>
            !asignaciones.some(
              (asignacion) =>
                String(
                  asignacion.id_materia,
                ) ===
                  String(
                    materiaSeleccionada,
                  ) &&
                asignacion.dia_semana ===
                  dia &&
                Number(asignacion.anio || 0) ===
                  Number(anioAsignacion) &&
                (asignacion.turno || "") ===
                  turnoAsignacion,
            ),
        );

      if (diasNuevos.length === 0) {
        setMensaje(
          "La materia ya está asignada en todos los días seleccionados.",
        );

        return;
      }

      for (const dia of diasNuevos) {
        const respuesta = await adminFetch(
          `${API_URL}/docente-materia/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAdminHeaders(),
            },
            body: JSON.stringify({
              id_usuario:
                docenteSeleccionado.id_usuario,
              id_materia:
                Number(
                  materiaSeleccionada,
                ),
              dia_semana: dia,
              anio: Number(anioAsignacion),
              turno: turnoAsignacion,
            }),
          },
        );

        const datos = await respuesta
          .json()
          .catch(() => null);

        if (!respuesta.ok) {
          throw new Error(
            detalleErrorApi(datos?.detail, `No se pudo asignar la materia para el día ${dia}.`),
          );
        }
      }

      const mensajeAsignacion =
        diasNuevos.length === 1
          ? "La materia fue asignada correctamente."
          : `La materia fue asignada correctamente en ${diasNuevos.length} días.`;

      setMensaje("");

      mostrarNotificacion(
        mensajeAsignacion,
      );

      setMateriaSeleccionada("");
      setDiasSeleccionados([]);
      setAnioAsignacion("");
      setTurnoAsignacion("");

      await cargarAsignaciones(
        docenteSeleccionado.id_usuario,
      );
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message ||
          "No se pudo realizar la asignación.",
      );

      await cargarAsignaciones(
        docenteSeleccionado.id_usuario,
      );
    }
  };

  const eliminarAsignacion = async (
    idAsignacion,
  ) => {
    if (!puedeEliminar) { mostrarNotificacion("Tu perfil no permite eliminar registros.", "error"); return; }
    const confirmar = window.confirm(
      "¿Deseás quitar esta asignación?",
    );

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await adminFetch(
        `${API_URL}/docente-materia/${idAsignacion}`,
        {
          method: "DELETE",
          headers: getAdminHeaders(),
        },
      );

      const datos = await respuesta
        .json()
        .catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          detalleErrorApi(datos?.detail, "No se pudo quitar la asignación."),
        );
      }

      setMensaje("");

      mostrarNotificacion(
        "La asignación fue eliminada correctamente.",
      );

      await cargarAsignaciones(
        docenteSeleccionado.id_usuario,
      );
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message ||
          "No se pudo quitar la asignación.",
      );
    }
  };

  const obtenerNombreMateria = (
    idMateria,
  ) => {
    const materia = materias.find(
      (item) =>
        item.id_materia === idMateria,
    );

    return (
      materia?.nombre_materia ||
      `Materia #${idMateria}`
    );
  };

  const crearCarrera = async (e) => {
    e.preventDefault();
    if (soloLectura) { mostrarNotificacion("Tu perfil es de solo lectura.", "error"); return; }

    const nombre = nombreCarrera.trim();

    if (!nombre) {
      setMensaje("El nombre de la carrera es obligatorio.");
      return;
    }

    try {
      const respuesta = await adminFetch(`${API_URL}/carreras/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          nombre_carrera: nombre,
        }),
      });

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          detalleErrorApi(datos?.detail, "No se pudo crear la carrera."),
        );
      }

      setMensaje("");
      mostrarNotificacion("La carrera fue creada correctamente.");

      setNombreCarrera("");
      setMostrarCarreraFormulario(false);

      await cargarCarreras();
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message ||
          "No se pudo crear la carrera.",
      );
    }
  };

  const crearMateria = async (e) => {
    e.preventDefault();
    if (soloLectura) { mostrarNotificacion("Tu perfil es de solo lectura.", "error"); return; }

    if (!nombreMateria.trim()) {
      setMensaje("El nombre de la materia es obligatorio.");
      return;
    }

    if (!idCarreraMateria) {
      setMensaje("Seleccioná una carrera.");
      return;
    }

    try {
      const respuesta = await adminFetch(
        materiaEditando ? `${API_URL}/materias/${materiaEditando.id_materia}` : `${API_URL}/materias/`,
        {
          method: materiaEditando ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAdminHeaders(),
          },
          body: JSON.stringify({
            nombre_materia: nombreMateria.trim(),
            id_carrera: Number(idCarreraMateria),
            hora_inicio: horaInicioMateria || null,
            hora_fin: horaFinMateria || null,
          }),
        },
      );

      const datos = await respuesta
        .json()
        .catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          detalleErrorApi(datos?.detail, "No se pudo crear la materia."),
        );
      }

      setMensaje("");

      mostrarNotificacion(
        materiaEditando ? "La materia fue actualizada correctamente." : "La materia fue creada correctamente.",
      );

      setMateriaEditando(null);
      setNombreMateria("");
      setHoraInicioMateria("");
      setHoraFinMateria("");
      setIdCarreraMateria("");
      setMostrarMateriaFormulario(false);
    setIdCarreraMateria("");

      await cargarMaterias();
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message ||
          "No se pudo crear la materia.",
      );
    }
  };

  const editarMateria = (materia) => {
    setMateriaEditando(materia);
    setNombreMateria(materia.nombre_materia || "");
    setIdCarreraMateria(String(materia.id_carrera || ""));
    setHoraInicioMateria(materia.hora_inicio || "");
    setHoraFinMateria(materia.hora_fin || "");
    setMensaje("");
    setMostrarMateriaFormulario(true);
  };

  const eliminarMateria = async (
    materia,
  ) => {
    if (!puedeEliminar) { mostrarNotificacion("Tu perfil no permite eliminar registros.", "error"); return; }
    const confirmar = window.confirm(
      `¿Deseás eliminar la materia "${materia.nombre_materia}"?`,
    );

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await adminFetch(
        `${API_URL}/materias/${materia.id_materia}`,
        {
          method: "DELETE",
          headers: getAdminHeaders(),
        },
      );

      const datos = await respuesta
        .json()
        .catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          detalleErrorApi(datos?.detail, "No se pudo eliminar la materia."),
        );
      }

      setMensaje("");

      mostrarNotificacion(
        "La materia fue eliminada correctamente.",
      );

      await cargarMaterias();
    } catch (error) {
      console.error(error);

      setMensaje(
        error.message ||
          "No se pudo eliminar la materia.",
      );
    }
  };

  const exportarProfesor = async (persona) => {
    try {
      const [respAsistencias, respAsignaciones, respMaterias] = await Promise.all([
        adminFetch(`${API_URL}/asistencias/?id_usuario=${persona.id_usuario}`),
        adminFetch(`${API_URL}/docente-materia/?id_usuario=${persona.id_usuario}`),
        adminFetch(`${API_URL}/materias/?incluir_inactivos=true`),
      ]);

      if (!respAsistencias.ok || !respAsignaciones.ok || !respMaterias.ok) {
        throw new Error("No se pudieron obtener todos los datos del profesor.");
      }

      const asistencias = await respAsistencias.json();
      const asignacionesProfesor = await respAsignaciones.json();
      const todasMaterias = await respMaterias.json();

      const materiaPorId = Object.fromEntries(todasMaterias.map((m) => [m.id_materia, m]));
      const filas = [
        ["Profesor", `${persona.nombre} ${persona.apellido}`],
        ["Usuario", persona.usuario || ""],
        ["Tipo", "Docente"],
        [],
        ["Fecha", "Día", "Materia", "Carrera", "Entrada", "Salida", "Tema dictado"],
      ];

      for (const registro of asistencias) {
        const materia = materiaPorId[registro.id_materia];
        const carrera = carreras.find((c) => c.id_carrera === materia?.id_carrera);
        filas.push([
          formatearFecha(registro.fecha_hora_entrada),
          obtenerDiaFecha(registro.fecha_hora_entrada),
          materia?.nombre_materia || "Materia no disponible",
          carrera?.nombre_carrera || "Carrera no disponible",
          formatearHora(registro.fecha_hora_entrada),
          formatearHora(registro.fecha_hora_salida),
          registro.tema_dictado || "",
        ]);
      }

      filas.push([], ["Asignaciones actuales"], ["Materia", "Día", "Carrera"]);
      for (const asignacion of asignacionesProfesor) {
        const materia = materiaPorId[asignacion.id_materia];
        const carrera = carreras.find((c) => c.id_carrera === materia?.id_carrera);
        filas.push([materia?.nombre_materia || "", asignacion.dia_semana || "", carrera?.nombre_carrera || ""]);
      }

      const csv = filas.map((fila) => fila.map((valor) => {
        const texto = String(valor ?? "").replace(/"/g, '""');
        return `"${texto}"`;
      }).join(",")).join("\r\n");

      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `Profesor_${persona.apellido}_${persona.nombre}_asistencias.csv`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      mostrarNotificacion("El informe del profesor fue exportado correctamente.");
    } catch (error) {
      console.error(error);
      mostrarNotificacion(error.message || "No se pudo exportar el informe.", "error");
    }
  };

  const iniciarAdministracion = async (event) => {
    event.preventDefault();

    if (cargandoAdministracion) return;

    if (!usuarioAdministracion.trim() || !claveAdministracion) {
      setErrorAdministracion("Ingresá el usuario y la contraseña.");
      return;
    }

    try {
      setCargandoAdministracion(true);
      setErrorAdministracion("");

      const respuesta = await adminFetch(`${API_URL}/usuarios/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: usuarioAdministracion.trim(),
          contrasenia: claveAdministracion,
        }),
      });

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        throw new Error(detalleErrorApi(datos?.detail, "Usuario o contraseña incorrectos."));
      }

      if (datos?.usuario?.rol !== "admin" || !datos?.token) {
        throw new Error("Este usuario no tiene permisos de administración.");
      }

      actualizarAdminSession(datos.token);
      const rolAcceso = datos.usuario.rol_acceso || "superadmin";
      sessionStorage.setItem("ies_rol_acceso", rolAcceso);
      setRolAccesoActual(rolAcceso);
      setMostrarAdministracion(true);
      setMensaje("");
      // Refrescar datos con la sesión recién obtenida; adminFetch agrega el token.
      await Promise.all([
        cargarPersonal(seccion),
        cargarMaterias(),
        cargarCarreras(),
      ]);
      setClaveAdministracion("");
    } catch (error) {
      setErrorAdministracion(error.message || "No se pudo iniciar sesión.");
    } finally {
      setCargandoAdministracion(false);
    }
  };

  const cerrarAdministracion = () => {
    const tokenActual = sessionStorage.getItem("ies_admin_session");
    if (tokenActual) adminFetch(`${API_URL}/usuarios/logout`, { method: "POST", headers: { "X-Admin-Session": tokenActual } }).catch(() => {});
    actualizarAdminSession(null);
    sessionStorage.removeItem("ies_rol_acceso");
    setRolAccesoActual("superadmin");
    setMostrarAdministracion(false);
    setUsuarioAdministracion("");
    setClaveAdministracion("");
    setErrorAdministracion("");
    setSeccion("docente");
    setMostrarFormulario(false);
    setEditando(null);
  };

  const obtenerSaludo = () => {
    const hora = new Date().getHours();

    if (hora >= 6 && hora < 12) {
      return "Buenos días";
    }

    if (hora >= 12 && hora < 19) {
      return "Buenas tardes";
    }

    return "Buenas noches";
  };

  const personalFiltrado = personal.filter(
    (persona) => {
      const texto =
        busquedaPersonal
          .trim()
          .toLowerCase();

      if (!texto) return true;

      return [
        persona.id_usuario,
        persona.nombre,
        persona.apellido,
        persona.usuario,
        persona.tipo_empleado,
      ]
        .filter(Boolean)
        .some((valor) =>
          String(valor)
            .toLowerCase()
            .includes(texto),
        );
    },
  );

  const materiasFiltradas =
    materias.filter((materia) => {
      if (carreraFiltroMaterias !== "todas" && String(materia.id_carrera) !== String(carreraFiltroMaterias)) return false;
      const texto =
        busquedaMaterias
          .trim()
          .toLowerCase();

      if (!texto) return true;

      return [
        materia.id_materia,
        materia.nombre_materia,
      ]
        .filter(Boolean)
        .some((valor) =>
          String(valor)
            .toLowerCase()
            .includes(texto),
        );
    });

  return (
    <>
      {!mostrarAdministracion ? (
        <div className="admin-welcome">
          <div className="admin-welcome-card admin-login-card">
            <div className="admin-welcome-logo">
              <img
                src={logoIES}
                alt="Logo del IES"
              />
            </div>

            <span className="admin-login-kicker">ACCESO ADMINISTRATIVO</span>
            <h1>{obtenerSaludo()}</h1>

            <p>Ingresá con el usuario y la contraseña de administración.</p>

            <form className="admin-login-form" onSubmit={iniciarAdministracion}>
              <label htmlFor="admin-usuario">Usuario</label>
              <input
                id="admin-usuario"
                type="text"
                value={usuarioAdministracion}
                onChange={(e) => {
                  setUsuarioAdministracion(e.target.value);
                  setErrorAdministracion("");
                }}
                placeholder="Usuario administrador"
                autoComplete="username"
                autoFocus
              />

              <label htmlFor="admin-clave">Contraseña</label>
              <div className="admin-password-wrap">
                <input
                  id="admin-clave"
                  type={mostrarClaveAdmin ? "text" : "password"}
                  value={claveAdministracion}
                  onChange={(e) => {
                    setClaveAdministracion(e.target.value);
                    setErrorAdministracion("");
                  }}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setMostrarClaveAdmin((valor) => !valor)}
                  aria-label={mostrarClaveAdmin ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={mostrarClaveAdmin ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {mostrarClaveAdmin ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="10" width="14" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      <path d="M12 14v2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="10" width="14" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 7.3-2.2" />
                      <path d="M12 14v2" />
                    </svg>
                  )}
                </button>
              </div>

              {errorAdministracion && (
                <div className="admin-login-error" role="alert">
                  {errorAdministracion}
                </div>
              )}

              <button
                type="submit"
                className="admin-welcome-button"
                disabled={cargandoAdministracion}
              >
                {cargandoAdministracion ? "Ingresando..." : "Ingresar a administración"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="admin-app">

          {notificacion.visible && (
            <div
              className={`admin-toast admin-toast-${notificacion.tipo}`}
              role="status"
              aria-live="polite"
            >
              <div className="admin-toast-icon">
                {notificacion.tipo === "success" ? "✓" : "!"}
              </div>

              <div className="admin-toast-content">
                <strong>
                  {notificacion.tipo ===
                  "success"
                    ? "Operación realizada"
                    : "Aviso"}
                </strong>

                <span>
                  {notificacion.mensaje}
                </span>
              </div>

              <button
                type="button"
                className="admin-toast-close"
                onClick={
                  cerrarNotificacion
                }
                aria-label="Cerrar notificación"
              >
                ×
              </button>
            </div>
          )}

          <header className="admin-header">
            <div className="admin-header-content">
              <h1 className="admin-header-title">
                Administración
              </h1>

              <p className="admin-header-subtitle">
                Gestión de personal, materias
                y asistencias
              </p>
            </div>

            {!esMaterias &&
              !esAsistencias &&
              !esReportes &&
              !esLicencias &&
              !esPapelera &&
              !esAdministradores && (
                <div className="admin-header-action">
                  <button
                    type="button"
                    className="admin-primary-button"
                    onClick={nuevoPersonal}
                    disabled={soloLectura}
                  >
                    Nuevo personal
                  </button>
                </div>
              )}

            {esMaterias && (
              <div
                className="admin-header-action"
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="admin-secondary-button"
                  disabled={soloLectura}
                  onClick={() => {
                    setNombreCarrera("");
                    setMensaje("");
                    setMostrarCarreraFormulario(true);
                  }}
                >
                  Nueva carrera
                </button>

                <button
                  type="button"
                  className="admin-primary-button"
                  disabled={soloLectura}
                  onClick={() => {
                    setNombreMateria("");
                    setIdCarreraMateria("");
                    setMensaje("");
                    setMateriaEditando(null);
                    setNombreMateria(""); setIdCarreraMateria(""); setHoraInicioMateria(""); setHoraFinMateria("");
                    setMostrarMateriaFormulario(true);
                  }}
                >
                  Nueva materia
                </button>
              </div>
            )}
          
            <button
              type="button"
              className="admin-logout-button"
              onClick={cerrarAdministracion}
            >
              Cerrar sesión
            </button>
</header>

          <nav
            className="admin-navbar"
            aria-label="Navegación principal"
          >
            <button
              type="button"
              className={`admin-nav-button ${
                esDocente ? "active" : ""
              }`}
              onClick={() =>
                cambiarSeccion(
                  "docente",
                )
              }
            >
              Docentes
            </button>

            <button
              type="button"
              className={`admin-nav-button ${
                esNoDocente ? "active" : ""
              }`}
              onClick={() =>
                cambiarSeccion(
                  "no_docente",
                )
              }
            >
              Personal
            </button>

            <button
              type="button"
              className={`admin-nav-button ${
                esMaterias ? "active" : ""
              }`}
              onClick={() =>
                cambiarSeccion(
                  "materias",
                )
              }
            >
              Materias
            </button>

            <button
              type="button"
              className={`admin-nav-button ${
                esAsistencias
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                cambiarSeccion(
                  "asistencias",
                )
              }
            >
              Asistencias
            </button>

            <button
              type="button"
              className={`admin-nav-button ${esReportes ? "active" : ""}`}
              onClick={() => cambiarSeccion("reportes")}
            >
              Informes
            </button>

            <button
              type="button"
              className={`admin-nav-button ${esLicencias ? "active" : ""}`}
              onClick={() => cambiarSeccion("licencias")}
            >
              Inasistencias
            </button>

            <button
              type="button"
              className={`admin-nav-button ${esPapelera ? "active" : ""}`}
              onClick={() => cambiarSeccion("papelera")}
            >
              🗑️ Papelera
            </button>

            <button
              type="button"
              className={`admin-nav-button ${esAdministradores ? "active" : ""}`}
              onClick={() => cambiarSeccion("administradores")}
            >
              Usuarios admin
            </button>
          </nav>

          <main className={`admin-content role-${rolAccesoActual}`}>
            {mensaje && (
              <div
                className={`admin-alert ${
                  mensaje.startsWith(
                    "No ",
                  ) ||
                  mensaje.startsWith(
                    "El usuario",
                  ) ||
                  mensaje.startsWith(
                    "La fecha",
                  )
                    ? "admin-alert-error"
                    : "admin-alert-success"
                }`}
              >
                {mensaje}
              </div>
            )}

            {!esMaterias &&
              !esAsistencias &&
              !esReportes &&
              !esLicencias &&
              !esPapelera &&
              !esAdministradores && (
                <>
                  <div className="admin-content-header">
                    <div>
                      <span className="admin-content-kicker">
                        PERSONAL
                      </span>

                      <h2 className="admin-content-title">
                        {esDocente
                          ? "Docentes"
                          : "Personal"}
                      </h2>

                      <p className="admin-content-description">
                        Administración de
                        datos, usuarios y
                        accesos del personal
                        institucional.
                      </p>
                    </div>
                  </div>

                  <section className="admin-card admin-personal-card">
                    <div className="admin-card-header">
                      <div>
                        <h2>
                          {esDocente
                            ? "Personal docente registrado"
                            : "Personal registrado"}
                        </h2>

                        <p>
                          {busquedaPersonal.trim()
                            ? `${personalFiltrado.length} de ${personal.length} registros`
                            : `${personal.length} registros disponibles`}
                        </p>
                      </div>
                    </div>

                    <div className="admin-search-panel">
                      <label
                        className="admin-search-label"
                        htmlFor="busquedaPersonal"
                      >
                        Buscar personal
                      </label>

                      <div className="admin-search-box">
                        <svg
                          className="admin-search-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <circle
                            cx="11"
                            cy="11"
                            r="7"
                          />

                          <path d="m20 20-4-4" />
                        </svg>

                        <input
  id="busquedaPersonal"
  type="text"
                          value={
                            busquedaPersonal
                          }
                          onChange={(e) =>
                            setBusquedaPersonal(
                              e.target.value,
                            )
                          }
                          placeholder="Buscar por nombre, apellido o usuario..."
                          autoComplete="off"
                        />

                        {busquedaPersonal && (
                          <button
                            type="button"
                            className="admin-search-clear"
                            onClick={() =>
                              setBusquedaPersonal(
                                "",
                              )
                            }
                            aria-label="Limpiar búsqueda"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    {personal.length ===
                    0 ? (
                      <div className="admin-empty-state">
                        <p>
                          No hay registros para
                          mostrar.
                        </p>
                      </div>
                    ) : personalFiltrado.length ===
                      0 ? (
                      <div className="admin-empty-state">
                        <p>
                          No se encontraron
                          registros con esa
                          búsqueda.
                        </p>
                      </div>
                    ) : (
                      <div className="admin-table-wrapper">
                        <table className="admin-table admin-personal-table">
                          <thead>
                            <tr>
                              <th>
                                Nombre
                              </th>

                              <th>
                                Apellido
                              </th>

                              <th>
                                Usuario
                              </th>

                              <th>
                                Tipo
                              </th>

                              <th>
                                Acciones
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {personalFiltrado.map(
                              (persona) => (
                                <tr
                                  key={
                                    persona.id_usuario
                                  }
                                >
                                  <td data-label="Nombre">
                                    <strong>
                                      {
                                        persona.nombre
                                      }
                                    </strong>
                                  </td>

                                  <td data-label="Apellido">
                                    {
                                      persona.apellido
                                    }
                                  </td>

                                  <td data-label="Usuario">
                                    {
                                      persona.usuario ||
                                      "—"
                                    }
                                  </td>

                                  <td data-label="Tipo">
                                    <span
                                      className={`admin-badge ${
                                        persona.tipo_empleado ===
                                        "no_docente"
                                          ? "admin-badge-no-docente"
                                          : "admin-badge-docente"
                                      }`}
                                    >
                                      {persona.tipo_empleado ===
                                      "no_docente"
                                        ? "Personal"
                                        : "Docente"}
                                    </span>
                                  </td>

                                  <td data-label="Acciones">
                                    <div className="admin-actions">
                                      <button
                                        type="button"
                                        className="admin-table-button admin-action-edit"
                                        disabled={soloLectura}
                                        onClick={() =>
                                          editarPersonal(
                                            persona,
                                          )
                                        }
                                      >
                                        Editar
                                      </button>

                                      {esDocente && (
                                        <button
                                          type="button"
                                          className="admin-table-button admin-action-info"
                                          onClick={() => abrirMaterias(persona)}
                                        >
                                          Materias
                                        </button>
                                      )}

                                      {esDocente && (
                                        <button
                                          type="button"
                                          className="admin-table-button admin-action-export"
                                          onClick={() => exportarProfesor(persona)}
                                        >
                                          Exportar
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        className="admin-table-button danger"
                                        disabled={!puedeEliminar}
                                        onClick={() =>
                                          eliminarPersonal(
                                            persona,
                                          )
                                        }
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}

            {esLicencias && (
              <Licencias mostrarNotificacion={mostrarNotificacion} rolAcceso={rolAccesoActual} />
            )}

            {esAdministradores && (
              <>
                <div className="admin-content-header">
                  <div>
                    <span className="admin-content-kicker">SEGURIDAD</span>
                    <h2 className="admin-content-title">Usuarios administrativos</h2>
                    <p className="admin-content-description">Gestioná los accesos al panel. Se permiten hasta 3 usuarios administrativos activos.</p>
                  </div>
                  <button type="button" className="admin-primary-button" onClick={abrirNuevoAdministrador} disabled={administradores.length >= 3 || soloLectura || !puedeEliminar}>
                    Nuevo administrador
                  </button>
                </div>
                <section className="admin-card admin-admins-card">
                  <div className="admin-card-header">
                    <div>
                      <h2>Administradores activos</h2>
                      <p>{administradores.length} de 3 administradores utilizados.</p>
                    </div>
                    <span className="admin-counter">{administradores.length}/3</span>
                  </div>
                  {administradores.length === 0 ? (
                    <div className="admin-empty-state"><p>No hay administradores activos.</p></div>
                  ) : (
                    <div className="admin-admin-list">
                      {administradores.map((admin) => (
                        <article className="admin-admin-item" key={admin.id_usuario}>
                          <div className="admin-admin-data">
                            <strong>{admin.nombre} {admin.apellido}</strong>
                            <span>Usuario: <b>{admin.usuario}</b></span>
                            <span>Permisos: <b>{({superadmin:"Administrador principal", lector:"Solo lectura", editor:"Edición limitada"})[admin.rol_acceso] || "Administrador principal"}</b></span>
                          </div>
                          <div className="admin-actions admin-admin-actions">
                            <button type="button" className="admin-table-button admin-action-edit" onClick={() => editarAdministrador(admin)} disabled={soloLectura || !puedeEliminar}>Editar</button>
                            <button type="button" className="admin-table-button danger" onClick={() => eliminarAdministrador(admin)} disabled={!puedeEliminar}>Desactivar</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {esPapelera && (
              <>
                <div className="admin-content-header">
                  <div>
                    <span className="admin-content-kicker">HISTORIAL</span>
                    <h2 className="admin-content-title">Papelera</h2>
                    <p className="admin-content-description">
                      Personal desactivado mediante baja lógica. Los registros históricos se conservan y pueden recuperarse.
                    </p>
                  </div>
                </div>

                <section className="admin-card">
                  <div className="admin-card-header">
                    <div>
                      <h2>Personal desactivado</h2>
                      <p>{personalPapelera.length} registros en papelera</p>
                    </div>
                    <button type="button" className="admin-secondary-button" onClick={cargarPapelera}>Actualizar</button>
                  </div>

                  {personalPapelera.length === 0 ? (
                    <div className="admin-empty-state">
                      <p>La papelera está vacía.</p>
                    </div>
                  ) : (
                    <div className="admin-table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Nombre</th>
                            <th>Apellido</th>
                            <th>Usuario</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {personalPapelera.map((persona) => (
                            <tr key={persona.id_usuario}>
                              <td data-label="Nombre"><strong>{persona.nombre}</strong></td>
                              <td data-label="Apellido">{persona.apellido}</td>
                              <td data-label="Usuario">{persona.usuario || "—"}</td>
                              <td data-label="Tipo">{persona.tipo_empleado === "no_docente" ? "Personal" : "Docente"}</td>
                              <td data-label="Estado"><span className="admin-badge admin-badge-inactivo">Inactivo</span></td>
                              <td data-label="Acción">
                                <button type="button" className="admin-table-button admin-action-restore" disabled={soloLectura} onClick={() => reactivarPersonal(persona)}>
                                  ♻️ Reactivar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            {esMaterias && (
              <>
                <div className="admin-content-header">
                  <div>
                    <span className="admin-content-kicker">
                      ACADÉMICO
                    </span>

                    <h2 className="admin-content-title">
                      Carreras y materias
                    </h2>

                    <p className="admin-content-description">
                      Cada materia pertenece a una sola carrera. Elegí una carrera para consultar únicamente sus materias.
                    </p>
                  </div>
                </div>

                <section className="admin-card career-catalog-card">
                  <div className="admin-card-header">
                    <div><h2>Carreras registradas</h2><p>{carreras.length} carreras activas. Seleccioná una para filtrar sus materias.</p></div>
                  </div>
                  <div className="career-filter-list" role="group" aria-label="Filtrar materias por carrera">
                    <button type="button" className={`career-filter-button ${carreraFiltroMaterias === "todas" ? "active" : ""}`} onClick={() => setCarreraFiltroMaterias("todas")}>Todas las carreras <span>{materias.length}</span></button>
                    {carreras.map((carrera) => {
                      const cantidad = materias.filter((m) => String(m.id_carrera) === String(carrera.id_carrera)).length;
                      return <button type="button" key={carrera.id_carrera} className={`career-filter-button ${String(carreraFiltroMaterias) === String(carrera.id_carrera) ? "active" : ""}`} onClick={() => setCarreraFiltroMaterias(String(carrera.id_carrera))}>{carrera.nombre_carrera}<span>{cantidad}</span></button>;
                    })}
                  </div>
                </section>

                <section className="admin-card">
                  <div className="admin-card-header">
                    <div>
                      <h2>
                        {carreraFiltroMaterias === "todas" ? "Materias registradas" : `Materias de ${carreras.find((c) => String(c.id_carrera) === String(carreraFiltroMaterias))?.nombre_carrera || "la carrera seleccionada"}`}
                      </h2>

                      <p>
                        {carreraFiltroMaterias !== "todas"
                          ? `${materiasFiltradas.length} materias de esta carrera`
                          : busquedaMaterias.trim()
                            ? `${materiasFiltradas.length} de ${materias.length} materias`
                            : `${materias.length} materias disponibles`}
                      </p>
                    </div>
                  </div>

                  <div className="admin-search-panel">
                    <label
                      className="admin-search-label"
                      htmlFor="busquedaMaterias"
                    >
                      Buscar materia
                    </label>

                    <div className="admin-search-box">
                      <svg
                        className="admin-search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle
                          cx="11"
                          cy="11"
                          r="7"
                        />

                        <path d="m20 20-4-4" />
                      </svg>

                      <input
  id="busquedaMaterias"
  type="text"
                        value={
                          busquedaMaterias
                        }
                        onChange={(e) =>
                          setBusquedaMaterias(
                            e.target.value,
                          )
                        }
                        placeholder="Buscar por nombre de materia..."
                        autoComplete="off"
                      />

                      {busquedaMaterias && (
                        <button
                          type="button"
                          className="admin-search-clear"
                          onClick={() =>
                            setBusquedaMaterias(
                              "",
                            )
                          }
                          aria-label="Limpiar búsqueda"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {materias.length === 0 ? (
                    <div className="admin-empty-state">
                      <p>
                        No hay materias
                        registradas.
                      </p>
                    </div>
                  ) : materiasFiltradas.length ===
                    0 ? (
                    <div className="admin-empty-state">
                      <p>
                        No se encontraron
                        materias con esa
                        búsqueda.
                      </p>
                    </div>
                  ) : (
                    <div className="admin-table-wrapper materias-admin">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>
                              Materia
                            </th>
                            <th>
                              Carrera
                            </th>
                            <th>
                              Acciones
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {materiasFiltradas.map(
                            (materia) => (
                              <tr
                                key={
                                  materia.id_materia
                                }
                              >
                                <td data-label="Materia">
                                  <strong>{materia.nombre_materia}</strong>
                                  <small className="materia-horario">{materia.hora_inicio || materia.hora_fin ? `${materia.hora_inicio || "--:--"} a ${materia.hora_fin || "--:--"}` : "Horario sin definir"}</small>
                                </td>
                                <td data-label="Carrera">
                                  {carreras.find((c) => c.id_carrera === materia.id_carrera)?.nombre_carrera || "—"}
                                </td>

                                <td data-label="Acciones">
                                  <div className="admin-actions">
                                    <button type="button" className="admin-table-button admin-action-edit" disabled={soloLectura} onClick={() => editarMateria(materia)}>Editar</button>
                                    <button
                                      type="button"
                                      className="admin-table-button danger"
                                      disabled={!puedeEliminar}
                                      onClick={() =>
                                        eliminarMateria(
                                          materia,
                                        )
                                      }
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            {esAsistencias && (
              <PantallaAsistencias />
            )}

            {esReportes && (
              <Reportes mostrarNotificacion={mostrarNotificacion} rolAcceso={rolAccesoActual} />
            )}
          </main>

          <Modal
            abierto={mostrarFormulario}
            titulo={
              editando
                ? "Editar personal"
                : "Nuevo personal"
            }
            subtitulo={
              editando
                ? "Actualizá los datos del registro seleccionado."
                : "Completá los datos para registrar una nueva persona."
            }
            onCerrar={() => {
              setMostrarFormulario(false);
              setEditando(null);
              setFormulario(
                formularioVacio,
              );
            }}
          >
            <form
              className="admin-form"
              onSubmit={guardarPersonal}
            >
              <div className="admin-form-grid">
                <div className="admin-field">
                  <label htmlFor="nombre">
                    Nombre
                  </label>

                  <input
                    id="nombre"
                    type="text"
                    name="nombre"
                    value={
                      formulario.nombre
                    }
                    onChange={
                      manejarCambio
                    }
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="admin-field">
                  <label htmlFor="apellido">
                    Apellido
                  </label>

                  <input
                    id="apellido"
                    type="text"
                    name="apellido"
                    value={
                      formulario.apellido
                    }
                    onChange={
                      manejarCambio
                    }
                    autoComplete="off"
                    required
                  />
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="tipo_empleado">
                  Tipo de personal
                </label>

                <select
                  id="tipo_empleado"
                  name="tipo_empleado"
                  value={
                    formulario.tipo_empleado
                  }
                  onChange={
                    manejarCambio
                  }
                >
                  <option value="docente">
                    Docente
                  </option>

                  <option value="no_docente">
                    Personal
                  </option>
                </select>
              </div>

              <div className="admin-field">
                <label htmlFor="usuario">
                  Usuario
                </label>

                <input
                  id="usuario"
                  type="text"
                  name="usuario"
                  value={
                    formulario.usuario
                  }
                  onChange={
                    manejarCambio
                  }
                  autoComplete="off"
                  required={!editando}
                />

                {editando && (
                  <span className="admin-field-help">
                    Podés dejar el usuario
                    actual sin modificar.
                  </span>
                )}
              </div>

              <div className="admin-field">
                <label htmlFor="contrasenia">
                  {editando
                    ? "Nueva contraseña"
                    : "Contraseña"}
                </label>

                <div className="admin-password-wrap">
                  <input
                    id="contrasenia"
                    type={mostrarClavePersonal ? "text" : "password"}
                    name="contrasenia"
                    value={formulario.contrasenia}
                    onChange={manejarCambio}
                    autoComplete="new-password"
                    required={!editando}
                    minLength={6}
                    placeholder={editando ? "Dejar vacío para conservar la actual" : "Mínimo 6 caracteres (letra y número)"}
                  />
                  <button type="button" className="admin-password-toggle" onClick={() => setMostrarClavePersonal((valor) => !valor)} aria-label={mostrarClavePersonal ? "Ocultar contraseña" : "Mostrar contraseña"} title={mostrarClavePersonal ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {mostrarClavePersonal ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <small className="admin-field-hint">Mínimo 6 caracteres, con una letra y un número. Al editar, dejala vacía para conservar la contraseña actual.</small>
              </div>

              <div className="admin-form-footer">
                <button
                  type="button"
                  className="admin-outline-button"
                  onClick={() => {
                    setMostrarFormulario(
                      false,
                    );

                    setEditando(null);

                    setFormulario(
                      formularioVacio,
                    );
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                >
                  {editando
                    ? "Guardar cambios"
                    : "Registrar personal"}
                </button>
              </div>
            </form>
          </Modal>

          <Modal
            abierto={mostrarFormularioAdmin}
            titulo={adminEditando ? "Editar administrador" : "Nuevo administrador"}
            subtitulo="Los administradores tienen acceso al panel de gestión."
            onCerrar={() => { setMostrarFormularioAdmin(false); setAdminEditando(null); setFormularioAdmin({ nombre: "", apellido: "", usuario: "", contrasenia: "", rol_acceso: "superadmin" }); setMostrarClaveAdmin(false); }}
          >
            <form className="admin-form" onSubmit={guardarAdministrador}>
              <div className="admin-form-grid">
                <div className="admin-field"><label htmlFor="admin-nombre">Nombre</label><input id="admin-nombre" value={formularioAdmin.nombre} onChange={(e) => setFormularioAdmin({ ...formularioAdmin, nombre: e.target.value })} required /></div>
                <div className="admin-field"><label htmlFor="admin-apellido">Apellido</label><input id="admin-apellido" value={formularioAdmin.apellido} onChange={(e) => setFormularioAdmin({ ...formularioAdmin, apellido: e.target.value })} required /></div>
              </div>
              <div className="admin-field"><label htmlFor="admin-usuario-form">Usuario</label><input id="admin-usuario-form" value={formularioAdmin.usuario} onChange={(e) => setFormularioAdmin({ ...formularioAdmin, usuario: e.target.value })} autoComplete="username" required /></div>
              <div className="admin-field"><label htmlFor="admin-rol">Permisos del usuario</label><select id="admin-rol" value={formularioAdmin.rol_acceso} onChange={(e) => setFormularioAdmin({ ...formularioAdmin, rol_acceso: e.target.value })}><option value="superadmin">Administrador principal: todos los permisos</option><option value="lector">Solo lectura: consultar sin modificar</option><option value="editor">Edición limitada: crear y editar</option></select></div>
              <div className="admin-field"><label htmlFor="admin-clave-form">{adminEditando ? "Nueva contraseña (opcional)" : "Contraseña"}</label>
                <div className="admin-password-wrap"><input id="admin-clave-form" type={mostrarClaveAdmin ? "text" : "password"} value={formularioAdmin.contrasenia} onChange={(e) => setFormularioAdmin({ ...formularioAdmin, contrasenia: e.target.value })} autoComplete="new-password" required={!adminEditando} minLength={6} placeholder={adminEditando ? "Dejar vacío para conservar la actual" : "Mínimo 6 caracteres (letra y número)"} /><button type="button" className="admin-password-toggle" onClick={() => setMostrarClaveAdmin((valor) => !valor)}>{mostrarClaveAdmin ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="10" width="14" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      <path d="M12 14v2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="10" width="14" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 7.3-2.2" />
                      <path d="M12 14v2" />
                    </svg>
                  )}</button></div>
              </div>
              <div className="admin-form-footer"><button type="button" className="admin-outline-button" onClick={() => { setMostrarFormularioAdmin(false); setAdminEditando(null); }}>Cancelar</button><button type="submit" className="admin-primary-button">{adminEditando ? "Guardar cambios" : "Crear administrador"}</button></div>
            </form>
          </Modal>

          <Modal
            abierto={mostrarCarreraFormulario}
            titulo="Nueva carrera"
            subtitulo="Registrá una nueva carrera en el sistema."
            onCerrar={() => {
              setMostrarCarreraFormulario(false);
              setNombreCarrera("");
            }}
          >
            <form
              className="admin-form"
              onSubmit={crearCarrera}
            >
              <div className="admin-field">
                <label htmlFor="nombreCarrera">
                  Nombre de la carrera
                </label>

                <input
                  id="nombreCarrera"
                  type="text"
                  value={nombreCarrera}
                  onChange={(e) =>
                    setNombreCarrera(e.target.value)
                  }
                  placeholder="Ejemplo: Tecnicatura Superior en Administración"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="admin-form-footer">
                <button
                  type="button"
                  className="admin-outline-button"
                  onClick={() => {
                    setMostrarCarreraFormulario(false);
                    setNombreCarrera("");
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                >
                  Registrar carrera
                </button>
              </div>
            </form>
          </Modal>

          <Modal
            abierto={
              mostrarMateriaFormulario
            }
            titulo={materiaEditando ? "Editar materia" : "Nueva materia"}
            subtitulo={materiaEditando ? "Actualizá los datos y el horario de la materia." : "Registrá una nueva materia en el sistema."}
            onCerrar={() => {
              setMostrarMateriaFormulario(false);
              setMateriaEditando(null);
              setNombreMateria(""); setIdCarreraMateria(""); setHoraInicioMateria(""); setHoraFinMateria("");
            }}
          >
            <form
              className="admin-form"
              onSubmit={crearMateria}
            >
              <div className="admin-field">
                <label htmlFor="nombreMateria">Nombre de la materia</label>
                <input
                  id="nombreMateria"
                  type="text"
                  value={nombreMateria}
                  onChange={(e) => setNombreMateria(e.target.value)}
                  placeholder="Ejemplo: Base de Datos"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="admin-field">
                <label htmlFor="carreraMateria">Carrera</label>
                <select
                  id="carreraMateria"
                  value={idCarreraMateria}
                  onChange={(e) => setIdCarreraMateria(e.target.value)}
                  required
                >
                  <option value="">Seleccionar carrera</option>
                  {carreras.map((carrera) => (
                    <option key={carrera.id_carrera} value={carrera.id_carrera}>
                      {carrera.nombre_carrera}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-grid">
                <div className="admin-field">
                  <label htmlFor="horaInicioMateria">Hora de inicio</label>
                  <input id="horaInicioMateria" type="time" value={horaInicioMateria} onChange={(e) => setHoraInicioMateria(e.target.value)} />
                </div>
                <div className="admin-field">
                  <label htmlFor="horaFinMateria">Hora de finalización</label>
                  <input id="horaFinMateria" type="time" value={horaFinMateria} onChange={(e) => setHoraFinMateria(e.target.value)} />
                </div>
              </div>
              <p className="admin-field-hint">El horario es informativo: el registro de entrada y salida seguirá habilitado a cualquier hora.</p>

              <div className="admin-form-footer">
                <button
                  type="button"
                  className="admin-outline-button"
                  onClick={() =>
                    setMostrarMateriaFormulario(
                      false,
                    )
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                >
                  {materiaEditando ? "Guardar cambios" : "Registrar materia"}
                </button>
              </div>
            </form>
          </Modal>

          <Modal
            abierto={Boolean(
              docenteSeleccionado,
            )}
            titulo="Asignación de materias"
            subtitulo={
              docenteSeleccionado
                ? `${docenteSeleccionado.nombre} ${docenteSeleccionado.apellido}`
                : ""
            }
            onCerrar={cerrarMaterias}
          >
            <div className="admin-assignment-header">
              <div>
                <h3>
                  Materias asignadas
                </h3>

                <p>
                  Seleccioná una materia y
                  marcá los días en los que
                  se dicta.
                </p>
              </div>
            </div>

            <form
              className="admin-assignment-form"
              onSubmit={asignarMateria}
            >
              <div className="admin-field">
                <label htmlFor="carreraAsignacion">Carrera</label>
                <select id="carreraAsignacion" value={idCarreraAsignacion} onChange={(e) => { setIdCarreraAsignacion(e.target.value); setMateriaSeleccionada(""); setDiasSeleccionados([]); }} required>
                  <option value="">Seleccionar carrera</option>
                  {carreras.map((carrera) => <option key={carrera.id_carrera} value={carrera.id_carrera}>{carrera.nombre_carrera}</option>)}
                </select>
              </div>

              <div className="admin-field">
                <label htmlFor="materiaAsignacion">
                  Materia
                </label>

                <select
                  id="materiaAsignacion"
                  value={materiaSeleccionada}
                  onChange={cambiarMateriaAsignacion}
                  required
                  disabled={!idCarreraAsignacion}
                >
                  <option value="">
                    Seleccionar materia
                  </option>

                  {materias.filter((materia) => idCarreraAsignacion && String(materia.id_carrera) === String(idCarreraAsignacion)).map((materia) => (
                    <option key={materia.id_materia} value={materia.id_materia}>{materia.nombre_materia}</option>
                  ))}
                </select>
              </div>

              <div className="admin-assignment-academic-grid">
                <div className="admin-field">
                  <label htmlFor="anioAsignacion">Año / curso</label>
                  <select id="anioAsignacion" value={anioAsignacion} onChange={(e) => setAnioAsignacion(e.target.value)} required>
                    <option value="">Seleccionar año</option>
                    <option value="1">1.º año</option>
                    <option value="2">2.º año</option>
                    <option value="3">3.º año</option>
                    <option value="4">4.º año</option>
                    <option value="5">5.º año</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="turnoAsignacion">Turno</label>
                  <select id="turnoAsignacion" value={turnoAsignacion} onChange={(e) => setTurnoAsignacion(e.target.value)} required>
                    <option value="">Seleccionar turno</option>
                    <option value="Mañana">Mañana</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noche">Noche</option>
                  </select>
                </div>
              </div>

              <div className="admin-assignment-days">
                <div className="admin-assignment-days-header">
                  <span className="admin-assignment-days-title">
                    Semana
                  </span>

                  <span className="admin-assignment-days-help">
                    Marcá uno o varios
                    días
                  </span>
                </div>

                <div
                  className="admin-weekdays"
                  role="group"
                  aria-label="Días de la semana"
                >
                  {DIAS.map((dia) => {
                    const seleccionado =
                      diasSeleccionados.includes(
                        dia,
                      );

                    const letras = {
                      Lunes: "L",
                      Martes: "M",
                      Miércoles: "M",
                      Jueves: "J",
                      Viernes: "V",
                    };

                    return (
                      <label
                        key={dia}
                        className={`admin-weekday ${
                          seleccionado
                            ? "selected"
                            : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            seleccionado
                          }
                          onChange={() =>
                            alternarDiaAsignacion(
                              dia,
                            )
                          }
                        />

                        <span
                          className="admin-weekday-letter"
                          data-letter={
                            letras[dia]
                          }
                          aria-hidden="true"
                        ></span>

                        <span className="admin-weekday-name">
                          {dia}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="admin-assignment-selection">
                  {diasSeleccionados.length ===
                  0
                    ? "No hay días seleccionados."
                    : `${diasSeleccionados.length} ${
                        diasSeleccionados.length ===
                        1
                          ? "día seleccionado"
                          : "días seleccionados"
                      }`}
                </div>
              </div>

              <button
                type="submit"
                className="admin-primary-button admin-confirm-button"
                disabled={
                  !materiaSeleccionada ||
                  diasSeleccionados.length ===
                    0
                }
              >
                Asignar materia
              </button>
            </form>

            <div className="admin-assignment-list">
              {cargandoAsignaciones ? (
                <div className="admin-empty-state compact">
                  <p>
                    Cargando asignaciones...
                  </p>
                </div>
              ) : asignaciones.length ===
                0 ? (
                <div className="admin-empty-state compact">
                  <p>
                    Este docente todavía no
                    tiene materias asignadas.
                  </p>
                </div>
              ) : (
                asignaciones.map(
                  (asignacion) => (
                    <div
                      className="admin-assignment-item"
                      key={
                        asignacion.id_docente_materia
                      }
                    >
                      <div>
                        <strong>
                          {obtenerNombreMateria(
                            asignacion.id_materia,
                          )}
                        </strong>

                        <span>
                          {asignacion.dia_semana} · {asignacion.anio ? `${asignacion.anio}.º año` : "Año no informado"} · {asignacion.turno || "Turno no informado"}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="admin-danger-button"
                        disabled={!puedeEliminar}
                        onClick={() =>
                          eliminarAsignacion(
                            asignacion.id_docente_materia,
                          )
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  ),
                )
              )}
            </div>
          </Modal>
        </div>
      )}
    </>
  );
}

export default App;
