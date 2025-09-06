import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { toast } from '@/stores/toastStore';
/**
 * 改进的Sheet标签组件 - Luckysheet风格
 */
export default function ImprovedSheetTabs({ sheets, currentSheet, userPermission, onSheetChange, onNewSheet, onRenameSheet, onDeleteSheet, onDuplicateSheet, onMoveSheet, onProtectSheet }) {
    // console.log('🔥🔥🔥 ImprovedSheetTabs组件渲染 🔥🔥🔥', { 
    //   sheetsLength: sheets.length, 
    //   allSheets: sheets,
    //   currentSheet,
    //   detailedSheets: sheets.map(s => ({
    //     id: s.id,
    //     name: s.name,
    //     nameType: typeof s.name,
    //     is_protected: s.is_protected,
    //     wholeObject: s
    //   }))
    // });
    const [contextMenu, setContextMenu] = useState(null);
    const [editingSheet, setEditingSheet] = useState(null);
    const [editingName, setEditingName] = useState('');
    // 右键菜单处理 - 智能定位避免遮挡
    const handleContextMenu = (e, sheetId) => {
        e.preventDefault();
        // 菜单估计尺寸 (根据实际菜单项数量调整)
        const menuWidth = 140;
        const menuHeight = 180; // 大约7个菜单项 * 28px 高度
        // 获取视窗尺寸
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        // 计算最佳位置
        let x = e.clientX;
        let y = e.clientY;
        // 右侧边界检查
        if (x + menuWidth > viewportWidth) {
            x = viewportWidth - menuWidth - 10; // 留10px边距
        }
        // 底部边界检查 - 关键修复
        if (y + menuHeight > viewportHeight) {
            y = viewportHeight - menuHeight - 10; // 留10px边距
        }
        // 确保不会超出左侧和顶部
        x = Math.max(10, x);
        y = Math.max(10, y);
        console.log('🖱️ Sheet右键菜单定位:', {
            original: { x: e.clientX, y: e.clientY },
            adjusted: { x, y },
            viewport: { width: viewportWidth, height: viewportHeight },
            menuSize: { width: menuWidth, height: menuHeight }
        });
        setContextMenu({ x, y, sheetId });
    };
    // 开始重命名
    const startRename = (sheet) => {
        // 权限检查：只有拥有者和写权限用户可以重命名Sheet
        const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
        if (!hasWritePermission) {
            toast.warning('您只有只读权限，无法重命名工作表。', 3000);
            setContextMenu(null);
            return;
        }
        // 检查Sheet是否受保护
        if (isSheetProtected(sheet.id)) {
            toast.warning('此工作表受到保护，无法重命名。\n要重命名工作表，请先取消保护。', 4000);
            setContextMenu(null);
            return;
        }
        console.log('✏️ 开始重命名Sheet:', { sheetId: sheet.id, currentName: sheet.name });
        setEditingSheet(sheet.id);
        setEditingName(sheet.name);
        setContextMenu(null);
        console.log('✏️ 重命名状态已设置，editingSheet:', sheet.id);
    };
    // 提交重命名
    const submitRename = (sheetId) => {
        console.log('💾 提交重命名:', { sheetId, editingName: editingName.trim(), hasCallback: !!onRenameSheet });
        if (editingName.trim() && onRenameSheet) {
            onRenameSheet(sheetId, editingName.trim());
        }
        else if (!editingName.trim()) {
            console.warn('⚠️ 重命名被取消：名称为空');
        }
        else if (!onRenameSheet) {
            console.warn('⚠️ 重命名失败：未提供onRenameSheet回调');
        }
        setEditingSheet(null);
        setEditingName('');
        console.log('✅ 重命名状态已清除');
    };
    // 删除Sheet
    const handleDelete = (sheetId) => {
        // 权限检查：只有拥有者和写权限用户可以删除Sheet
        const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
        if (!hasWritePermission) {
            toast.warning('您只有只读权限，无法删除工作表。', 3000);
            setContextMenu(null);
            return;
        }
        // 检查Sheet是否受保护
        if (isSheetProtected(sheetId)) {
            toast.warning('此工作表受到保护，无法删除。\n要删除工作表，请先取消保护。', 4000);
            setContextMenu(null);
            return;
        }
        if (sheets.length <= 1) {
            toast.warning('至少需要保留一个工作表', 3000);
            return;
        }
        if (onDeleteSheet) {
            onDeleteSheet(sheetId);
        }
        setContextMenu(null);
    };
    // 复制Sheet
    const handleDuplicate = (sheetId) => {
        // 权限检查：只有拥有者和写权限用户可以复制Sheet
        const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
        if (!hasWritePermission) {
            toast.warning('您只有只读权限，无法复制工作表。', 3000);
            setContextMenu(null);
            return;
        }
        console.log('📄 ImprovedSheetTabs 复制Sheet:', { sheetId, hasCallback: !!onDuplicateSheet });
        if (onDuplicateSheet) {
            onDuplicateSheet(sheetId);
        }
        else {
            console.error('❌ onDuplicateSheet 回调函数未提供');
            toast.error('复制功能未正确配置，请检查代码', 3000);
        }
        setContextMenu(null);
    };
    // 移动Sheet到左侧
    const handleMoveLeft = (sheetId) => {
        // 权限检查：只有拥有者和写权限用户可以移动Sheet
        const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
        if (!hasWritePermission) {
            toast.warning('您只有只读权限，无法移动工作表。', 3000);
            setContextMenu(null);
            return;
        }
        const currentIndex = sheets.findIndex(s => s.id === sheetId);
        if (currentIndex > 0) {
            console.log('🔄 移动Sheet到左侧:', { sheetId, from: currentIndex, to: currentIndex - 1 });
            if (onMoveSheet) {
                onMoveSheet(sheetId, 'left');
            }
            else {
                toast.error('移动Sheet功能需要在父组件中实现', 3000);
            }
        }
        else {
            toast.info('已经是最左侧的工作表', 2000);
        }
        setContextMenu(null);
    };
    // 移动Sheet到右侧
    const handleMoveRight = (sheetId) => {
        // 权限检查：只有拥有者和写权限用户可以移动Sheet
        const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
        if (!hasWritePermission) {
            toast.warning('您只有只读权限，无法移动工作表。', 3000);
            setContextMenu(null);
            return;
        }
        const currentIndex = sheets.findIndex(s => s.id === sheetId);
        if (currentIndex < sheets.length - 1) {
            console.log('🔄 移动Sheet到右侧:', { sheetId, from: currentIndex, to: currentIndex + 1 });
            if (onMoveSheet) {
                onMoveSheet(sheetId, 'right');
            }
            else {
                toast.error('移动Sheet功能需要在父组件中实现', 3000);
            }
        }
        else {
            toast.info('已经是最右侧的工作表', 2000);
        }
        setContextMenu(null);
    };
    // 保护工作表
    const handleProtect = (sheetId) => {
        // 权限检查：只有拥有者和写权限用户可以保护Sheet
        const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
        if (!hasWritePermission) {
            toast.warning('您只有只读权限，无法修改工作表保护状态。', 3000);
            setContextMenu(null);
            return;
        }
        console.log('🔒 保护工作表:', { sheetId });
        if (onProtectSheet) {
            onProtectSheet(sheetId);
        }
        else {
            toast.info('工作表保护功能开发中...', 3000);
        }
        setContextMenu(null);
    };
    // 检查Sheet是否受保护
    const isSheetProtected = (sheetId) => {
        const sheet = sheets.find(s => s.id === sheetId);
        return sheet?.is_protected || false;
    };
    // 工作表属性
    const handleProperties = (sheetId) => {
        const sheet = sheets.find(s => s.id === sheetId);
        if (sheet) {
            const isProtected = isSheetProtected(sheetId);
            const protectionStatus = isProtected ? '受保护' : '未保护';
            console.log('📋 工作表属性:', { sheetId, sheet, isProtected });
            alert(`📋 工作表属性

📝 名称: ${sheet.name}
🆔 ID: ${sheet.id}
👁️ 状态: ${sheet.visible !== false ? '可见' : '隐藏'}
🔒 保护: ${protectionStatus}
📊 类型: 工作表

💡 提示: 右键菜单可以重命名、复制、移动或保护此工作表。`);
        }
        setContextMenu(null);
    };
    // 点击外部关闭菜单
    React.useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);
    return (_jsxs("div", { className: "bg-gray-100 border-t border-gray-200 px-2 py-1 flex items-center justify-between relative select-none", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", title: "\u9996\u9875", children: "\u2AF7\u2AF7" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", title: "\u4E0A\u4E00\u9875", children: "\u2039" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", title: "\u4E0B\u4E00\u9875", children: "\u203A" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", title: "\u672B\u9875", children: "\u2AF8\u2AF8" })] }), _jsxs("div", { className: "flex-1 flex items-center gap-1 mx-2 overflow-x-auto", children: [sheets.map((sheet) => {
                        // console.log('🏷️ 渲染Sheet标签:', { id: sheet.id, name: sheet.name, nameType: typeof sheet.name });
                        // console.log('🚨🚨🚨 SHEET渲染调试 🚨🚨🚨', sheet);
                        return (_jsxs("div", { className: `
              relative px-3 py-1 border-t border-l border-r rounded-t cursor-pointer text-sm min-w-24 text-center
              transition-colors duration-150
              ${sheet.id === currentSheet
                                ? 'bg-white border-gray-400 text-gray-800 border-b-0 font-medium'
                                : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100 border-b'}
            `, onClick: () => onSheetChange(sheet.id), onContextMenu: (e) => handleContextMenu(e, sheet.id), children: [editingSheet === sheet.id ? (_jsx("input", { type: "text", value: editingName, onChange: (e) => setEditingName(e.target.value), onBlur: () => submitRename(sheet.id), onKeyDown: (e) => {
                                        if (e.key === 'Enter') {
                                            submitRename(sheet.id);
                                        }
                                        else if (e.key === 'Escape') {
                                            setEditingSheet(null);
                                            setEditingName('');
                                        }
                                    }, className: "bg-transparent border-none outline-none text-center w-full", autoFocus: true })) : (_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: String(sheet.name) }), Boolean(sheet.is_protected) && (_jsx("span", { className: "text-orange-500 text-xs", title: "\u6B64\u5DE5\u4F5C\u8868\u5DF2\u53D7\u4FDD\u62A4", children: "\uD83D\uDD12" }))] })), _jsx("div", { className: "absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t opacity-0 group-hover:opacity-100 transition-opacity" })] }, sheet.id));
                    }), onNewSheet && (_jsx("button", { className: "w-8 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600 text-sm", onClick: onNewSheet, title: "\u63D2\u5165\u5DE5\u4F5C\u8868", children: "+" }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", children: "-" }), _jsx("span", { className: "text-sm text-gray-600 px-2 min-w-12 text-center", children: "100%" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", children: "+" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", title: "\u666E\u901A\u89C6\u56FE", children: "\u229E" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", title: "\u5206\u9875\u9884\u89C8", children: "\uD83D\uDCC4" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", title: "\u5206\u9875\u7B26\u9884\u89C8", children: "\uD83D\uDCCB" })] })] }), contextMenu && (_jsxs("div", { className: "fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-[9999] min-w-[140px]", style: { left: contextMenu.x, top: contextMenu.y }, children: [_jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => {
                            const sheet = sheets.find(s => s.id === contextMenu.sheetId);
                            if (sheet)
                                startRename(sheet);
                        }, children: "\u270F\uFE0F \u91CD\u547D\u540D\u5DE5\u4F5C\u8868" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => handleDuplicate(contextMenu.sheetId), children: "\uD83D\uDCC4 \u590D\u5236\u5DE5\u4F5C\u8868" }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => handleDelete(contextMenu.sheetId), children: "\uD83D\uDDD1\uFE0F \u5220\u9664\u5DE5\u4F5C\u8868" }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => handleMoveLeft(contextMenu.sheetId), children: "\uD83D\uDCCD \u79FB\u52A8\u5230\u5DE6\u4FA7" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => handleMoveRight(contextMenu.sheetId), children: "\uD83D\uDCCD \u79FB\u52A8\u5230\u53F3\u4FA7" }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => handleProtect(contextMenu.sheetId), children: isSheetProtected(contextMenu.sheetId) ? '🔓 取消保护' : '🔒 保护工作表' }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => handleProperties(contextMenu.sheetId), children: "\uD83D\uDCCB \u5DE5\u4F5C\u8868\u5C5E\u6027" })] }))] }));
}
