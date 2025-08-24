const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const runtimeProto = typeof window !== "undefined" ? window.location.protocol : "http:";
const base = import.meta.env.VITE_API_BASE_URL || `${runtimeProto}//${runtimeHost}:4000`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  register: (body: { email: string; password: string; displayName: string }) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  createGrid: (token: string, title: string) =>
    request("/api/grids/", { method: "POST", body: JSON.stringify({ title, name: title }), headers: { Authorization: `Bearer ${token}` } }),
  listGrids: (token: string) =>
    request("/api/grids/", { headers: { Authorization: `Bearer ${token}` } }),
  deleteGrid: (token: string, id: number | string) =>
    request(`/api/grids/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  renameGrid: (token: string, id: number | string, title: string) =>
    request(`/api/grids/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ title }) }),
  getGrid: (token: string, id: number | string) =>
    request(`/api/grids/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
  listSheets: (token: string, id: number | string) =>
    request(`/api/grids/${id}/sheets`, { headers: { Authorization: `Bearer ${token}` } }),
  createSheet: (token: string, id: number | string, name: string) =>
    request(`/api/grids/${id}/sheets`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
  deleteSheet: (token: string, id: number | string, sheetId: number) =>
    request(`/api/grids/${id}/sheets/${sheetId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  renameSheet: (token: string, id: number | string, sheetId: number, name: string) =>
    request(`/api/grids/${id}/sheets/${sheetId}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
};

