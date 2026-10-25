import { apiRequest } from "./api";

export const obtenerMateriasDeHoy = async (idUsuario) => {
  return apiRequest(`/docente-materia/materias-hoy/${idUsuario}`);
};
