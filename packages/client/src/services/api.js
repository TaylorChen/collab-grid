const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const runtimeProto = typeof window !== "undefined" ? window.location.protocol : "http:";
const base = import.meta.env.VITE_API_BASE_URL || `${runtimeProto}//${runtimeHost}:4000`;
async function request(path, options = {}) {
    const res = await fetch(`${base}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });
    if (!res.ok)
        throw new Error(`${res.status}`);
    return res.json();
}
export const api = {
    register: (body) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
    login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
    createGrid: (token, title) => request("/api/grids/", { method: "POST", body: JSON.stringify({ title, name: title }), headers: { Authorization: `Bearer ${token}` } }),
    listGrids: (token) => request("/api/grids/", { headers: { Authorization: `Bearer ${token}` } }),
    deleteGrid: (token, id) => request(`/api/grids/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
    renameGrid: (token, id, title) => request(`/api/grids/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ title }) }),
    getGrid: (token, gridKey) => request(`/api/grids/${gridKey}`, { headers: { Authorization: `Bearer ${token}` } }),
    listSheets: (token, gridKey) => request(`/api/grids/${gridKey}/sheets`, { headers: { Authorization: `Bearer ${token}` } }),
    createSheet: (token, gridKey, name) => request(`/api/grids/${gridKey}/sheets`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
    deleteSheet: (token, gridKey, sheetKey) => request(`/api/grids/${gridKey}/sheets/${sheetKey}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
    renameSheet: (token, gridKey, sheetKey, name) => request(`/api/grids/${gridKey}/sheets/${sheetKey}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
};
