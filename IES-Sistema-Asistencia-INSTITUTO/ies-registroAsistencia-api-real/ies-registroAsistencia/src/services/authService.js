import { apiRequest } from "./api";

export const iniciarSesion = async (usuario, contrasenia) => {
  return apiRequest("/usuarios/login", {
    method: "POST",
    body: JSON.stringify({
      usuario,
      contrasenia,
    }),
  });
};
