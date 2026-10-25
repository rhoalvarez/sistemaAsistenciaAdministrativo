/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { adminFetch } from "./adminApi";
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
import { getAdminHeaders } from "./adminSession";
import { detalleErrorApi } from "./apiErrors";

const obtenerSemanaActual = () => {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const dia = (lunes.getDay() + 6) % 7;
  lunes.setDate(lunes.getDate() - dia);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { desde: iso(lunes), hasta: iso(fin) };
};

const clavePendiente = (item) => `${item.id_docente_materia}-${item.fecha}`;

const formatearFecha = (fecha) => {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
};

function Licencias({ mostrarNotificacion, rolAcceso = "superadmin" }) {
  const soloLectura = rolAcceso === "lector";
  const [pendientes, setPendientes] = useState([]);
  const [licencias, setLicencias] = useState([]);
  const [rangoSemana, setRangoSemana] = useState(obtenerSemanaActual);
  const [feriadosSemana, setFeriadosSemana] = useState([]);
  const [confirmaciones, setConfirmaciones] = useState({});
  const [observaciones, setObservaciones] = useState({});
  const [motivos, setMotivos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(null);

  const cargarPendientes = async (rangoElegido = rangoSemana) => {
    try {
      setCargando(true);
      const [pendientesR, licenciasR] = await Promise.all([
        adminFetch(`${API_URL}/licencias/pendientes?desde=${encodeURIComponent(rangoElegido.desde)}&hasta=${encodeURIComponent(rangoElegido.hasta)}`),
        adminFetch(`${API_URL}/licencias/`),
      ]);

      if (!pendientesR.ok || !licenciasR.ok) {
        throw new Error("No se pudo consultar el estado de las inasistencias.");
      }

      const datosPendientes = await pendientesR.json();
      const datosLicencias = await licenciasR.json();

      setRangoSemana({ desde: datosPendientes.desde || rangoElegido.desde, hasta: datosPendientes.hasta || rangoElegido.hasta });
      setFeriadosSemana(datosPendientes.feriados || []);
      setPendientes(datosPendientes.pendientes || []);
      setConfirmaciones({});
      setLicencias(datosLicencias);

      setObservaciones((actuales) => {
        const nuevas = {};
        (datosPendientes.pendientes || []).forEach((item) => {
          const clave = clavePendiente(item);
          nuevas[clave] = actuales[clave] || "";
        });
        return nuevas;
      });
    } catch (error) {
      setPendientes([]);
      mostrarNotificacion(
        error.message || "No se pudo consultar las inasistencias.",
        "error",
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPendientes();
  }, []);

  const cambiarObservacion = (idAsignacion, valor) => {
    setObservaciones((actuales) => ({
      ...actuales,
      [idAsignacion]: valor,
    }));
  };

  const guardarLicencia = async (pendiente) => {
    if (soloLectura) { mostrarNotificacion("Tu perfil es de solo lectura.", "error"); return; }
    const clave = clavePendiente(pendiente);
    if (!confirmaciones[clave]) {
      mostrarNotificacion("Marcá la casilla para confirmar que el docente no asistió.", "error");
      return;
    }
    const observacion = (observaciones[clave] || "").trim();

    if (!observacion) {
      mostrarNotificacion(
        "Escribí el motivo de la inasistencia antes de registrarla.",
        "error",
      );
      return;
    }

    try {
      setGuardando(clave);

      const respuesta = await adminFetch(`${API_URL}/licencias/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          id_usuario: pendiente.id_usuario,
          id_docente_materia: pendiente.id_docente_materia,
          fecha: pendiente.fecha,
          observacion,
          motivo_inasistencia: motivos[clave] || "Enfermedad",
        }),
      });

      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        throw new Error(detalleErrorApi(datos?.detail, "No se pudo registrar la inasistencia."));
      }

      mostrarNotificacion(
        `Inasistencia registrada para ${pendiente.nombre_docente}.`,
      );

      setObservaciones((actuales) => {
        const nuevas = { ...actuales };
        delete nuevas[clave];
        return nuevas;
      });
      setConfirmaciones((actuales) => ({ ...actuales, [clave]: false }));

      await cargarPendientes(rangoSemana);
    } catch (error) {
      mostrarNotificacion(
        error.message || "No se pudo registrar la inasistencia.",
        "error",
      );
    } finally {
      setGuardando(null);
    }
  };

  return (
    <section className="admin-card licencias-panel">
      <div className="admin-content-header">
        <div>
          <span className="admin-content-kicker">PERSONAL</span>
          <h2 className="admin-content-title">Inasistencias</h2>
          <p className="admin-content-description">
            Revisá las jornadas asignadas desde el lunes hasta hoy. Se muestran las que no tienen asistencia registrada, incluso si ya pasó el día, para que puedas dejar constancia y justificarla. La fecha de cada jornada es fija.
          </p>
        </div>
        <button
          type="button"
          className="admin-secondary-button no-print"
          onClick={cargarPendientes}
          disabled={cargando}
        >
          {cargando ? "Consultando..." : "Actualizar"}
        </button>
      </div>

      <div className="licencia-dia-resumen">
        <div>
          <span className="licencia-dia-kicker">CONTROL AUTOMÁTICO</span>
          <strong>
            Semana {formatearFecha(rangoSemana.desde)} al {formatearFecha(rangoSemana.hasta)}
          </strong>
        </div>
        <span className="admin-counter">
          {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"} de la semana
        </span>
      </div>

      {feriadosSemana.length > 0 && (
        <div className="licencia-feriado">
          <strong>📅 Feriados del período</strong>
          <span>{feriadosSemana.map((item) => `${formatearFecha(item.fecha)}: ${item.nombre}`).join(" · ")} — esos días no generan pendientes automáticos.</span>
        </div>
      )}

      {(
        <section className="licencia-pendientes">
          <div className="admin-data-block-header">
            <div>
              <span className="admin-section-kicker">SIN REGISTRO</span>
              <h3>Docentes que no registraron asistencia</h3>
            </div>
          </div>

          {cargando ? (
            <div className="admin-empty-state compact">
              <p>Consultando las jornadas del período...</p>
            </div>
          ) : pendientes.length === 0 ? (
            <div className="admin-empty-state compact">
              <p>No hay inasistencias pendientes de justificar en esta semana. Las jornadas ya registradas no se muestran aquí.</p>
            </div>
          ) : (
            <div className="licencia-pendientes-list">
              {pendientes.map((pendiente) => (
                <article
                  className="licencia-pendiente-card"
                  key={clavePendiente(pendiente)}
                >
                  <div className="licencia-pendiente-datos">
                    <span className="licencia-pendiente-etiqueta">PROFESOR</span>
                    <strong>{pendiente.nombre_docente}</strong>

                    <div className="licencia-pendiente-grid">
                      <div>
                        <span>Materia</span>
                        <strong>{pendiente.nombre_materia}</strong>
                      </div>
                      <div>
                        <span>Carrera</span>
                        <strong>{pendiente.nombre_carrera}</strong>
                      </div>
                      <div>
                        <span>Curso</span>
                        <strong>{pendiente.anio ? `${pendiente.anio}.º año` : "—"}</strong>
                      </div>
                      <div>
                        <span>Turno</span>
                        <strong>{pendiente.turno || "—"}</strong>
                      </div>
                      <div>
                        <span>Día</span>
                        <strong>{pendiente.dia_semana}</strong>
                      </div>
                      <div>
                        <span>Fecha</span>
                        <strong>{formatearFecha(pendiente.fecha)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="licencia-pendiente-motivo">
                    <label className="licencia-confirmacion" htmlFor={`confirmar-inasistencia-${clavePendiente(pendiente)}`}>
                      <input id={`confirmar-inasistencia-${clavePendiente(pendiente)}`} type="checkbox" checked={Boolean(confirmaciones[clavePendiente(pendiente)])} onChange={(e) => setConfirmaciones((actuales) => ({ ...actuales, [clavePendiente(pendiente)]: e.target.checked }))} />
                      Confirmo que el docente no asistió
                    </label>
                    <label htmlFor={`tipo-inasistencia-${clavePendiente(pendiente)}`}>Motivo de la inasistencia</label>
                    <select
                      id={`tipo-inasistencia-${clavePendiente(pendiente)}`}
                      value={motivos[clavePendiente(pendiente)] || "Enfermedad"}
                      onChange={(e) => setMotivos((actuales) => ({ ...actuales, [clavePendiente(pendiente)]: e.target.value }))}
                    >
                      <option value="Enfermedad">Enfermedad</option>
                      <option value="Licencia médica">Licencia médica</option>
                      <option value="Licencia personal">Licencia personal</option>
                      <option value="Trámite personal">Trámite personal</option>
                      <option value="Familiar">Motivo familiar</option>
                      <option value="Fuerza mayor">Fuerza mayor</option>
                      <option value="Otro">Otro</option>
                    </select>
                    <label htmlFor={`motivo-${clavePendiente(pendiente)}`}>Observación / detalle</label>
                    <textarea
                      id={`motivo-${clavePendiente(pendiente)}`}
                      value={observaciones[clavePendiente(pendiente)] || ""}
                      onChange={(e) =>
                        cambiarObservacion(
                          clavePendiente(pendiente),
                          e.target.value,
                        )
                      }
                      placeholder="Ej.: No asistió a clases por un motivo médico."
                      rows={3}
                    />
                    <button
                      type="button"
                      className="admin-primary-button"
                      onClick={() => guardarLicencia(pendiente)}
                      disabled={soloLectura || guardando === clavePendiente(pendiente) || !confirmaciones[clavePendiente(pendiente)] || !(observaciones[clavePendiente(pendiente)] || "").trim()}
                    >
                      {guardando === clavePendiente(pendiente)
                        ? "Guardando..."
                        : "Registrar inasistencia"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="admin-data-block licencia-historial">
        <div className="admin-data-block-header">
          <div>
            <span className="admin-section-kicker">HISTORIAL</span>
            <h3>Historial de inasistencias justificadas</h3>
          </div>
          <div className="reportes-header-actions no-print">
            <span className="admin-counter">{licencias.length} registros</span>
            <button
              type="button"
              className="admin-primary-button"
              onClick={() => window.print()}
            >
              Imprimir / Guardar PDF
            </button>
          </div>
        </div>

        {licencias.length === 0 ? (
          <div className="admin-empty-state compact">
            <p>No hay inasistencias registradas.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table licencia-tabla">
              <thead>
                <tr>
                  <th>Profesor</th>
                  <th>Fecha</th>
                  <th>Día</th>
                  <th>Materia</th>
                  <th>Carrera</th>
                  <th>Año</th>
                  <th>Turno</th>
                  <th>Motivo de inasistencia</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {licencias.map((licencia) => (
                  <tr key={licencia.id_licencia}>
                    <td data-label="Profesor"><strong>{licencia.nombre_docente}</strong></td>
                    <td data-label="Fecha">{formatearFecha(licencia.fecha)}</td>
                    <td data-label="Día">{licencia.dia_semana}</td>
                    <td data-label="Materia">{licencia.nombre_materia}</td>
                    <td data-label="Carrera">{licencia.nombre_carrera}</td>
                    <td data-label="Año">{licencia.anio ? `${licencia.anio}.º` : "—"}</td>
                    <td data-label="Turno">{licencia.turno}</td>
                    <td data-label="Motivo de inasistencia">{licencia.motivo_inasistencia || "Otro"}</td>
                    <td data-label="Observación">{licencia.observacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default Licencias;
