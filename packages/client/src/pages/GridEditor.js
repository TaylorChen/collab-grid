import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import { useParams } from "react-router-dom";
import { useRealtime } from "@/hooks/useRealtime";
import { useUserStore } from "@/stores/userStore";
import { api } from "@/services/api";
import { useGridStore } from "@/stores/gridStore";
import ImprovedSpreadsheetLayout from "@/components/Layout/ImprovedSpreadsheetLayout";
import { toast } from '@/stores/toastStore';
export default function GridEditor() {
    const { id } = useParams();
    const token = useUserStore((s) => s.token);
    const user = useUserStore((s) => s.user);
    const [title, setTitle] = React.useState("Loading...");
    const [ownerId, setOwnerId] = React.useState(null);
    const [userPermission, setUserPermission] = React.useState(null);
    const [sheets, setSheets] = React.useState([]);
    const [currentSheet, setCurrentSheet] = React.useState(0);
    const [email, setEmail] = React.useState("");
    const [msg, setMsg] = React.useState(null);
    React.useEffect(() => {
        (async () => {
            try {
                if (!id || !token)
                    return;
                const res = await api.getGrid(token, id);
                if (res?.success) {
                    setTitle(res.data?.title || `#${id}`);
                    setOwnerId(res.data?.owner_id ?? null);
                    setUserPermission(res.data?.userPermission ?? null);
                    setSheets(res.data?.sheets || []);
                    if (res.data?.sheets?.[0]?.id)
                        setCurrentSheet(res.data.sheets[0].id);
                    console.log('👤 用户权限信息:', { userPermission: res.data?.userPermission, ownerId: res.data?.owner_id, currentUserId: user?.id });
                }
                else
                    setTitle(`#${id}`);
            }
            catch {
                setTitle(`#${id}`);
            }
        })();
    }, [id, token]);
    useRealtime(id || "demo", currentSheet, token || undefined);
    // 切换激活 sheet 时，同步到 store，用于尺寸隔离
    React.useEffect(() => {
        if (currentSheet != null) {
            useGridStore.getState().setActiveSheet(currentSheet);
        }
    }, [currentSheet]);
    return (_jsx("div", { className: "h-screen flex flex-col", children: _jsx("div", { className: "flex-1", children: _jsx(ImprovedSpreadsheetLayout, { gridId: id || "demo", sheetId: currentSheet, sheets: sheets, userPermission: userPermission, onSheetChange: (sheetId) => {
                    setCurrentSheet(sheetId);
                    useGridStore.getState().setActiveSheet(sheetId);
                }, onNewSheet: async () => {
                    if (!token || !id)
                        return;
                    // 权限检查：只有拥有者和写权限用户可以创建Sheet
                    const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
                    if (!hasWritePermission) {
                        console.warn('🔒 创建Sheet被拒绝：用户无写权限');
                        toast.warning('您只有只读权限，无法创建新的工作表。', 3000);
                        return;
                    }
                    const sheetCount = sheets?.length || 0;
                    const name = `Sheet${sheetCount + 1}`;
                    console.log('🆕 创建新Sheet:', {
                        name,
                        currentSheets: sheetCount,
                        sheetsArray: sheets,
                        allSheetNames: sheets?.map(s => s.name) || []
                    });
                    const res = await api.createSheet(token, id, name);
                    if (res?.success) {
                        console.log('🆕 API返回数据:', {
                            success: res.success,
                            dataLength: res.data?.length,
                            allSheetData: res.data,
                            newSheetDetails: res.data?.[res.data.length - 1]
                        });
                        // 清理新建Sheet时的数据
                        const cleanedNewSheets = res.data.map(sheet => ({
                            ...sheet,
                            name: String(sheet.name || '').trim(),
                            is_protected: Number(sheet.is_protected) || 0
                        }));
                        setSheets(cleanedNewSheets);
                        if (cleanedNewSheets?.length) {
                            const newId = res.data[res.data.length - 1].id;
                            const newSheetName = res.data[res.data.length - 1].name;
                            console.log('🆕 新Sheet创建成功:', {
                                newId,
                                newSheetName,
                                totalSheets: res.data.length
                            });
                            setCurrentSheet(newId);
                            // 让useRealtime处理setActiveSheet，避免竞态条件
                            console.log('🆕 等待useRealtime连接新Sheet...');
                        }
                    }
                    else {
                        console.error('🆕 新Sheet创建失败:', res);
                    }
                }, onRenameSheet: async (sheetId, newName) => {
                    if (!token || !id)
                        return;
                    // 权限检查：只有拥有者和写权限用户可以重命名Sheet
                    const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
                    if (!hasWritePermission) {
                        console.warn('🔒 重命名Sheet被拒绝：用户无写权限');
                        toast.warning('您只有只读权限，无法重命名工作表。', 3000);
                        return;
                    }
                    try {
                        console.log('📝 重命名Sheet请求:', { sheetId, newName });
                        const res = await api.renameSheet(token, id, sheetId, newName);
                        if (res?.success) {
                            // 服务器返回更新后的sheets列表
                            setSheets(res.data);
                            console.log('✅ Sheet重命名成功，已保存到数据库');
                        }
                        else {
                            throw new Error(res?.error || '重命名失败');
                        }
                    }
                    catch (error) {
                        console.error('❌ Sheet重命名失败:', error);
                        alert('重命名失败，请重试');
                    }
                }, onDeleteSheet: async (sheetId) => {
                    if (!token || !id)
                        return;
                    // 权限检查：只有拥有者和写权限用户可以删除Sheet
                    const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
                    if (!hasWritePermission) {
                        console.warn('🔒 删除Sheet被拒绝：用户无写权限');
                        toast.warning('您只有只读权限，无法删除工作表。', 3000);
                        return;
                    }
                    // 确认删除
                    const confirmed = window.confirm('确定要删除这个工作表吗？此操作不可撤销。');
                    if (!confirmed)
                        return;
                    try {
                        console.log('🗑️ 删除Sheet请求:', { sheetId });
                        const res = await api.deleteSheet(token, id, sheetId);
                        if (res?.success) {
                            // 重新获取sheets列表
                            const sheetsRes = await api.listSheets(token, id);
                            if (sheetsRes?.success) {
                                const updatedSheets = sheetsRes.data;
                                setSheets(updatedSheets);
                                // 如果删除的是当前活动Sheet，切换到第一个可用Sheet
                                if (currentSheet === sheetId && updatedSheets.length > 0) {
                                    const firstSheet = updatedSheets[0].id;
                                    setCurrentSheet(firstSheet);
                                    useGridStore.getState().setActiveSheet(firstSheet);
                                }
                                console.log('✅ Sheet删除成功');
                            }
                            else {
                                throw new Error('获取更新后的Sheet列表失败');
                            }
                        }
                        else {
                            throw new Error(res?.error || '删除失败');
                        }
                    }
                    catch (error) {
                        console.error('❌ Sheet删除失败:', error);
                        alert('删除失败，请重试');
                    }
                }, onMoveSheet: async (sheetId, direction) => {
                    if (!token || !id)
                        return;
                    // 权限检查：只有拥有者和写权限用户可以移动Sheet
                    const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
                    if (!hasWritePermission) {
                        console.warn('🔒 移动Sheet被拒绝：用户无写权限');
                        toast.warning('您只有只读权限，无法移动工作表。', 3000);
                        return;
                    }
                    try {
                        console.log('📍 移动Sheet请求:', { sheetId, direction });
                        console.log('📍 API移动方法检查:', {
                            hasMoveSheet: typeof api?.moveSheet === 'function',
                            moveSheetContent: api?.moveSheet?.toString?.()
                        });
                        // 强制使用api.moveSheet，忽略类型检查
                        let res;
                        try {
                            // @ts-ignore - 强制调用，忽略TypeScript检查
                            res = await api.moveSheet(token, id, sheetId, direction);
                            console.log('✅ 使用api.moveSheet成功');
                        }
                        catch (apiError) {
                            console.warn('⚠️ api.moveSheet调用失败，使用直接fetch:', apiError);
                            // 备选方案：直接使用fetch
                            const apiBase = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
                            const response = await fetch(`${apiBase}/api/grids/${id}/sheets/${sheetId}/move`, {
                                method: "PATCH",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ direction })
                            });
                            if (!response.ok)
                                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                            res = await response.json();
                        }
                        if (res?.success) {
                            // 服务器返回更新后的sheets列表
                            setSheets(res.data);
                            console.log('✅ Sheet移动成功');
                        }
                        else {
                            throw new Error(res?.error || '移动失败');
                        }
                    }
                    catch (error) {
                        console.error('❌ Sheet移动失败:', error);
                        alert(`移动失败: ${error.message || '请重试'}`);
                    }
                }, onDuplicateSheet: async (sheetId) => {
                    if (!token || !id)
                        return;
                    // 权限检查：只有拥有者和写权限用户可以复制Sheet
                    const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
                    if (!hasWritePermission) {
                        console.warn('🔒 复制Sheet被拒绝：用户无写权限');
                        toast.warning('您只有只读权限，无法复制工作表。', 3000);
                        return;
                    }
                    try {
                        console.log('📄 复制Sheet请求:', { sheetId });
                        console.log('📄 API对象检查:', {
                            hasApi: !!api,
                            apiKeys: Object.keys(api || {}),
                            hasDuplicateSheet: typeof api?.duplicateSheet === 'function',
                            duplicateSheetContent: api?.duplicateSheet?.toString?.()
                        });
                        // 强制使用api.duplicateSheet，忽略类型检查
                        let res;
                        try {
                            // @ts-ignore - 强制调用，忽略TypeScript检查
                            res = await api.duplicateSheet(token, id, sheetId);
                            console.log('✅ 使用api.duplicateSheet成功');
                        }
                        catch (apiError) {
                            console.warn('⚠️ api.duplicateSheet调用失败，使用直接fetch:', apiError);
                            // 备选方案：直接使用 request 函数
                            const apiBase = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
                            const response = await fetch(`${apiBase}/api/grids/${id}/sheets/${sheetId}/duplicate`, {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json"
                                }
                            });
                            if (!response.ok)
                                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                            res = await response.json();
                        }
                        if (res?.success) {
                            // 服务器返回更新后的sheets列表
                            setSheets(res.data);
                            console.log('✅ Sheet复制成功');
                        }
                        else {
                            throw new Error(res?.error || '复制失败');
                        }
                    }
                    catch (error) {
                        console.error('❌ Sheet复制失败:', error);
                        alert(`复制失败: ${error.message || '请重试'}`);
                    }
                }, onProtectSheet: async (sheetId) => {
                    if (!token || !id)
                        return;
                    // 权限检查：只有拥有者和写权限用户可以保护/取消保护Sheet
                    const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
                    if (!hasWritePermission) {
                        console.warn('🔒 保护Sheet被拒绝：用户无写权限');
                        toast.warning('您只有只读权限，无法修改工作表保护状态。', 3000);
                        return;
                    }
                    try {
                        console.log('🔒 保护Sheet请求:', { sheetId });
                        // 获取当前保护状态
                        const currentSheet = sheets.find(s => s.id === sheetId);
                        const isCurrentlyProtected = currentSheet?.is_protected || false;
                        const newProtectedState = !isCurrentlyProtected;
                        console.log('🔒 当前保护状态:', { isCurrentlyProtected, newProtectedState });
                        // 强制使用api.protectSheet，忽略类型检查
                        let res;
                        try {
                            // @ts-ignore - 强制调用，忽略TypeScript检查
                            res = await api.protectSheet(token, id, sheetId, newProtectedState);
                            console.log('✅ 使用api.protectSheet成功');
                        }
                        catch (apiError) {
                            console.warn('⚠️ api.protectSheet调用失败，使用直接fetch:', apiError);
                            // 备选方案：直接使用fetch
                            const apiBase = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
                            const response = await fetch(`${apiBase}/api/grids/${id}/sheets/${sheetId}/protect`, {
                                method: "PATCH",
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ protected: newProtectedState })
                            });
                            if (!response.ok)
                                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                            res = await response.json();
                        }
                        if (res?.success) {
                            // 服务器返回更新后的sheets列表
                            console.log('🔒 保护状态API返回的数据:', {
                                originalSheets: sheets,
                                newSheets: res.data,
                                targetSheetId: sheetId,
                                targetSheetBefore: sheets.find(s => s.id === sheetId),
                                targetSheetAfter: res.data.find(s => s.id === sheetId)
                            });
                            // 清理并验证数据后再设置
                            const cleanedSheets = res.data.map(sheet => ({
                                ...sheet,
                                name: String(sheet.name || '').trim(),
                                is_protected: Number(sheet.is_protected) || 0
                            }));
                            console.log('🧹 清理后的Sheet数据:', {
                                original: res.data.find(s => s.id === sheetId),
                                cleaned: cleanedSheets.find(s => s.id === sheetId)
                            });
                            setSheets(cleanedSheets);
                            console.log('✅ Sheet保护状态已更新');
                            // 强制触发渲染更新
                            console.log('🔄 强制触发组件重新渲染...');
                            alert(`工作表${newProtectedState ? '已保护' : '已取消保护'}`);
                        }
                        else {
                            throw new Error(res?.error || '保护状态更新失败');
                        }
                    }
                    catch (error) {
                        console.error('❌ Sheet保护失败:', error);
                        alert(`保护状态更新失败: ${error.message || '请重试'}`);
                    }
                } }) }) }));
}
