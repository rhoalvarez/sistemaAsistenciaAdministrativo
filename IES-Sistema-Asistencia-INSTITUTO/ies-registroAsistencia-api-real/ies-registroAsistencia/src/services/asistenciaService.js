import { apiRequest } from "./api";

export const registrarEntradaAPI = async (idUsuario, idMateria = null) => {
  const datos = { id_usuario: idUsuario };

  if (idMateria !== null && idMateria !== undefined) {
    datos.id_materia = idMateria;
  }

  return apiRequest("/asistencias/entrada", {
    method: "POST",
    body: JSON.stringify(datos),
  });
};


export const registrarSalidaAPI = async (idAsistencia) => {
  return apiRequest(`/asistencias/salida/${idAsistencia}`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
};

export const obtenerAsistenciasAPI = async (idUsuario) => {
  return apiRequest(`/asistencias/?id_usuario=${idUsuario}`);
};

export const obtenerAsistenciaAPI = async (idAsistencia) => {
  return apiRequest(`/asistencias/${idAsistencia}`);
};

export const cargarTemaAPI = async (
  idAsistencia,
  idMateria,
  temaDictado
) => {
  return apiRequest(`/asistencias/tema/${idAsistencia}`, {
    method: "PUT",
    body: JSON.stringify({
      id_materia: idMateria,
      tema_dictado: temaDictado,
    }),
  });
};
