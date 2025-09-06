import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useState } from "react";
import { useGridStore } from "@/stores/gridStore";
const CELL_W = 80; // 单元格默认宽度
const CELL_H = 24; // 单元格默认高度
const HEADER_W = 60; // 行标宽度
const HEADER_H = 24; // 列标高度
export default function FrozenGridCanvas({ gridId, sheetId, onCellClick, onCellRightClick }) {
    // Canvas refs for 4 regions
    const frozenCornerRef = useRef(null);
    const frozenTopRef = useRef(null);
    const frozenLeftRef = useRef(null);
    const mainCanvasRef = useRef(null);
    // Headers
    const colHeaderRef = useRef(null);
    const rowHeaderRef = useRef(null);
    const containerRef = useRef(null);
    // Store state
    const rows = useGridStore((s) => s.rows);
    const cols = useGridStore((s) => s.cols);
    const cells = useGridStore((s) => s.cells);
    const styles = useGridStore((s) => s.styles);
    const rowHeights = useGridStore((s) => s.rowHeights);
    const colWidths = useGridStore((s) => s.colWidths);
    const freezeRows = useGridStore((s) => s.freezeRows) ?? 0;
    const freezeCols = useGridStore((s) => s.freezeCols) ?? 0;
    const getCellDisplayValue = useGridStore((s) => s.getCellDisplayValue);
    const setActive = useGridStore((s) => s.setActive);
    // Scroll state
    const [scroll, setScroll] = useState({ left: 0, top: 0 });
    // Calculate frozen area dimensions
    const frozenWidth = freezeCols > 0 ? colWidths.slice(0, freezeCols).reduce((sum, w) => sum + (w ?? CELL_W), 0) : 0;
    const frozenHeight = freezeRows > 0 ? rowHeights.slice(0, freezeRows).reduce((sum, h) => sum + (h ?? CELL_H), 0) : 0;
    // Render cell content helper
    const renderCell = (ctx, row, col, x, y, width, height) => {
        const cellKey = `${row}:${col}`;
        const style = styles[cellKey] || {};
        // Background
        if (style.bg) {
            ctx.fillStyle = style.bg;
            ctx.fillRect(x + 1, y + 1, width - 1, height - 1);
        }
        // Grid lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y);
        ctx.lineTo(x + 0.5, y + height);
        ctx.moveTo(x, y + 0.5);
        ctx.lineTo(x + width, y + 0.5);
        ctx.stroke();
        // Text
        const cellValue = getCellDisplayValue(row, col);
        const text = String(cellValue ?? "");
        if (text.trim()) {
            const fontSize = style.fontSize || 12;
            ctx.font = `${style.bold ? 'bold ' : ''}${fontSize}px system-ui, -apple-system, Segoe UI, Roboto`;
            ctx.fillStyle = style.color || '#111827';
            ctx.textBaseline = 'middle';
            const lines = text.split('\n');
            const lineHeight = Math.max(12, fontSize) * 1.2;
            const centerY = y + height / 2;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const textWidth = ctx.measureText(line).width;
                let textX = x + 6; // left align by default
                if (style.align === 'center') {
                    textX = x + width / 2 - textWidth / 2;
                }
                else if (style.align === 'right') {
                    textX = x + width - 6 - textWidth;
                }
                const textY = centerY + (i - (lines.length - 1) / 2) * lineHeight;
                ctx.fillText(line, textX, textY);
            }
        }
    };
    // Render frozen corner (top-left intersection)
    useEffect(() => {
        if (freezeRows === 0 || freezeCols === 0)
            return;
        const canvas = frozenCornerRef.current;
        if (!canvas)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        canvas.width = frozenWidth;
        canvas.height = frozenHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, frozenWidth, frozenHeight);
        let y = 0;
        for (let r = 0; r < freezeRows; r++) {
            const h = rowHeights[r] ?? CELL_H;
            let x = 0;
            for (let c = 0; c < freezeCols; c++) {
                const w = colWidths[c] ?? CELL_W;
                renderCell(ctx, r, c, x, y, w, h);
                x += w;
            }
            y += h;
        }
    }, [freezeRows, freezeCols, frozenWidth, frozenHeight, cells, styles, rowHeights, colWidths, getCellDisplayValue]);
    // Render frozen top strip (frozen rows, scrollable columns)
    useEffect(() => {
        if (freezeRows === 0)
            return;
        const canvas = frozenTopRef.current;
        const container = containerRef.current;
        if (!canvas || !container)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const containerWidth = container.clientWidth;
        const visibleWidth = Math.max(0, containerWidth - HEADER_W - frozenWidth);
        canvas.width = visibleWidth;
        canvas.height = frozenHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, visibleWidth, frozenHeight);
        // Calculate which columns to render based on scroll
        let startCol = freezeCols;
        let leftOffset = scroll.left;
        while (startCol < cols) {
            const w = colWidths[startCol] ?? CELL_W;
            if (leftOffset < w)
                break;
            leftOffset -= w;
            startCol++;
        }
        let y = 0;
        for (let r = 0; r < freezeRows; r++) {
            const h = rowHeights[r] ?? CELL_H;
            let x = -leftOffset;
            for (let c = startCol; c < cols && x < visibleWidth; c++) {
                const w = colWidths[c] ?? CELL_W;
                if (x + w > 0) { // Only render visible cells
                    renderCell(ctx, r, c, x, y, w, h);
                }
                x += w;
            }
            y += h;
        }
    }, [freezeRows, freezeCols, frozenHeight, scroll.left, cells, styles, rowHeights, colWidths, getCellDisplayValue]);
    // Render frozen left strip (frozen columns, scrollable rows)
    useEffect(() => {
        if (freezeCols === 0)
            return;
        const canvas = frozenLeftRef.current;
        const container = containerRef.current;
        if (!canvas || !container)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const containerHeight = container.clientHeight;
        const visibleHeight = Math.max(0, containerHeight - HEADER_H - frozenHeight);
        canvas.width = frozenWidth;
        canvas.height = visibleHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, frozenWidth, visibleHeight);
        // Calculate which rows to render based on scroll
        let startRow = freezeRows;
        let topOffset = scroll.top;
        while (startRow < rows) {
            const h = rowHeights[startRow] ?? CELL_H;
            if (topOffset < h)
                break;
            topOffset -= h;
            startRow++;
        }
        let x = 0;
        for (let c = 0; c < freezeCols; c++) {
            const w = colWidths[c] ?? CELL_W;
            let y = -topOffset;
            for (let r = startRow; r < rows && y < visibleHeight; r++) {
                const h = rowHeights[r] ?? CELL_H;
                if (y + h > 0) { // Only render visible cells
                    renderCell(ctx, r, c, x, y, w, h);
                }
                y += h;
            }
            x += w;
        }
    }, [freezeCols, freezeRows, frozenWidth, scroll.top, cells, styles, rowHeights, colWidths, getCellDisplayValue]);
    // Render main scrollable area
    useEffect(() => {
        const canvas = mainCanvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container)
            return;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const visibleWidth = Math.max(0, containerWidth - HEADER_W - frozenWidth);
        const visibleHeight = Math.max(0, containerHeight - HEADER_H - frozenHeight);
        canvas.width = visibleWidth;
        canvas.height = visibleHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, visibleWidth, visibleHeight);
        // Calculate which cells to render based on scroll
        let startCol = freezeCols;
        let leftOffset = scroll.left;
        while (startCol < cols) {
            const w = colWidths[startCol] ?? CELL_W;
            if (leftOffset < w)
                break;
            leftOffset -= w;
            startCol++;
        }
        let startRow = freezeRows;
        let topOffset = scroll.top;
        while (startRow < rows) {
            const h = rowHeights[startRow] ?? CELL_H;
            if (topOffset < h)
                break;
            topOffset -= h;
            startRow++;
        }
        let y = -topOffset;
        for (let r = startRow; r < rows && y < visibleHeight; r++) {
            const h = rowHeights[r] ?? CELL_H;
            let x = -leftOffset;
            for (let c = startCol; c < cols && x < visibleWidth; c++) {
                const w = colWidths[c] ?? CELL_W;
                if (x + w > 0 && y + h > 0) { // Only render visible cells
                    renderCell(ctx, r, c, x, y, w, h);
                }
                x += w;
            }
            y += h;
        }
    }, [scroll, freezeRows, freezeCols, frozenWidth, frozenHeight, cells, styles, rowHeights, colWidths, getCellDisplayValue]);
    // Handle scroll
    const handleScroll = (e) => {
        const target = e.target;
        setScroll({
            left: target.scrollLeft,
            top: target.scrollTop
        });
    };
    // Handle cell clicks
    const handleCanvasClick = (e, offsetRow = 0, offsetCol = 0) => {
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Convert pixel coordinates to cell coordinates
        let col = offsetCol;
        let accX = 0;
        while (col < cols) {
            const w = colWidths[col] ?? CELL_W;
            if (accX + w > x)
                break;
            accX += w;
            col++;
        }
        let row = offsetRow;
        let accY = 0;
        while (row < rows) {
            const h = rowHeights[row] ?? CELL_H;
            if (accY + h > y)
                break;
            accY += h;
            row++;
        }
        if (row < rows && col < cols) {
            setActive(row, col);
            onCellClick?.(row, col);
        }
    };
    return (_jsxs("div", { ref: containerRef, className: "relative w-full h-full bg-white overflow-hidden", children: [_jsxs("div", { className: "absolute top-0 left-0 w-full h-6 bg-gray-100 border-b z-40", children: [_jsx("div", { className: "absolute top-0 left-0 w-15 h-6 bg-gray-200 border-r" }), freezeCols > 0 && (_jsx("div", { className: "absolute top-0 left-15 bg-gray-100", style: { width: frozenWidth } })), _jsx("div", { className: "absolute top-0 bg-gray-100 overflow-hidden", style: {
                            left: HEADER_W + frozenWidth,
                            right: 0
                        } })] }), _jsx("div", { className: "absolute top-6 left-0 w-15 bg-gray-100 border-r z-40", style: { bottom: 0 } }), freezeRows > 0 && freezeCols > 0 && (_jsx("canvas", { ref: frozenCornerRef, className: "absolute z-30", style: {
                    top: HEADER_H,
                    left: HEADER_W,
                    width: frozenWidth,
                    height: frozenHeight
                }, onClick: (e) => handleCanvasClick(e, 0, 0) })), freezeRows > 0 && (_jsx("canvas", { ref: frozenTopRef, className: "absolute z-30", style: {
                    top: HEADER_H,
                    left: HEADER_W + frozenWidth,
                    right: 0,
                    height: frozenHeight
                }, onClick: (e) => handleCanvasClick(e, 0, freezeCols) })), freezeCols > 0 && (_jsx("canvas", { ref: frozenLeftRef, className: "absolute z-30", style: {
                    top: HEADER_H + frozenHeight,
                    left: HEADER_W,
                    width: frozenWidth,
                    bottom: 0
                }, onClick: (e) => handleCanvasClick(e, freezeRows, 0) })), _jsx("div", { className: "absolute overflow-auto", style: {
                    top: HEADER_H + frozenHeight,
                    left: HEADER_W + frozenWidth,
                    right: 0,
                    bottom: 0
                }, onScroll: handleScroll, children: _jsx("div", { style: {
                        width: Math.max(0, colWidths.slice(freezeCols).reduce((sum, w) => sum + (w ?? CELL_W), 0)),
                        height: Math.max(0, rowHeights.slice(freezeRows).reduce((sum, h) => sum + (h ?? CELL_H), 0))
                    }, children: _jsx("canvas", { ref: mainCanvasRef, className: "absolute top-0 left-0", onClick: (e) => handleCanvasClick(e, freezeRows, freezeCols) }) }) })] }));
}
