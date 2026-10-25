/* eslint-disable react-hooks/exhaustive-deps */
import { adminFetch } from "./adminApi";
import { useEffect, useMemo, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
import { getAdminHeaders } from "./adminSession";
import { detalleErrorApi } from "./apiErrors";

const fechaHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const sumarDia = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  x.setDate(x.getDate() + 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const obtenerDia = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long" });
};

const formatearFecha = (fecha) => {
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
};

const formatearHora = (valor) => {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
};

const esFinDeSemana = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  const dia = new Date(y, m - 1, d).getDay();
  return dia === 0 || dia === 6;
};

const normalizarFechaRegistro = (valor) => {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function inicioSemanaISO(fecha) { const d = new Date(`${fecha}T12:00:00`); const dia = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dia); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function finSemanaISO(fecha) { const d = new Date(`${inicioSemanaISO(fecha)}T12:00:00`); d.setDate(d.getDate()+6); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fechaISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function Reportes({ mostrarNotificacion, rolAcceso = "superadmin" }) {
  const soloLectura = rolAcceso === "lector";
  const puedeEliminar = rolAcceso === "superadmin";
  const [personal, setPersonal] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [personaId, setPersonaId] = useState("");
  const [fechaDesde, setFechaDesde] = useState(fechaHoy());
  const [fechaHasta, setFechaHasta] = useState(fechaHoy());
  const [filtrando, setFiltrando] = useState("");
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [feriadoForm, setFeriadoForm] = useState({ fecha: "", nombre: "", tipo: "provincial", jurisdiccion: "Catamarca" });
  const [editandoFeriado, setEditandoFeriado] = useState(null);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [resumenDesde, setResumenDesde] = useState(fechaHoy());
  const [resumenHasta, setResumenHasta] = useState(fechaHoy());
  const [resumenPersonal, setResumenPersonal] = useState([]);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  const generarResumen = async () => {
    if (!resumenDesde || !resumenHasta || resumenDesde > resumenHasta) { mostrarNotificacion("Revisá el período: la fecha desde no puede superar la fecha hasta.", "error"); return; }
    try {
      setCargandoResumen(true);
      const [asR, asigR, licR] = await Promise.all([
        adminFetch(`${API_URL}/asistencias/`), adminFetch(`${API_URL}/docente-materia/`), adminFetch(`${API_URL}/licencias/?desde=${resumenDesde}&hasta=${resumenHasta}`),
      ]);
      if (!asR.ok || !asigR.ok || !licR.ok) throw new Error("No se pudieron calcular los porcentajes del período.");
      const [asistencias, asignaciones, licencias] = await Promise.all([asR.json(), asigR.json(), licR.json()]);
      const feriadosSet = new Set(feriados.filter(f => f.activo !== false).map(f => f.fecha));
      const diaES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
      const resultado = personal.map(persona => {
        let cursor = new Date(`${resumenDesde}T12:00:00`); const fin = new Date(`${resumenHasta}T12:00:00`); let previstas=0, presentes=0, faltas=0, justificadas=0;
        while (cursor <= fin) {
          const fecha = fechaISO(cursor); const dia = diaES[cursor.getDay()]; const laborable = cursor.getDay() !== 0 && cursor.getDay() !== 6 && !feriadosSet.has(fecha);
          if (laborable && persona.tipo_empleado === "docente") {
            const delDia = asignaciones.filter(a => Number(a.id_usuario) === Number(persona.id_usuario) && a.dia_semana === dia && a.activo !== false);
            for (const a of delDia) { previstas++; const presente = asistencias.some(x => Number(x.id_usuario) === Number(persona.id_usuario) && Number(x.id_materia) === Number(a.id_materia) && fechaISO(new Date(x.fecha_hora_entrada)) === fecha); const licencia = licencias.some(x => Number(x.id_usuario) === Number(persona.id_usuario) && Number(x.id_docente_materia) === Number(a.id_docente_materia) && x.fecha === fecha); if (presente) presentes++; else { faltas++; if (licencia) justificadas++; } }
          } else if (laborable && persona.tipo_empleado === "no_docente") { previstas++; const presente = asistencias.some(x => Number(x.id_usuario) === Number(persona.id_usuario) && fechaISO(new Date(x.fecha_hora_entrada)) === fecha); if (presente) presentes++; else faltas++; }
          cursor.setDate(cursor.getDate()+1);
        }
        return { ...persona, previstas, presentes, faltas, justificadas, porcentaje: previstas ? Math.round((presentes / previstas) * 1000) / 10 : null };
      });
      setResumenPersonal(resultado.sort((a,b) => (a.apellido || "").localeCompare(b.apellido || "")));
    } catch (e) { mostrarNotificacion(e.message || "No se pudo generar el resumen.", "error"); }
    finally { setCargandoResumen(false); }
  };

  const cargarDatos = async () => {
    try {
      const [usuariosR, feriadosR, materiasR, carrerasR] = await Promise.all([
        adminFetch(`${API_URL}/usuarios/?incluir_inactivos=false`),
        adminFetch(`${API_URL}/feriados/`),
        adminFetch(`${API_URL}/materias/?incluir_inactivos=true`),
        adminFetch(`${API_URL}/carreras/?incluir_inactivos=true`),
      ]);
      if (!usuariosR.ok || !feriadosR.ok || !materiasR.ok || !carrerasR.ok) throw new Error("No se pudieron cargar los datos de reportes.");
      // Los usuarios administrativos no forman parte del personal cuya asistencia se calcula.
      const usuarios = await usuariosR.json();
      // El rol_acceso de los empleados puede tener un valor por defecto heredado;
      // el criterio fiable para los informes es el tipo_empleado, nunca ese campo.
      setPersonal(usuarios.filter((p) =>
        ["docente", "no_docente"].includes(String(p.tipo_empleado || "").toLowerCase())
      ));
      setFeriados(await feriadosR.json());
      setMaterias(await materiasR.json());
      setCarreras(await carrerasR.json());
    } catch (e) {
      mostrarNotificacion(e.message || "No se pudieron cargar los reportes.", "error");
    }
  };

  useEffect(() => { const timer = setTimeout(() => { cargarDatos(); }, 0); return () => clearTimeout(timer); }, []);

  const personalFiltrado = useMemo(() => personal.filter((p) => {
    const q = filtrando.trim().toLowerCase();
    if (!q) return true;
    return `${p.nombre} ${p.apellido} ${p.usuario || ""}`.toLowerCase().includes(q);
  }), [personal, filtrando]);

  const cambiarBusquedaPersona = (valor) => {
    setFiltrando(valor);
    const q = valor.trim().toLowerCase();
    if (!q) { setPersonaId(""); return; }
    const coincidencias = personal.filter((p) => `${p.nombre} ${p.apellido} ${p.usuario || ""}`.toLowerCase().includes(q));
    if (coincidencias.length === 1) setPersonaId(String(coincidencias[0].id_usuario));
    else if (!coincidencias.some((p) => String(p.id_usuario) === String(personaId))) setPersonaId("");
  };

  const generarReporte = async () => {
    if (!personaId) return mostrarNotificacion("Seleccioná una persona.", "error");
    if (fechaDesde > fechaHasta) return mostrarNotificacion("La fecha desde no puede ser posterior a la fecha hasta.", "error");

    try {
      setCargando(true);
      const persona = personal.find((p) => String(p.id_usuario) === String(personaId));
      if (!persona) throw new Error("La persona seleccionada ya no está disponible. Actualizá los datos e intentá nuevamente.");
      const [asistenciasR, asignacionesR, licenciasR] = await Promise.all([
        adminFetch(`${API_URL}/asistencias/?id_usuario=${personaId}`),
        persona?.tipo_empleado === "docente"
          ? adminFetch(`${API_URL}/docente-materia/?id_usuario=${personaId}`)
          : Promise.resolve(null),
        adminFetch(`${API_URL}/licencias/?id_usuario=${personaId}&desde=${fechaDesde}&hasta=${fechaHasta}`),
      ]);

      if (!asistenciasR.ok || (asignacionesR && !asignacionesR.ok) || !licenciasR.ok) {
        throw new Error("No se pudieron cargar los registros de la persona.");
      }

      const asistencias = await asistenciasR.json();
      const asignaciones = asignacionesR ? await asignacionesR.json() : [];
      const licencias = await licenciasR.json();
      const materiaPorId = Object.fromEntries(materias.map((m) => [m.id_materia, m]));
      const carreraPorId = Object.fromEntries(carreras.map((c) => [c.id_carrera, c]));
      const feriadoPorFecha = Object.fromEntries(feriados.filter((f) => f.activo !== false).map((f) => [f.fecha, f]));
      const filas = [];

      const crearFilaAsignacion = (fecha, dia, asignacion, estado, observacion = "", asistencia = null) => {
        const materia = materiaPorId[asignacion.id_materia];
        return {
          fecha,
          dia,
          estado,
          materia: materia?.nombre_materia || "—",
          carrera: carreraPorId[materia?.id_carrera]?.nombre_carrera || "—",
          anio: asignacion?.anio ? `${asignacion.anio}°` : "No informado",
          turno: asignacion?.turno || "No informado",
          entrada: asistencia?.fecha_hora_entrada || null,
          salida: asistencia?.fecha_hora_salida || null,
          observacion,
          clase: estado === "Inasistencia" ? "licencia" : estado.startsWith("Feriado") ? "feriado" : asistencia ? "asistencia" : "sin-registro",
        };
      };

      let cursor = fechaDesde;
      while (cursor <= fechaHasta) {
        const feriado = feriadoPorFecha[cursor];
        const dia = obtenerDia(cursor);

        if (persona.tipo_empleado === "docente") {
          const previstas = asignaciones.filter((x) => x.activo !== false && x.dia_semana.toLowerCase() === dia.toLowerCase());

          if (feriado) {
            if (previstas.length) {
              for (const asignacion of previstas) {
                const tipoFeriado = feriado.tipo === "nacional" ? "feriado nacional" : feriado.tipo === "provincial" ? "feriado provincial" : "día no laborable";
                filas.push(crearFilaAsignacion(
                  cursor,
                  dia,
                  asignacion,
                  `Feriado — ${feriado.nombre}`,
                  `No se dictó clase porque corresponde a ${tipoFeriado}.`,
                ));
              }
            } else {
              filas.push({ fecha: cursor, dia, estado: `Feriado — ${feriado.nombre}`, materia: "—", carrera: "—", anio: "—", turno: "—", entrada: null, salida: null, observacion: `No se dictó clase porque corresponde a ${feriado.tipo === "nacional" ? "feriado nacional" : feriado.tipo === "provincial" ? "feriado provincial" : "día no laborable"}.`, clase: "feriado" });
            }
          } else if (esFinDeSemana(cursor)) {
            filas.push({ fecha: cursor, dia, estado: "No laboral — Fin de semana", materia: "—", carrera: "—", anio: "—", turno: "—", entrada: null, salida: null, observacion: "No corresponde jornada institucional.", clase: "fin-semana" });
          } else if (previstas.length) {
            for (const asignacion of previstas) {
              const licencia = licencias.find((l) =>
                l.fecha === cursor &&
                Number(l.id_docente_materia) === Number(asignacion.id_docente_materia) &&
                Number(l.id_materia) === Number(asignacion.id_materia) &&
                (l.turno || "") === (asignacion.turno || ""),
              );
              const asistencia = asistencias.find((a) =>
                normalizarFechaRegistro(a.fecha_hora_entrada) === cursor &&
                Number(a.id_materia) === Number(asignacion.id_materia),
              );

              if (licencia) {
                filas.push(crearFilaAsignacion(cursor, dia, asignacion, "Inasistencia", licencia.observacion));
              } else if (asistencia) {
                filas.push(crearFilaAsignacion(cursor, dia, asignacion, asistencia.fecha_hora_salida ? "Presente" : "Salida pendiente", "", asistencia));
              } else {
                filas.push(crearFilaAsignacion(cursor, dia, asignacion, "Sin registro", "No se registró asistencia para esta materia."));
              }
            }
          } else {
            const delDia = asistencias.filter((a) => normalizarFechaRegistro(a.fecha_hora_entrada) === cursor);
            if (delDia.length) {
              for (const a of delDia) {
                const materia = materiaPorId[a.id_materia];
                const asignacion = asignaciones.find((x) => Number(x.id_materia) === Number(a.id_materia));
                filas.push({ fecha: cursor, dia, estado: a.fecha_hora_salida ? "Presente" : "Salida pendiente", materia: materia?.nombre_materia || "—", carrera: carreraPorId[materia?.id_carrera]?.nombre_carrera || "—", anio: asignacion?.anio ? `${asignacion.anio}°` : "No informado", turno: asignacion?.turno || "No informado", entrada: a.fecha_hora_entrada, salida: a.fecha_hora_salida, observacion: "", clase: "asistencia" });
              }
            } else {
              filas.push({ fecha: cursor, dia, estado: "Sin registro", materia: "—", carrera: "—", anio: "—", turno: "—", entrada: null, salida: null, observacion: "No se registró asistencia.", clase: "sin-registro" });
            }
          }
        } else if (feriado) {
          filas.push({ fecha: cursor, dia, estado: `Feriado — ${feriado.nombre}`, materia: "—", carrera: "—", anio: "—", turno: "—", entrada: null, salida: null, observacion: `No se registró jornada porque corresponde a ${feriado.tipo === "nacional" ? "feriado nacional" : feriado.tipo === "provincial" ? "feriado provincial" : "día no laborable"}.`, clase: "feriado" });
        } else if (esFinDeSemana(cursor)) {
          filas.push({ fecha: cursor, dia, estado: "No laboral — Fin de semana", materia: "—", carrera: "—", anio: "—", turno: "—", entrada: null, salida: null, observacion: "No corresponde jornada institucional.", clase: "fin-semana" });
        } else {
          const delDia = asistencias.filter((a) => normalizarFechaRegistro(a.fecha_hora_entrada) === cursor);
          if (delDia.length) {
            delDia.forEach((a) => filas.push({ fecha: cursor, dia, estado: a.fecha_hora_salida ? "Presente" : "Salida pendiente", materia: "—", carrera: "—", anio: "—", turno: "—", entrada: a.fecha_hora_entrada, salida: a.fecha_hora_salida, observacion: "", clase: "asistencia" }));
          } else {
            filas.push({ fecha: cursor, dia, estado: "Sin registro", materia: "—", carrera: "—", anio: "—", turno: "—", entrada: null, salida: null, observacion: "No se registró asistencia.", clase: "sin-registro" });
          }
        }

        cursor = sumarDia(cursor);
      }

      setReporte({ persona, filas });
    } catch (e) {
      mostrarNotificacion(e.message || "No se pudo generar el informe.", "error");
    } finally {
      setCargando(false);
    }
  };

  const guardarFeriado = async (e) => {
    e.preventDefault();
    if (soloLectura) { mostrarNotificacion("Tu perfil es de solo lectura.", "error"); return; }
    try {
      const url = editandoFeriado ? `${API_URL}/feriados/${editandoFeriado.id_feriado}` : `${API_URL}/feriados/`;
      const r = await adminFetch(url, { method: editandoFeriado ? "PUT" : "POST", headers: { "Content-Type": "application/json", ...getAdminHeaders() }, body: JSON.stringify(feriadoForm) });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(detalleErrorApi(data?.detail, "No se pudo guardar el feriado."));
      setFeriadoForm({ fecha: "", nombre: "", tipo: "provincial", jurisdiccion: "Catamarca" });
      setEditandoFeriado(null);
      await cargarDatos();
      mostrarNotificacion(editandoFeriado ? "El feriado fue actualizado correctamente." : "El feriado fue registrado correctamente.");
    } catch (e) { mostrarNotificacion(e.message || "No se pudo guardar el feriado.", "error"); }
  };

  const eliminarFeriado = async (f) => {
    if (!puedeEliminar) return;
    if (!window.confirm(`¿Deseás quitar el feriado "${f.nombre}" del ${formatearFecha(f.fecha)}?`)) return;
    try {
      const r = await adminFetch(`${API_URL}/feriados/${f.id_feriado}`, { method: "DELETE", headers: getAdminHeaders() });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(detalleErrorApi(data?.detail, "No se pudo eliminar el feriado."));
      await cargarDatos();
      mostrarNotificacion("El feriado fue eliminado correctamente.");
    } catch (e) { mostrarNotificacion(e.message || "No se pudo eliminar el feriado.", "error"); }
  };

  const resumen = reporte ? {
    presentes: reporte.filas.filter((f) => f.clase === "asistencia").length,
    sinRegistro: reporte.filas.filter((f) => f.clase === "sin-registro").length,
    feriados: reporte.filas.filter((f) => f.clase === "feriado").length,
    licencias: reporte.filas.filter((f) => f.clase === "licencia").length,
    finesDeSemana: reporte.filas.filter((f) => f.clase === "fin-semana").length,
  } : null;

  return (
    <section className="admin-card reportes-panel">
      <section className="admin-card reportes-resumen no-print">
        <div className="admin-content-header"><div><span className="admin-content-kicker">INDICADORES</span><h2 className="admin-content-title">Porcentaje de asistencia por período</h2><p className="admin-content-description">Calcula presentes, faltas y ausencias justificadas para docentes y personal. El horario de la materia no bloquea el fichaje.</p></div></div>
        <div className="admin-form-grid reportes-periodo">
          <div className="admin-field"><label htmlFor="resumenDesde">Desde</label><input id="resumenDesde" type="date" value={resumenDesde} onChange={e=>setResumenDesde(e.target.value)} /></div>
          <div className="admin-field"><label htmlFor="resumenHasta">Hasta</label><input id="resumenHasta" type="date" value={resumenHasta} onChange={e=>setResumenHasta(e.target.value)} /></div>
          <div className="reportes-periodo-acciones"><button type="button" className="admin-secondary-button" onClick={()=>{setResumenDesde(inicioSemanaISO(fechaHoy()));setResumenHasta(finSemanaISO(fechaHoy()));}}>Esta semana</button><button type="button" className="admin-secondary-button" onClick={()=>{const h=fechaHoy();setResumenDesde(`${h.slice(0,7)}-01`);setResumenHasta(h);}}>Este mes</button><button type="button" className="admin-primary-button" onClick={generarResumen} disabled={cargandoResumen}>{cargandoResumen?"Calculando…":"Calcular"}</button></div>
        </div>
        {resumenPersonal.length > 0 && <div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Personal</th><th>Tipo</th><th>Jornadas previstas</th><th>Asistió</th><th>Faltó</th><th>Justificadas</th><th>Asistencia %</th></tr></thead><tbody>{resumenPersonal.map(p=><tr key={p.id_usuario}><td data-label="Personal"><strong>{p.apellido}, {p.nombre}</strong></td><td data-label="Tipo">{p.tipo_empleado === "docente" ? "Docente" : "Personal"}</td><td data-label="Jornadas previstas">{p.previstas}</td><td data-label="Asistió">{p.presentes}</td><td data-label="Faltó">{p.faltas}</td><td data-label="Justificadas">{p.justificadas}</td><td data-label="Asistencia %"><strong>{p.porcentaje === null ? "Sin jornadas" : `${p.porcentaje}%`}</strong></td></tr>)}</tbody></table></div>}
      </section>
      <div className="admin-content-header reportes-screen-header">
        <div>
          <span className="admin-content-kicker">REPORTES</span>
          <h2 className="admin-content-title">Informes de asistencia</h2>
          <p className="admin-content-description">Generá un informe por persona y período. Incluye feriados, fines de semana y días sin registro.</p>
        </div>
        <div className="reportes-header-actions no-print">
          {reporte && <button type="button" className="admin-primary-button" onClick={() => window.print()}>Imprimir / Guardar PDF</button>}
          <button type="button" className="admin-secondary-button" onClick={() => setMostrarCalendario((v) => !v)}>
            {mostrarCalendario ? "Ocultar calendario" : "Calendario de feriados"}
          </button>
        </div>
      </div>

      <div className="reportes-config no-print">
        <div className="admin-field">
          <label>Buscar persona</label>
          <input value={filtrando} onChange={(e) => cambiarBusquedaPersona(e.target.value)} placeholder="Nombre, apellido o usuario..." autoComplete="off" />
        </div>
        <div className="admin-field">
          <label>Persona</label>
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            <option value="">Seleccionar persona</option>
            {personalFiltrado.map((p) => <option key={p.id_usuario} value={p.id_usuario}>{p.nombre} {p.apellido} — {p.tipo_empleado === "docente" ? "Docente" : "Personal"}</option>)}
          </select>
        </div>
        <div className="admin-field"><label>Desde</label><input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} /></div>
        <div className="admin-field"><label>Hasta</label><input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} /></div>
        <div className="reportes-actions"><button type="button" className="admin-primary-button" onClick={generarReporte} disabled={cargando}>{cargando ? "Generando..." : "Generar informe"}</button></div>
      </div>

      {reporte && (
        <div className="reporte-imprimible">
          <div className="reporte-cabecera">
            <div><span className="admin-section-kicker">INSTITUTO</span><h2>Informe de asistencia</h2><p>Período: {formatearFecha(fechaDesde)} al {formatearFecha(fechaHasta)}</p></div>
            <div className="reporte-persona"><strong>{reporte.persona.nombre} {reporte.persona.apellido}</strong><span>{reporte.persona.tipo_empleado === "docente" ? "Docente" : "Personal"}</span><span>Usuario: {reporte.persona.usuario || "—"}</span></div>
          </div>
          <div className="reporte-resumen">
            <div><strong>{resumen.presentes}</strong><span>Registros de asistencia</span></div>
            <div><strong>{resumen.sinRegistro}</strong><span>Sin registro</span></div>
            <div><strong>{resumen.licencias}</strong><span>Inasistencias</span></div>
            <div><strong>{resumen.feriados}</strong><span>Feriados</span></div>
            <div><strong>{resumen.finesDeSemana}</strong><span>Fines de semana</span></div>
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table reporte-tabla">
              <thead><tr><th>Fecha</th><th>Día</th>{reporte.persona.tipo_empleado === "docente" && <><th>Carrera</th><th>Año</th><th>Turno</th><th>Materia</th></>}<th>Estado</th><th>Observación</th><th>Entrada</th><th>Salida</th></tr></thead>
              <tbody>{reporte.filas.map((f, i) => <tr key={`${f.fecha}-${i}`} className={`reporte-${f.clase}`}><td>{formatearFecha(f.fecha)}</td><td>{f.dia}</td>{reporte.persona.tipo_empleado === "docente" && <><td>{f.carrera}</td><td>{f.anio}</td><td>{f.turno}</td><td>{f.materia}</td></>}<td><strong>{f.estado}</strong></td><td>{f.observacion || "—"}</td><td>{formatearHora(f.entrada)}</td><td>{formatearHora(f.salida)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="reporte-pie">Informe generado por el Sistema de Asistencia del IES. Los feriados se toman del calendario local configurado para Argentina y Catamarca.</div>
        </div>
      )}

      {mostrarCalendario && (
      <section className="feriados-admin no-print">
        <div className="admin-data-block-header"><div><span className="admin-section-kicker">CALENDARIO</span><h3>Feriados nacionales y provinciales</h3><p>El sistema ya incluye el calendario 2026 y permite agregar o corregir fechas futuras.</p></div><button type="button" className="admin-secondary-button" disabled={soloLectura} onClick={() => { setEditandoFeriado(null); setFeriadoForm({ fecha: "", nombre: "", tipo: "provincial", jurisdiccion: "Catamarca" }); }}>Nuevo feriado</button></div>
        <form className="feriado-form" onSubmit={guardarFeriado}>
          <div className="admin-field"><label>Fecha</label><input type="date" value={feriadoForm.fecha} onChange={(e) => setFeriadoForm({ ...feriadoForm, fecha: e.target.value })} required /></div>
          <div className="admin-field"><label>Nombre</label><input value={feriadoForm.nombre} onChange={(e) => setFeriadoForm({ ...feriadoForm, nombre: e.target.value })} placeholder="Nombre del feriado" required /></div>
          <div className="admin-field"><label>Tipo</label><select value={feriadoForm.tipo} onChange={(e) => setFeriadoForm({ ...feriadoForm, tipo: e.target.value })}><option value="nacional">Nacional</option><option value="provincial">Provincial</option><option value="turistico">Turístico / no laborable</option></select></div>
          <div className="admin-field"><label>Jurisdicción</label><select value={feriadoForm.jurisdiccion} onChange={(e) => setFeriadoForm({ ...feriadoForm, jurisdiccion: e.target.value })}><option>Argentina</option><option>Catamarca</option></select></div>
          <div className="reportes-actions"><button type="submit" className="admin-primary-button" disabled={soloLectura}>{editandoFeriado ? "Guardar cambios" : "Agregar feriado"}</button>{editandoFeriado && <button type="button" className="admin-outline-button" onClick={() => { setEditandoFeriado(null); setFeriadoForm({ fecha: "", nombre: "", tipo: "provincial", jurisdiccion: "Catamarca" }); }}>Cancelar</button>}</div>
        </form>
        <div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Fecha</th><th>Nombre</th><th>Tipo</th><th>Jurisdicción</th><th>Acciones</th></tr></thead><tbody>{feriados.map((f) => <tr key={f.id_feriado}><td>{formatearFecha(f.fecha)}</td><td><strong>{f.nombre}</strong></td><td>{f.tipo}</td><td>{f.jurisdiccion}</td><td><div className="admin-actions"><button type="button" className="admin-table-button" disabled={soloLectura} onClick={() => { setEditandoFeriado(f); setFeriadoForm({ fecha: f.fecha, nombre: f.nombre, tipo: f.tipo, jurisdiccion: f.jurisdiccion }); }}>Editar</button><button type="button" className="admin-table-button danger" disabled={!puedeEliminar} onClick={() => eliminarFeriado(f)}>Eliminar</button></div></td></tr>)}</tbody></table></div>
      </section>
      )}
    </section>
  );
}

export default Reportes;
