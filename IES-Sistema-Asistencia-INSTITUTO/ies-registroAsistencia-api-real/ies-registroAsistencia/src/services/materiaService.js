import { apiRequest } from "./api";

export const obtenerMateria = async (idMateria) => {
  return apiRequest(`/materias/${idMateria}`);
};
