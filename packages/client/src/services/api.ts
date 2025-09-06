const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const runtimeProto = typeof window !== "undefined" ? window.location.protocol : "http:";
const base = import.meta.env.VITE_API_BASE_URL || `${runtimeProto}//${runtimeHost}:4000`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // 检查是否是demo模式
  const authHeader = options.headers?.['Authorization'] as string;
  const isDemo = authHeader && authHeader.includes('demo-token-');
  
  console.log('🔍 API请求分析:', { 
    path, 
    authHeader: authHeader?.substring(0, 20) + '...', 
    isDemo,
    headers: Object.keys(options.headers || {})
  });
  
  if (isDemo) {
    console.log('🎭 Demo API调用 - 返回模拟数据:', path);
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
    return Promise.resolve(mockResponse as T);
  }
  
  console.warn('⚠️ 非Demo模式 - 将调用真实API:', path);
  
  const res = await fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!res.ok) throw new Error(`${res.status}`);
  
  const data = await res.json() as T;
  
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
  getGrid: (token: string, gridKey: number | string) =>
    request(`/api/grids/${gridKey}`, { headers: { Authorization: `Bearer ${token}` } }),
  listSheets: (token: string, gridKey: number | string) =>
    request(`/api/grids/${gridKey}/sheets`, { headers: { Authorization: `Bearer ${token}` } }),
  createSheet: (token: string, gridKey: number | string, name: string) => {
    console.log('🚀 API createSheet被调用:', { gridKey, name, nameType: typeof name });
    const result = request(`/api/grids/${gridKey}/sheets`, { 
      method: "POST", 
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, 
      body: JSON.stringify({ name }) 
    });
    result.then((res: any) => {
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
  deleteSheet: (token: string, gridKey: number | string, sheetKey: number | string) =>
    request(`/api/grids/${gridKey}/sheets/${sheetKey}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  renameSheet: (token: string, gridKey: number | string, sheetKey: number | string, name: string) =>
    request(`/api/grids/${gridKey}/sheets/${sheetKey}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
  moveSheet: (token: string, gridKey: number | string, sheetKey: number | string, direction: 'left' | 'right') => {
    console.log('📍 API moveSheet被调用:', { gridKey, sheetKey, direction });
    return request(`/api/grids/${gridKey}/sheets/${sheetKey}/move`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ direction }) });
  },
  duplicateSheet: (token: string, gridKey: number | string, sheetKey: number | string) => {
    console.log('📄 API duplicateSheet被调用:', { gridKey, sheetKey });
    return request(`/api/grids/${gridKey}/sheets/${sheetKey}/duplicate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  },
  protectSheet: (token: string, gridKey: number | string, sheetKey: number | string, isProtected: boolean) => {
    console.log('🔒 API protectSheet被调用:', { gridKey, sheetKey, isProtected });
    return request(`/api/grids/${gridKey}/sheets/${sheetKey}/protect`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ protected: isProtected }) });
  },
  inviteCollaborator: (gridId: string, email: string, permission: string) => {
    console.log('👥 API inviteCollaborator被调用:', { gridId, email, permission });
    let token: string | null = null;
    try {
      const authData = localStorage.getItem('collabgrid_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        token = parsed.token;
      }
    } catch (e) {
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



