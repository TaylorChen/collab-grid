import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from "react";
export default function SheetTabs({ sheets, currentSheet, onSheetChange, onNewSheet }) {
    const [contextMenu, setContextMenu] = useState(null);
    const [editingSheet, setEditingSheet] = useState(null);
    const [editingName, setEditingName] = useState("");
    const handleContextMenu = (e, sheetId) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, sheetId });
    };
    const handleRename = (sheet) => {
        setEditingSheet(sheet.id);
        setEditingName(sheet.name);
        setContextMenu(null);
    };
    const handleRenameSubmit = (sheetId) => {
        // TODO: 实现重命名工作表的API调用
        console.log(`Rename sheet ${sheetId} to ${editingName}`);
        setEditingSheet(null);
        setEditingName("");
    };
    const handleDelete = (sheetId) => {
        if (sheets.length <= 1) {
            alert("至少需要保留一个工作表");
            return;
        }
        // TODO: 实现删除工作表的API调用
        console.log(`Delete sheet ${sheetId}`);
        setContextMenu(null);
    };
    // 点击其他地方关闭上下文菜单
    React.useEffect(() => {
        const handleClickOutside = () => {
            setContextMenu(null);
        };
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);
    return (_jsxs("div", { className: "bg-gray-100 border-t border-gray-200 px-4 py-2 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-1 flex-1 overflow-x-auto", children: [_jsxs("div", { className: "flex items-center gap-1 mr-2", children: [_jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", children: "\u2039" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", children: "\u203A" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", children: "\u2039\u2039" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", children: "\u203A\u203A" })] }), _jsx("div", { className: "flex items-center gap-1", children: sheets.map((sheet) => (_jsx("div", { className: `
                relative px-3 py-1 border-t border-l border-r rounded-t cursor-pointer text-sm
                ${sheet.id === currentSheet
                                ? 'bg-white border-gray-300 text-gray-900 font-medium'
                                : 'bg-gray-200 border-gray-300 text-gray-600 hover:bg-gray-100'}
              `, onClick: () => onSheetChange(sheet.id), onContextMenu: (e) => handleContextMenu(e, sheet.id), children: editingSheet === sheet.id ? (_jsx("input", { type: "text", className: "bg-transparent border-none outline-none w-20", value: editingName, onChange: (e) => setEditingName(e.target.value), onBlur: () => handleRenameSubmit(sheet.id), onKeyDown: (e) => {
                                    if (e.key === 'Enter') {
                                        handleRenameSubmit(sheet.id);
                                    }
                                    else if (e.key === 'Escape') {
                                        setEditingSheet(null);
                                        setEditingName("");
                                    }
                                }, autoFocus: true })) : (_jsx("span", { children: sheet.name })) }, sheet.id))) }), _jsx("button", { className: "w-8 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600 text-sm", onClick: onNewSheet, title: "\u63D2\u5165\u5DE5\u4F5C\u8868", children: "+" })] }), _jsx("div", { className: "flex items-center gap-2 ml-4", children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", children: "-" }), _jsx("span", { className: "text-sm text-gray-600 px-2", children: "100%" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-xs", children: "+" })] }) }), contextMenu && (_jsxs("div", { className: "fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-50 min-w-[120px]", style: { left: contextMenu.x, top: contextMenu.y }, children: [_jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => {
                            const sheet = sheets.find(s => s.id === contextMenu.sheetId);
                            if (sheet)
                                handleRename(sheet);
                        }, children: "\u91CD\u547D\u540D" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", onClick: () => handleDelete(contextMenu.sheetId), children: "\u5220\u9664" }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", children: "\u79FB\u52A8\u5230\u5DE6\u4FA7" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", children: "\u79FB\u52A8\u5230\u53F3\u4FA7" }), _jsx("div", { className: "border-t border-gray-100 my-1" }), _jsx("div", { className: "px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm", children: "\u4FDD\u62A4\u5DE5\u4F5C\u8868" })] }))] }));
}
