import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useGridStore } from "@/stores/gridStore";
import { getWS } from "@/services/websocket";
export default function FormulaBar({ gridId, sheetId }) {
    const active = useGridStore((s) => s.active);
    const cells = useGridStore((s) => s.cells);
    const setCell = useGridStore((s) => s.setCell);
    const [formulaValue, setFormulaValue] = useState("");
    // 当活动单元格改变时更新公式栏
    useEffect(() => {
        if (active) {
            const cellKey = `${active.row}:${active.col}`;
            const value = cells[cellKey];
            setFormulaValue(String(value || ""));
        }
        else {
            setFormulaValue("");
        }
    }, [active, cells]);
    // 获取列名（A, B, C...）
    const getColumnName = (col) => {
        let result = '';
        let temp = col;
        do {
            result = String.fromCharCode(65 + (temp % 26)) + result;
            temp = Math.floor(temp / 26) - 1;
        } while (temp >= 0);
        return result;
    };
    // 获取当前单元格地址
    const getCurrentCellAddress = () => {
        if (!active)
            return "";
        return `${getColumnName(active.col)}${active.row + 1}`;
    };
    // 提交公式
    const handleFormulaSubmit = () => {
        if (!active)
            return;
        setCell(active.row, active.col, formulaValue);
        const socket = getWS();
        socket?.emit("grid:operation", {
            id: crypto.randomUUID?.() || String(Date.now()),
            gridId,
            sheetId,
            actorId: null, // 添加actorId字段
            type: "cell:update",
            payload: { row: active.row, col: active.col, value: formulaValue }
        });
    };
    // 取消编辑
    const handleCancel = () => {
        if (active) {
            const cellKey = `${active.row}:${active.col}`;
            const originalValue = cells[cellKey];
            setFormulaValue(String(originalValue || ""));
        }
    };
    return (_jsxs("div", { className: "bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-20 h-7 border border-gray-300 rounded px-2 flex items-center text-sm font-medium bg-gray-50", children: getCurrentCellAddress() }), _jsx("button", { className: "h-7 px-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium", title: "\u51FD\u6570", children: "fx" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "w-6 h-6 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center text-red-600", onClick: handleCancel, title: "\u53D6\u6D88", children: "\u2715" }), _jsx("button", { className: "w-6 h-6 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center text-green-600", onClick: handleFormulaSubmit, title: "\u786E\u8BA4", children: "\u2713" })] }), _jsx("div", { className: "flex-1", children: _jsx("input", { type: "text", className: "w-full h-7 border border-gray-300 rounded px-2 text-sm outline-none focus:border-blue-500", value: formulaValue, onChange: (e) => setFormulaValue(e.target.value), onKeyDown: (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleFormulaSubmit();
                        }
                        else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancel();
                        }
                    }, placeholder: "\u5728\u6B64\u8F93\u5165\u516C\u5F0F\u6216\u6570\u503C" }) })] }));
}
