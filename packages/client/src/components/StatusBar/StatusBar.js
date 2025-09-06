import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useGridStore } from '@/stores/gridStore';
/**
 * 状态栏 - 显示当前选中信息和统计
 */
export default function StatusBar({ gridId, sheetId }) {
    const { active, selection, cells, rows, cols } = useGridStore((s) => ({
        active: s.active,
        selection: s.selection,
        cells: s.cells || {},
        rows: s.rows,
        cols: s.cols
    }));
    // 计算选中区域的统计信息
    const statistics = useMemo(() => {
        let selectedCells = [];
        if (selection?.type === 'cell' && selection.row !== undefined && selection.col !== undefined) {
            selectedCells = [`${selection.row}:${selection.col}`];
        }
        else if (selection?.type === 'row' && selection.row !== undefined) {
            // 整行选中
            for (let c = 0; c < cols; c++) {
                selectedCells.push(`${selection.row}:${c}`);
            }
        }
        else if (selection?.type === 'col' && selection.col !== undefined) {
            // 整列选中
            for (let r = 0; r < rows; r++) {
                selectedCells.push(`${r}:${selection.col}`);
            }
        }
        else if (selection?.type === 'all') {
            // 全选
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    selectedCells.push(`${r}:${c}`);
                }
            }
        }
        else if (selection?.type === 'multi') {
            // 多选
            if (selection.selectedCells) {
                selectedCells = Array.from(selection.selectedCells);
            }
            if (selection.selectedRows) {
                selection.selectedRows.forEach(row => {
                    for (let c = 0; c < cols; c++) {
                        selectedCells.push(`${row}:${c}`);
                    }
                });
            }
            if (selection.selectedCols) {
                selection.selectedCols.forEach(col => {
                    for (let r = 0; r < rows; r++) {
                        selectedCells.push(`${r}:${col}`);
                    }
                });
            }
        }
        // 去重
        selectedCells = [...new Set(selectedCells)];
        // 计算统计信息
        const values = [];
        let nonEmptyCount = 0;
        let textCount = 0;
        let numberCount = 0;
        selectedCells.forEach(cellKey => {
            const value = cells[cellKey];
            if (value != null && value !== '') {
                nonEmptyCount++;
                const numValue = Number(value);
                if (!isNaN(numValue)) {
                    values.push(numValue);
                    numberCount++;
                }
                else {
                    textCount++;
                }
            }
        });
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = values.length > 0 ? sum / values.length : 0;
        const min = values.length > 0 ? Math.min(...values) : 0;
        const max = values.length > 0 ? Math.max(...values) : 0;
        return {
            totalCells: selectedCells.length,
            nonEmptyCount,
            textCount,
            numberCount,
            sum,
            avg,
            min,
            max
        };
    }, [selection, cells, rows, cols]);
    // 获取当前位置信息
    const getPositionInfo = () => {
        if (!active)
            return '无选择';
        const colName = String.fromCharCode(65 + active.col);
        const rowName = active.row + 1;
        if (selection?.type === 'row') {
            return `第${rowName}行`;
        }
        else if (selection?.type === 'col') {
            return `第${colName}列`;
        }
        else if (selection?.type === 'all') {
            return '全选';
        }
        else if (selection?.type === 'multi') {
            const rowCount = selection.selectedRows?.size || 0;
            const colCount = selection.selectedCols?.size || 0;
            const cellCount = selection.selectedCells?.size || 0;
            return `多选 (${rowCount}行, ${colCount}列, ${cellCount}单元格)`;
        }
        else {
            return `${colName}${rowName}`;
        }
    };
    // 格式化数字
    const formatNumber = (num) => {
        if (Number.isInteger(num)) {
            return num.toString();
        }
        return num.toFixed(2);
    };
    return (_jsxs("div", { className: "bg-white border-t border-gray-200 px-4 py-1 flex items-center justify-between text-xs text-gray-600 select-none", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: "\u4F4D\u7F6E:" }), _jsx("span", { className: "text-blue-600 font-mono", children: getPositionInfo() })] }), statistics.totalCells > 0 && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: "\u9009\u4E2D:" }), _jsxs("span", { children: [statistics.totalCells, " \u4E2A\u5355\u5143\u683C"] }), statistics.nonEmptyCount > 0 && (_jsxs("span", { children: ["(", statistics.nonEmptyCount, " \u4E2A\u6709\u5185\u5BB9)"] }))] })), statistics.numberCount > 0 && (_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "font-medium", children: "\u6C42\u548C:" }), _jsx("span", { className: "text-green-600 font-mono", children: formatNumber(statistics.sum) })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "font-medium", children: "\u5E73\u5747:" }), _jsx("span", { className: "text-blue-600 font-mono", children: formatNumber(statistics.avg) })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "font-medium", children: "\u6700\u5C0F:" }), _jsx("span", { className: "text-orange-600 font-mono", children: formatNumber(statistics.min) })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "font-medium", children: "\u6700\u5927:" }), _jsx("span", { className: "text-purple-600 font-mono", children: formatNumber(statistics.max) })] })] }))] }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("span", { children: ["\u8868\u683C: ", rows, "\u884C \u00D7 ", cols, "\u5217"] }), _jsxs("span", { children: ["\u6570\u636E: ", Object.keys(cells).length, " \u4E2A\u5355\u5143\u683C\u6709\u5185\u5BB9"] })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 bg-green-500 rounded-full" }), _jsx("span", { children: "\u5DF2\u8FDE\u63A5" })] }), _jsx("span", { children: "\u7F29\u653E: 100%" }), _jsx("span", { className: "text-gray-500", children: "Collab Grid v1.0" })] })] })] }));
}
