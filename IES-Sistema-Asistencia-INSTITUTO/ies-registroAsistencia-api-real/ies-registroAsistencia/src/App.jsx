import { useState } from "react";

import Inicio from "./pages/inicio";
import Login from "./pages/Login";
import Seleccion from "./pages/Seleccion";
import Asistencia from "./pages/Asistencia";

const datosIniciales = {
  id_usuario: null,
  usuario: "",
  nombre: "",
  rol: "",
  id_materia: null,
  materia: "",
  carrera: "",
  dia: "",
  id_asistencia: null,
};

function App() {
  const [pantalla, setPantalla] = useState("inicio");
  const [datosUsuario, setDatosUsuario] = useState(datosIniciales);
  const [datosClase, setDatosClase] = useState(datosIniciales);

  // ==========================
  // IR AL LOGIN
  // ==========================
  const irALogin = () => {
    setPantalla("login");
  };

  // ==========================
  // INICIAR SESIÓN
  // ==========================
  const iniciarSesion = async (usuario) => {
    if (!usuario?.id) {
      alert("No se recibieron los datos del usuario.");
      return;
    }

    if (usuario.token) sessionStorage.setItem("ies_staff_session", usuario.token);

    const datos = {
      id_usuario: usuario.id,
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      rol: usuario.rol,
      id_materia: null,
      materia: "",
      carrera: "",
      dia: "",
      id_asistencia: null,
    };

    setDatosUsuario(datos);

    // ==========================
    // PERSONAL NO DOCENTE
    // ==========================
    if (usuario.rol === "no_docente") {
      setDatosClase(datos);
      setPantalla("asistencia");
      return;
    }

    // ==========================
    // VALIDAR ROL
    // ==========================
    if (usuario.rol !== "docente") {
      alert("El usuario no tiene un rol válido.");
      return;
    }

    // ==========================
    // DOCENTE → SELECCIÓN DE MATERIA
    // ==========================
    setDatosClase(datos);
    setPantalla("seleccion");
  };

  // ==========================
  // IR A ASISTENCIA
  // ==========================
  const irAAsistencia = (datos) => {
    setDatosClase(datos);
    setPantalla("asistencia");
  };

  // ==========================
  // VOLVER A SELECCIONAR MATERIA
  // ==========================
  const volverASeleccionMaterias = () => {
    setDatosClase({
      ...datosUsuario,
      id_materia: null,
      materia: "",
      carrera: "",
      dia: "",
      id_asistencia: null,
    });

    setPantalla("seleccion");
  };

  // ==========================
  // VOLVER AL INICIO
  // ==========================
  const volverAlInicio = () => {
    setDatosUsuario(datosIniciales);
    setDatosClase(datosIniciales);
    setPantalla("inicio");
  };

  return (
    <>
      {/* ==========================
          INICIO
      ========================== */}
      {pantalla === "inicio" && (
        <Inicio onIniciar={irALogin} />
      )}

      {/* ==========================
          LOGIN
      ========================== */}
      {pantalla === "login" && (
        <Login onLogin={iniciarSesion} />
      )}

      {/* ==========================
          SELECCIÓN DE MATERIA
      ========================== */}
      {pantalla === "seleccion" && (
        <Seleccion
          onContinuar={irAAsistencia}
          onVolverInicio={volverAlInicio}
          nombre={datosUsuario.nombre}
          id_usuario={datosUsuario.id_usuario}
        />
      )}

      {/* ==========================
          ASISTENCIA
      ========================== */}
      {pantalla === "asistencia" && (
        <Asistencia
          datosClase={datosClase}
          onVolverLogin={volverAlInicio}
          onVolverMaterias={
            datosUsuario.rol === "docente"
              ? volverASeleccionMaterias
              : null
          }
        />
      )}
    </>
  );
}

export default App;