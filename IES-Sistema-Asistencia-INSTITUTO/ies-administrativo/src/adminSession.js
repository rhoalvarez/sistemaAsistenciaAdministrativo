export function getAdminHeaders() {
  const token = sessionStorage.getItem("ies_admin_session");
  return token ? { "X-Admin-Session": token } : {};
}
