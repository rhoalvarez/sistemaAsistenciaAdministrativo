import { useEffect, useState } from "react";
import logoIES from "../assets/logo-ies.jpeg";
import "../styles/inicio.css";

function obtenerSaludo() {
  const hora = new Date().getHours();

  if (hora >= 6 && hora < 12) {
    return "¡Buenos días, profe!";
  }

  if (hora >= 12 && hora < 19) {
    return "¡Buenas tardes, profe!";
  }

  return "¡Buenas noches, profe!";
}

function Inicio({ onIniciar }) {
  const [saludo, setSaludo] = useState(
    obtenerSaludo()
  );

  useEffect(() => {
    const actualizarSaludo = () => {
      setSaludo(obtenerSaludo());
    };

    actualizarSaludo();

    const intervalo = setInterval(
      actualizarSaludo,
      60000
    );

    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="inicio-container">

      <div className="inicio-card">

        <img
          src={logoIES}
          alt="Logo IES"
          className="inicio-logo"
        />

        <p className="inicio-etiqueta">
          SISTEMA INSTITUCIONAL
        </p>

        <h1>
          {saludo}
        </h1>

        <p className="inicio-subtitulo">
          Bienvenido al sistema de registro de asistencia
        </p>

        <button
          type="button"
          className="boton-iniciar"
          onClick={onIniciar}
        >
          Iniciar
        </button>

      </div>

    </div>
  );
}

export default Inicio;