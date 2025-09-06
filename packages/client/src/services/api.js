const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const runtimeProto = typeof window !== "undefined" ? window.location.protocol : "http:";
const base = import.meta.env.VITE_API_BASE_URL || `${runtimeProto}//${runtimeHost}:4000`;
async function request(path, options = {}) {
    // 检查是否是demo模式
    const authHeader = options.headers?.Authorization;
    const isDemo = authHeader && authHeader.includes('demo-token-');
    
    if (isDemo) {
        console.log('🎭 Demo API调用:', path);
        // 返回模拟数据
        const mockResponse = {
            success: true,
            data: path.includes('grids') ? {
                title: 'Demo Grid',
                owner_id: 1,
                userPermission: 'edit',
                sheets: [{ id: 1, name: 'Sheet1' }]
            } : {}
        };
        return Promise.resolve(mockResponse);
    }
    
    const res = await fetch(`${base}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });
    if (!res.ok)
        throw new Error(`${res.status}`);
    const data = await res.json();
    // 如果是创建Sheet的请求，添加详细调试
    if (path.includes('/sheets') && options.method === 'POST') {
        console.log('📋 Sheet创建请求:', {
            path,
            rawData: data,
            dataType: typeof data,
            stringified: JSON.stringify(data)
        });
    }
    return data;
}
const apiMethods = {
    register: (body) => request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
    login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
    createGrid: (token, title) => request("/api/grids/", { method: "POST", body: JSON.stringify({ title, name: title }), headers: { Authorization: `Bearer ${token}` } }),
    listGrids: (token) => request("/api/grids/", { headers: { Authorization: `Bearer ${token}` } }),
    deleteGrid: (token, id) => request(`/api/grids/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
    renameGrid: (token, id, title) => request(`/api/grids/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ title }) }),
    getGrid: (token, gridKey) => request(`/api/grids/${gridKey}`, { headers: { Authorization: `Bearer ${token}` } }),
    listSheets: (token, gridKey) => request(`/api/grids/${gridKey}/sheets`, { headers: { Authorization: `Bearer ${token}` } }),
    createSheet: (token, gridKey, name) => {
        console.log('🚀 API createSheet被调用:', { gridKey, name, nameType: typeof name });
        const result = request(`/api/grids/${gridKey}/sheets`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        });
        result.then((res) => {
            console.log('🚀 API createSheet返回结果:', {
                success: res?.success,
                dataLength: res?.data?.length,
                lastSheetName: res?.data?.[res?.data?.length - 1]?.name
            });
        }).catch(err => {
            console.error('❌ API createSheet出错:', err);
        });
        return result;
    },
    deleteSheet: (token, gridKey, sheetKey) => request(`/api/grids/${gridKey}/sheets/${sheetKey}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
    renameSheet: (token, gridKey, sheetKey, name) => request(`/api/grids/${gridKey}/sheets/${sheetKey}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
    moveSheet: (token, gridKey, sheetKey, direction) => {
        console.log('📍 API moveSheet被调用:', { gridKey, sheetKey, direction });
        return request(`/api/grids/${gridKey}/sheets/${sheetKey}/move`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ direction }) });
    },
    duplicateSheet: (token, gridKey, sheetKey) => {
        console.log('📄 API duplicateSheet被调用:', { gridKey, sheetKey });
        return request(`/api/grids/${gridKey}/sheets/${sheetKey}/duplicate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    },
    protectSheet: (token, gridKey, sheetKey, isProtected) => {
        console.log('🔒 API protectSheet被调用:', { gridKey, sheetKey, isProtected });
        return request(`/api/grids/${gridKey}/sheets/${sheetKey}/protect`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ protected: isProtected }) });
    },
    inviteCollaborator: (gridId, email, permission) => {
        console.log('👥 API inviteCollaborator被调用:', { gridId, email, permission });
        let token = null;
        try {
            const authData = localStorage.getItem('collabgrid_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                token = parsed.token;
            }
        }
        catch (e) {
            console.error('Failed to parse auth data:', e);
        }
        return request(`/api/grids/${gridId}/collaborators`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, permission })
        });
    }
};
// 添加调试信息
console.log('📋 API方法列表:', Object.keys(apiMethods));
console.log('👥 inviteCollaborator方法存在:', typeof apiMethods.inviteCollaborator);
export const api = apiMethods;
