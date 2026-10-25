const API_URL =
  import.meta.env.VITE_API_URL ||
  `http://${window.location.hostname}:8000`;

export const apiRequest = async (endpoint, options = {}) => {
  const token = sessionStorage.getItem("ies_staff_session");
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Admin-Session": token } : {}),
      ...(options.headers || {}),
    },
  });

  const texto = await response.text();
  let data = null;

  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = texto;
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.detail || "La solicitud no pudo completarse."
    );
    error.response = {
      status: response.status,
      data,
    };
    throw error;
  }

  return data;
};
