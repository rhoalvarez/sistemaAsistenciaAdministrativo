import { useState } from "react";
import logoIES from "../assets/logo-ies.jpeg";
import { iniciarSesion } from "../services/authService";
import "../styles/Login.css";

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [aceptaCondiciones, setAceptaCondiciones] = useState(false);

  const [mostrarContrasena, setMostrarContrasena] =
    useState(false);

  const [errores, setErrores] = useState({});

  const [cargando, setCargando] = useState(false);

  // =====================================================
  // VALIDAR FORMULARIO
  // =====================================================

  const validarFormulario = () => {
    const nuevosErrores = {};

    // USUARIO
    if (!usuario.trim()) {
      nuevosErrores.usuario =
        "Ingrese su usuario.";
    } else if (/\s/.test(usuario)) {
      nuevosErrores.usuario =
        "El usuario no puede contener espacios.";
    }

    // CONTRASEÑA
    if (!contrasena) {
      nuevosErrores.contrasena =
        "Ingrese su contraseña.";
    }

    setErrores(nuevosErrores);

    return Object.keys(nuevosErrores).length === 0;
  };

  // =====================================================
  // INICIAR SESIÓN
  // =====================================================

  const handleLogin = async () => {
    if (cargando) {
      return;
    }

    if (!validarFormulario()) {
      return;
    }

    if (!aceptaCondiciones) {
      setErrores((previos) => ({
        ...previos,
        condiciones: "Debés aceptar las condiciones de uso para continuar.",
      }));
      return;
    }

    /*
      IMPORTANTE:
      NO usamos toLowerCase().

      El backend tiene usuarios como:
      LujanLopez
      Emanuel
      rosario
      etc.

      Se envía exactamente lo que escribió el usuario.
    */

    const usuarioIngresado =
      usuario.trim();

    try {
      setCargando(true);

      setErrores({});

      const respuesta = await iniciarSesion(
        usuarioIngresado,
        contrasena
      );

      if (
        !respuesta ||
        !respuesta.usuario
      ) {
        throw new Error(
          "Respuesta inválida del servidor."
        );
      }

      // =================================================
      // LOGIN CORRECTO
      // =================================================

      onLogin({ ...respuesta.usuario, token: respuesta.token });

    } catch (error) {
      console.error("No se pudo iniciar sesión.");

      // ================================================
      // USUARIO / CONTRASEÑA INCORRECTOS
      // ================================================

      if (
        error.response?.status === 401
      ) {
        setErrores({
          usuario:
            "Usuario o contraseña incorrectos.",
        });

        return;
      }

      // ================================================
      // ERROR DE CONEXIÓN
      // ================================================

      setErrores({
        usuario:
          "No se pudo conectar con el servidor.",
      });

    } finally {
      setCargando(false);
    }
  };

  // =====================================================
  // CAMBIO DE USUARIO
  // =====================================================

  const handleUsuarioChange = (e) => {
    const valor = e.target.value;

    setUsuario(valor);

    if (
      errores.usuario
    ) {
      setErrores({
        ...errores,
        usuario: "",
      });
    }
  };

  // =====================================================
  // CAMBIO DE CONTRASEÑA
  // =====================================================

  const handleContrasenaChange = (e) => {
    const valor = e.target.value;

    setContrasena(valor);

    if (
      errores.contrasena
    ) {
      setErrores({
        ...errores,
        contrasena: "",
      });
    }
  };

  // =====================================================
  // ENTER PARA INGRESAR
  // =====================================================

  const handleKeyDown = (e) => {
    if (
      e.key === "Enter" &&
      !cargando
    ) {
      handleLogin();
    }
  };

  // =====================================================
  // FORMULARIO VÁLIDO
  // =====================================================

  const formularioValido =
    usuario.trim() !== "" &&
    contrasena !== "" &&
    !/\s/.test(usuario) &&
    aceptaCondiciones;

  // =====================================================
  // INTERFAZ
  // =====================================================

  return (
    <div className="login-container">

      <div className="login-card">

        {/* =============================================
            LOGO
        ============================================= */}

        <img
          src={logoIES}
          alt="Logo del Instituto de Estudios Superiores"
          className="logo-ies"
        />

        {/* =============================================
            ENCABEZADO
        ============================================= */}

        <div className="login-header">

          <p className="login-etiqueta">
            SISTEMA INSTITUCIONAL
          </p>

          <h1>
            Registro de asistencia
          </h1>

          <p className="login-subtitulo">
            Ingreso exclusivo para personal del IES
          </p>

        </div>

        {/* =============================================
            FORMULARIO
        ============================================= */}

        <div className="login-form">

          {/* ===========================================
              USUARIO
          =========================================== */}

          <div className="form-group">

            <label htmlFor="usuario">
              Usuario
            </label>

            <div className="input-icon-container">

              <span
                className="input-icon"
                aria-hidden="true"
              >

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >

                  <circle
                    cx="12"
                    cy="8"
                    r="4"
                  />

                  <path
                    d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"
                  />

                </svg>

              </span>

              <input
                id="usuario"
                type="text"
                placeholder="Ingrese su usuario"
                value={usuario}
                onChange={handleUsuarioChange}
                onKeyDown={handleKeyDown}
                autoComplete="username"
                disabled={cargando}
              />

            </div>

            {errores.usuario && (

              <p className="mensaje-error">
                {errores.usuario}
              </p>

            )}

          </div>

          {/* ===========================================
              CONTRASEÑA
          =========================================== */}

          <div className="form-group">

            <label htmlFor="contrasena">
              Contraseña
            </label>

            <div className="password-container">

              <span
                className="input-icon"
                aria-hidden="true"
              >

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >

                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="10"
                    rx="2"
                  />

                  <path
                    d="M8 10V7a4 4 0 0 1 8 0v3"
                  />

                </svg>

              </span>

              <input
                id="contrasena"
                type={
                  mostrarContrasena
                    ? "text"
                    : "password"
                }
                placeholder="Ingrese su contraseña"
                value={contrasena}
                onChange={handleContrasenaChange}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
                disabled={cargando}
              />

              {/* =======================================
                  MOSTRAR / OCULTAR
              ======================================= */}

              <button
                type="button"
                className="boton-mostrar"
                onClick={() =>
                  setMostrarContrasena(
                    !mostrarContrasena
                  )
                }
                aria-label={
                  mostrarContrasena
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
                disabled={cargando}
              >

                {mostrarContrasena ? (

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >

                    <path d="M3 3l18 18" />

                    <path
                      d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
                    />

                    <path
                      d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.8 3.7 10 8-0.5 1.7-1.4 3.1-2.6 4.4"
                    />

                    <path
                      d="M6.1 6.1C4.6 7.3 3.5 9 3 12c1.2 4.3 5 8 9 8 1.2 0 2.4-.2 3.5-.7"
                    />

                  </svg>

                ) : (

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >

                    <path
                      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                    />

                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                    />

                  </svg>

                )}

              </button>

            </div>

            {errores.contrasena && (

              <p className="mensaje-error">
                {errores.contrasena}
              </p>

            )}

          </div>

          {/* ===========================================
              ACEPTACIÓN DE CONDICIONES DE USO
          =========================================== */}

          <div className="condiciones-uso">
            <label className="condiciones-checkbox" htmlFor="acepta-condiciones">
              <input
                id="acepta-condiciones"
                type="checkbox"
                checked={aceptaCondiciones}
                onChange={(e) => {
                  setAceptaCondiciones(e.target.checked);
                  setErrores((previos) => ({ ...previos, condiciones: "" }));
                }}
                disabled={cargando}
                aria-describedby="texto-condiciones"
              />
              <span className="checkbox-visual" aria-hidden="true"></span>
              <span id="texto-condiciones" className="condiciones-texto">
                Acepto las condiciones de uso y me comprometo a <strong>no compartir mi usuario ni mi contraseña</strong>,
                no permitir que otra persona registre asistencia en mi nombre y utilizar el sistema de manera personal y responsable.
              </span>
            </label>
            {errores.condiciones && (
              <p className="mensaje-error" role="alert">{errores.condiciones}</p>
            )}
            <p className="condiciones-aclaracion">
              Esta aceptación es una declaración de responsabilidad; no reemplaza la verificación de identidad.
            </p>
          </div>

          {/* ===========================================
              BOTÓN INGRESAR
          =========================================== */}

          <button
            type="button"
            className="boton-ingresar"
            onClick={handleLogin}
            disabled={
              !formularioValido ||
              cargando
            }
          >

            {cargando ? (
              <>
                <span className="spinner"></span>
                Verificando...
              </>
            ) : (
              <>
                Ingresar
                <span className="flecha-login">
                  →
                </span>
              </>
            )}

          </button>

        </div>

      </div>

      {/* ===============================================
          MENSAJE INSTITUCIONAL
      =============================================== */}

      <div className="seguridad">

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >

          <path
            d="M12 3 20 6v5c0 5-3.2 8.7-8 10-4.8-1.3-8-5-8-10V6l8-3Z"
          />

          <rect
            x="9"
            y="10"
            width="6"
            height="5"
            rx="1"
          />

          <path
            d="M10 10V8a2 2 0 0 1 4 0v2"
          />

        </svg>

        <span>
          Sistema institucional seguro · Uso exclusivo
          para personal del IES
        </span>

      </div>

    </div>
  );
}

export default Login;