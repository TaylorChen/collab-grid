import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useGridStore } from '@/stores/gridStore';
import { getWS } from '@/services/websocket';
import { toast } from '@/stores/toastStore';
/**
 * 表格右键上下文菜单 - Luckysheet风格
 */
export default function GridContextMenu({ x, y, row, col, onClose, gridId, sheetId, userPermission }) {
    const { cells, setCell, setStyle, styles, insertRow, deleteRow, insertCol, deleteCol } = useGridStore((s) => ({
        cells: s.cells || {},
        setCell: s.setCell,
        setStyle: s.setStyle,
        styles: s.styles || {},
        insertRow: s.insertRow,
        deleteRow: s.deleteRow,
        insertCol: s.insertCol,
        deleteCol: s.deleteCol
    }));
    const [showFormatMenu, setShowFormatMenu] = useState(false);
    const cellKey = `${row}:${col}`;
    const currentValue = cells[cellKey];
    const currentStyle = styles[cellKey];
    // 检查用户是否有编辑权限
    const hasWritePermission = userPermission === 'owner' || userPermission === 'write';
    const isReadOnly = userPermission === 'read';
    // 辅助函数：发送单元格更新到服务器
    const sendCellUpdate = (newValue) => {
        const socket = getWS();
        if (socket) {
            socket.emit("grid:operation", {
                id: crypto.randomUUID?.() || String(Date.now()),
                gridId,
                sheetId,
                actorId: null,
                type: "cell:update",
                payload: { row, col, value: newValue }
            });
            console.log('📡 发送WebSocket保存事件:', { row, col, value: newValue });
        }
        else {
            console.warn('⚠️ WebSocket未连接，无法保存到服务器');
        }
    };
    // 复制
    const handleCopy = () => {
        if (currentValue != null) {
            navigator.clipboard.writeText(String(currentValue));
            console.log('📋 复制内容:', currentValue);
        }
        onClose();
    };
    // 剪切
    const handleCut = () => {
        if (isReadOnly) {
            toast.warning('您只有只读权限，无法进行编辑操作。', 3000);
            onClose();
            return;
        }
        if (currentValue != null) {
            navigator.clipboard.writeText(String(currentValue));
            setCell(row, col, '');
            sendCellUpdate('');
            console.log('✂️ 剪切内容:', currentValue);
        }
        onClose();
    };
    // 粘贴
    const handlePaste = async () => {
        if (isReadOnly) {
            toast.warning('您只有只读权限，无法进行编辑操作。', 3000);
            onClose();
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            setCell(row, col, text);
            sendCellUpdate(text);
            console.log('📌 粘贴内容:', text);
        }
        catch (error) {
            console.error('粘贴失败:', error);
        }
        onClose();
    };
    // 清除内容
    const handleClearContent = () => {
        if (isReadOnly) {
            toast.warning('您只有只读权限，无法进行编辑操作。', 3000);
            onClose();
            return;
        }
        setCell(row, col, '');
        sendCellUpdate('');
        console.log('🗑️ 清除内容');
        onClose();
    };
    // 清除格式
    const handleClearFormat = () => {
        setStyle(row, col, {});
        onClose();
    };
    // 插入行
    const handleInsertRow = (position) => {
        // 权限检查
        if (isReadOnly) {
            toast.warning('您只有只读权限，无法插入行。', 3000);
            onClose();
            return;
        }
        console.log(`➕ 插入行 ${position === 'above' ? '上方' : '下方'}`);
        // 本地更新
        const where = position === 'above' ? 'before' : 'after';
        insertRow(row, where, 1);
        // 发送到服务器
        const socket = getWS();
        if (socket) {
            socket.emit('grid:operation', {
                id: crypto.randomUUID?.() || String(Date.now()),
                gridId,
                sheetId,
                type: 'grid:row:insert',
                payload: { at: row, where, count: 1 }
            });
            console.log('📡 发送插入行事件:', { row, where });
        }
        onClose();
    };
    // 插入列
    const handleInsertCol = (position) => {
        // 权限检查
        if (isReadOnly) {
            toast.warning('您只有只读权限，无法插入列。', 3000);
            onClose();
            return;
        }
        console.log(`➕ 插入列 ${position === 'left' ? '左侧' : '右侧'}`);
        // 本地更新
        const where = position === 'left' ? 'before' : 'after';
        insertCol(col, where, 1);
        // 发送到服务器
        const socket = getWS();
        if (socket) {
            socket.emit('grid:operation', {
                id: crypto.randomUUID?.() || String(Date.now()),
                gridId,
                sheetId,
                type: 'grid:col:insert',
                payload: { at: col, where, count: 1 }
            });
            console.log('📡 发送插入列事件:', { col, where });
        }
        onClose();
    };
    // 删除行
    const handleDeleteRow = () => {
        // 权限检查
        if (isReadOnly) {
            toast.warning('您只有只读权限，无法删除行。', 3000);
            onClose();
            return;
        }
        console.log('🗑️ 删除行');
        // 确认删除
        const confirmed = window.confirm(`确定要删除第 ${row + 1} 行吗？此操作不可撤销。`);
        if (!confirmed) {
            onClose();
            return;
        }
        // 本地更新
        deleteRow(row, 1);
        // 发送到服务器
        const socket = getWS();
        if (socket) {
            socket.emit('grid:operation', {
                id: crypto.randomUUID?.() || String(Date.now()),
                gridId,
                sheetId,
                type: 'grid:row:delete',
                payload: { at: row, count: 1 }
            });
            console.log('📡 发送删除行事件:', { row });
        }
        onClose();
    };
    // 删除列
    const handleDeleteCol = () => {
        // 权限检查
        if (isReadOnly) {
            toast.warning('您只有只读权限，无法删除列。', 3000);
            onClose();
            return;
        }
        console.log('🗑️ 删除列');
        // 确认删除
        const colName = String.fromCharCode(65 + col);
        const confirmed = window.confirm(`确定要删除第 ${colName} 列吗？此操作不可撤销。`);
        if (!confirmed) {
            onClose();
            return;
        }
        // 本地更新
        deleteCol(col, 1);
        // 发送到服务器
        const socket = getWS();
        if (socket) {
            socket.emit('grid:operation', {
                id: crypto.randomUUID?.() || String(Date.now()),
                gridId,
                sheetId,
                type: 'grid:col:delete',
                payload: { at: col, count: 1 }
            });
            console.log('📡 发送删除列事件:', { col });
        }
        onClose();
    };
    // 快速格式化
    const handleQuickFormat = (format) => {
        setStyle(row, col, { ...currentStyle, ...format });
        console.log('⚡ 快速格式化:', format);
        onClose();
    };
    return (_jsxs("div", { className: "fixed bg-white border border-gray-300 rounded shadow-lg py-1 z-[9999] min-w-[180px] text-sm select-none", style: { left: x, top: y }, children: [_jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: handleCopy, children: [_jsx("span", { className: "text-gray-500", children: "\uD83D\uDCCB" }), _jsx("span", { children: "\u590D\u5236" }), _jsx("span", { className: "ml-auto text-xs text-gray-400", children: "Ctrl+C" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: handleCut, children: [_jsx("span", { className: "text-gray-500", children: "\u2702\uFE0F" }), _jsx("span", { children: "\u526A\u5207" }), _jsx("span", { className: "ml-auto text-xs text-gray-400", children: "Ctrl+X" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: handlePaste, children: [_jsx("span", { className: "text-gray-500", children: "\uD83D\uDCCC" }), _jsx("span", { children: "\u7C98\u8D34" }), _jsx("span", { className: "ml-auto text-xs text-gray-400", children: "Ctrl+V" })] }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: () => handleInsertRow('above'), children: [_jsx("span", { className: "text-gray-500", children: "\u2B06\uFE0F" }), _jsx("span", { children: "\u5728\u4E0A\u65B9\u63D2\u5165\u884C" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: () => handleInsertRow('below'), children: [_jsx("span", { className: "text-gray-500", children: "\u2B07\uFE0F" }), _jsx("span", { children: "\u5728\u4E0B\u65B9\u63D2\u5165\u884C" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: () => handleInsertCol('left'), children: [_jsx("span", { className: "text-gray-500", children: "\u2B05\uFE0F" }), _jsx("span", { children: "\u5728\u5DE6\u4FA7\u63D2\u5165\u5217" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: () => handleInsertCol('right'), children: [_jsx("span", { className: "text-gray-500", children: "\u27A1\uFE0F" }), _jsx("span", { children: "\u5728\u53F3\u4FA7\u63D2\u5165\u5217" })] }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: handleDeleteRow, children: [_jsx("span", { className: "text-gray-500", children: "\uD83D\uDDD1\uFE0F" }), _jsx("span", { children: "\u5220\u9664\u884C" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: handleDeleteCol, children: [_jsx("span", { className: "text-gray-500", children: "\uD83D\uDDD1\uFE0F" }), _jsx("span", { children: "\u5220\u9664\u5217" })] }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: handleClearContent, children: [_jsx("span", { className: "text-gray-500", children: "\uD83E\uDDF9" }), _jsx("span", { children: "\u6E05\u9664\u5185\u5BB9" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", onClick: handleClearFormat, children: [_jsx("span", { className: "text-gray-500", children: "\uD83C\uDFA8" }), _jsx("span", { children: "\u6E05\u9664\u683C\u5F0F" })] }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 relative", onMouseEnter: () => setShowFormatMenu(true), onMouseLeave: () => setShowFormatMenu(false), children: [_jsx("span", { className: "text-gray-500", children: "\u26A1" }), _jsx("span", { children: "\u5FEB\u901F\u683C\u5F0F\u5316" }), _jsx("span", { className: "ml-auto text-xs text-gray-400", children: "\u25B6" }), showFormatMenu && (_jsxs("div", { className: "absolute left-full top-0 ml-1 bg-white border border-gray-300 rounded shadow-lg py-1 min-w-[140px]", children: [_jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer", onClick: () => handleQuickFormat({ bold: true }), children: _jsx("span", { className: "font-bold", children: "\u52A0\u7C97" }) }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer", onClick: () => handleQuickFormat({ italic: true }), children: _jsx("span", { className: "italic", children: "\u659C\u4F53" }) }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer", onClick: () => handleQuickFormat({ underline: true }), children: _jsx("span", { className: "underline", children: "\u4E0B\u5212\u7EBF" }) }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer", onClick: () => handleQuickFormat({ color: '#ff0000' }), children: _jsx("span", { style: { color: '#ff0000' }, children: "\u7EA2\u8272\u6587\u5B57" }) }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer", onClick: () => handleQuickFormat({ bg: '#ffff00' }), children: _jsx("span", { style: { backgroundColor: '#ffff00' }, children: "\u9EC4\u8272\u80CC\u666F" }) }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer", onClick: () => handleQuickFormat({ fontSize: 16 }), children: "\u5927\u5B57\u4F53 (16px)" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer", onClick: () => handleQuickFormat({ fontSize: 10 }), children: "\u5C0F\u5B57\u4F53 (10px)" })] }))] }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", children: [_jsx("span", { className: "text-gray-500", children: "\uD83D\uDD17" }), _jsx("span", { children: "\u63D2\u5165\u8D85\u94FE\u63A5" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", children: [_jsx("span", { className: "text-gray-500", children: "\uD83D\uDCAC" }), _jsx("span", { children: "\u63D2\u5165\u6279\u6CE8" })] }), _jsxs("div", { className: "px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2", children: [_jsx("span", { className: "text-gray-500", children: "\u2699\uFE0F" }), _jsx("span", { children: "\u5355\u5143\u683C\u5C5E\u6027" })] }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsxs("div", { className: "px-3 py-1 text-xs text-gray-500", children: ["\u5355\u5143\u683C: ", String.fromCharCode(65 + col), row + 1] })] }));
}
