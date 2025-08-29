import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useGridStore } from "@/stores/gridStore";
export default function FreezePanesDialog({ isOpen, onClose }) {
    const freezeRows = useGridStore((s) => s.freezeRows);
    const freezeCols = useGridStore((s) => s.freezeCols);
    const setFreezePanes = useGridStore((s) => s.setFreezePanes);
    const clearFreeze = useGridStore((s) => s.clearFreeze);
    const rows = useGridStore((s) => s.rows);
    const cols = useGridStore((s) => s.cols);
    const [tempRows, setTempRows] = useState(freezeRows);
    const [tempCols, setTempCols] = useState(freezeCols);
    if (!isOpen)
        return null;
    const handleApply = () => {
        setFreezePanes(tempRows, tempCols);
        onClose();
    };
    const handleClear = () => {
        clearFreeze();
        setTempRows(0);
        setTempCols(0);
        onClose();
    };
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
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl p-6 w-96", children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "\u51BB\u7ED3\u7A97\u683C" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["\u51BB\u7ED3\u884C\u6570 (\u6700\u591A ", rows - 1, " \u884C)"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "number", min: "0", max: rows - 1, value: tempRows, onChange: (e) => setTempRows(Math.max(0, Math.min(parseInt(e.target.value) || 0, rows - 1))), className: "flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500", placeholder: "\u8F93\u5165\u884C\u6570" }), _jsx("span", { className: "text-sm text-gray-500", children: tempRows > 0 && `(冻结第1-${tempRows}行)` })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["\u51BB\u7ED3\u5217\u6570 (\u6700\u591A ", cols - 1, " \u5217)"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "number", min: "0", max: cols - 1, value: tempCols, onChange: (e) => setTempCols(Math.max(0, Math.min(parseInt(e.target.value) || 0, cols - 1))), className: "flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500", placeholder: "\u8F93\u5165\u5217\u6570" }), _jsx("span", { className: "text-sm text-gray-500", children: tempCols > 0 && `(冻结第A-${getColumnName(tempCols - 1)}列)` })] })] }), _jsxs("div", { className: "border-t pt-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u5FEB\u901F\u8BBE\u7F6E" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("button", { onClick: () => { setTempRows(1); setTempCols(0); }, className: "px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm", children: "\u51BB\u7ED3\u9996\u884C" }), _jsx("button", { onClick: () => { setTempRows(0); setTempCols(1); }, className: "px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm", children: "\u51BB\u7ED3\u9996\u5217" }), _jsx("button", { onClick: () => { setTempRows(1); setTempCols(1); }, className: "px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm", children: "\u51BB\u7ED3\u9996\u884C\u9996\u5217" }), _jsx("button", { onClick: () => { setTempRows(0); setTempCols(0); }, className: "px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm", children: "\u53D6\u6D88\u51BB\u7ED3" })] })] }), (freezeRows > 0 || freezeCols > 0) && (_jsx("div", { className: "bg-blue-50 p-3 rounded", children: _jsxs("p", { className: "text-sm text-blue-800", children: ["\u5F53\u524D\u51BB\u7ED3:", freezeRows > 0 && ` ${freezeRows}行`, freezeRows > 0 && freezeCols > 0 && ', ', freezeCols > 0 && ` ${freezeCols}列`] }) }))] }), _jsxs("div", { className: "flex justify-end gap-2 mt-6", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 border border-gray-300 rounded hover:bg-gray-50", children: "\u53D6\u6D88" }), _jsx("button", { onClick: handleClear, className: "px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600", disabled: freezeRows === 0 && freezeCols === 0, children: "\u6E05\u9664\u51BB\u7ED3" }), _jsx("button", { onClick: handleApply, className: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600", children: "\u5E94\u7528" })] })] }) }));
}
