import { getAdminHeaders } from "./adminSession";

/** Realiza solicitudes a la API administrativa incluyendo la sesión vigente.
 * Las cabeceras específicas de cada solicitud se conservan.
 */
export async function adminFetch(input, options = {}) {
  const headers = new Headers(options.headers || {});
  const sessionHeaders = getAdminHeaders();
  for (const [name, value] of Object.entries(sessionHeaders)) {
    if (value && !headers.has(name)) headers.set(name, value);
  }
  return fetch(input, { ...options, headers });
}
