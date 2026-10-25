/** Convierte errores de FastAPI/Pydantic en mensajes legibles para la interfaz. */
export function detalleErrorApi(detalle, respaldo = "Ocurrió un error al procesar la solicitud.") {
  if (typeof detalle === "string" && detalle.trim()) return detalle;
  if (Array.isArray(detalle)) {
    const mensajes = detalle
      .map((item) => typeof item === "string" ? item : item?.msg || item?.message)
      .filter(Boolean);
    if (mensajes.length) return [...new Set(mensajes)].join(". ");
  }
  if (detalle && typeof detalle === "object") {
    if (typeof detalle.msg === "string") return detalle.msg;
    if (typeof detalle.message === "string") return detalle.message;
  }
  return respaldo;
}

export function contraseniaValida(valor) {
  return typeof valor === "string" && valor.length >= 6 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(valor) && /\d/.test(valor);
}
