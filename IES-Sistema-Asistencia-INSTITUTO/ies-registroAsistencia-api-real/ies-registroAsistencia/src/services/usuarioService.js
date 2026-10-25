import { apiRequest } from "./api";

export const obtenerUsuarios = async () => {
  return apiRequest("/usuarios/");
};

export const obtenerUsuario = async (idUsuario) => {
  return apiRequest(`/usuarios/${idUsuario}`);
};
