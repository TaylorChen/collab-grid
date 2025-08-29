import { create } from "zustand";
import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, cellKey } from "@collab-grid/shared";
export const useGridStore = create((set, get) => ({
    rows: DEFAULT_GRID_ROWS,
    cols: DEFAULT_GRID_COLS,
    cells: {},
    styles: {},
    active: null,
    rowHeights: Array(DEFAULT_GRID_ROWS).fill(24),
    colWidths: Array(DEFAULT_GRID_COLS).fill(80),
    activeSheetId: 0,
    rowHeightsBySheet: {},
    colWidthsBySheet: {},
    freezeTopRow: false,
    freezeFirstCol: false,
    freezeRows: 0,
    freezeCols: 0,
    setCell: (row, col, value) => set((s) => ({ cells: { ...s.cells, [cellKey(row, col)]: value } })),
    setStyle: (row, col, patch) => set((s) => ({ styles: { ...s.styles, [cellKey(row, col)]: { ...s.styles[cellKey(row, col)], ...patch } } })),
    setActive: (row, col) => set({ active: { row, col } }),
    setSize: (rows, cols) => set((s) => {
        const nextHeights = s.rowHeights.slice();
        while (nextHeights.length < rows)
            nextHeights.push(24);
        const nextWidths = s.colWidths.slice();
        while (nextWidths.length < cols)
            nextWidths.push(80);
        return { rows, cols, rowHeights: nextHeights, colWidths: nextWidths };
    }),
    setActiveSheet: (sheetId) => set((s) => {
        const rh = s.rowHeightsBySheet[sheetId] ?? s.rowHeights;
        const cw = s.colWidthsBySheet[sheetId] ?? s.colWidths;
        return { activeSheetId: sheetId, rowHeights: rh.slice(), colWidths: cw.slice() };
    }),
    setRowHeight: (row, h) => set((s) => {
        const arr = s.rowHeights.slice();
        arr[row] = h;
        return { rowHeights: arr, rowHeightsBySheet: { ...s.rowHeightsBySheet, [s.activeSheetId]: arr.slice() } };
    }),
    setColWidth: (col, w) => set((s) => {
        const arr = s.colWidths.slice();
        arr[col] = w;
        return { colWidths: arr, colWidthsBySheet: { ...s.colWidthsBySheet, [s.activeSheetId]: arr.slice() } };
    }),
    setAllRowHeights: (sheetId, arr) => set((s) => ({
        rowHeightsBySheet: { ...s.rowHeightsBySheet, [sheetId]: arr.slice() },
        ...(sheetId === s.activeSheetId ? { rowHeights: arr.slice() } : {})
    })),
    setAllColWidths: (sheetId, arr) => set((s) => ({
        colWidthsBySheet: { ...s.colWidthsBySheet, [sheetId]: arr.slice() },
        ...(sheetId === s.activeSheetId ? { colWidths: arr.slice() } : {})
    })),
    toggleFreezeTopRow: () => set((s) => ({
        freezeTopRow: !s.freezeTopRow,
        freezeRows: !s.freezeTopRow ? 1 : 0
    })),
    toggleFreezeFirstCol: () => set((s) => ({
        freezeFirstCol: !s.freezeFirstCol,
        freezeCols: !s.freezeFirstCol ? 1 : 0
    })),
    // 新的冻结函数实现
    setFreezeRows: (count) => set((s) => ({
        freezeRows: Math.max(0, Math.min(count, s.rows - 1)),
        freezeTopRow: count > 0
    })),
    setFreezeCols: (count) => set((s) => ({
        freezeCols: Math.max(0, Math.min(count, s.cols - 1)),
        freezeFirstCol: count > 0
    })),
    setFreezePanes: (rows, cols) => set((s) => ({
        freezeRows: Math.max(0, Math.min(rows, s.rows - 1)),
        freezeCols: Math.max(0, Math.min(cols, s.cols - 1)),
        freezeTopRow: rows > 0,
        freezeFirstCol: cols > 0
    })),
    clearFreeze: () => set({
        freezeRows: 0,
        freezeCols: 0,
        freezeTopRow: false,
        freezeFirstCol: false
    }),
    reset: (rows = DEFAULT_GRID_ROWS, cols = DEFAULT_GRID_COLS) => set({
        rows, cols, cells: {}, styles: {}, active: null,
        freezeRows: 0, freezeCols: 0, freezeTopRow: false, freezeFirstCol: false
    })
}));
