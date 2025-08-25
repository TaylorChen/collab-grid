import { create } from "zustand";
import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, cellKey } from "@collab-grid/shared";

type Align = 'left' | 'center' | 'right';
interface CellStyle { bold?: boolean; align?: Align; color?: string; bg?: string; fontSize?: number }

interface GridState {
	rows: number;
	cols: number;
	cells: Record<string, string | number | boolean | null>;
	styles: Record<string, CellStyle>;
	active: { row: number; col: number } | null;
	// 当前激活 Sheet 的尺寸
	rowHeights: number[];
	colWidths: number[];
	activeSheetId: number;
	// 所有 Sheet 的尺寸缓存
	rowHeightsBySheet: Record<number, number[]>;
	colWidthsBySheet: Record<number, number[]>;
	// 冻结
	freezeTopRow: boolean;
	freezeFirstCol: boolean;

	setCell: (row: number, col: number, value: string | number | boolean | null) => void;
	setStyle: (row: number, col: number, patch: Partial<CellStyle>) => void;
	setActive: (row: number, col: number) => void;
	setSize: (rows: number, cols: number) => void;
	setActiveSheet: (sheetId: number) => void;
	setRowHeight: (row: number, h: number) => void;
	setColWidth: (col: number, w: number) => void;
	setAllRowHeights: (sheetId: number, arr: number[]) => void;
	setAllColWidths: (sheetId: number, arr: number[]) => void;
	toggleFreezeTopRow: () => void;
	toggleFreezeFirstCol: () => void;
	reset: (rows?: number, cols?: number) => void;
}

export const useGridStore = create<GridState>((set, get) => ({
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

	setCell: (row, col, value) =>
		set((s) => ({ cells: { ...s.cells, [cellKey(row, col)]: value } })),
	setStyle: (row, col, patch) =>
		set((s) => ({ styles: { ...s.styles, [cellKey(row, col)]: { ...s.styles[cellKey(row, col)], ...patch } } })),
	setActive: (row, col) => set({ active: { row, col } }),
	setSize: (rows, cols) => set((s) => {
		const nextHeights = s.rowHeights.slice(); while (nextHeights.length < rows) nextHeights.push(24);
		const nextWidths = s.colWidths.slice(); while (nextWidths.length < cols) nextWidths.push(80);
		return { rows, cols, rowHeights: nextHeights, colWidths: nextWidths };
	}),
	setActiveSheet: (sheetId) => set((s) => {
		const rh = s.rowHeightsBySheet[sheetId] ?? s.rowHeights;
		const cw = s.colWidthsBySheet[sheetId] ?? s.colWidths;
		return { activeSheetId: sheetId, rowHeights: rh.slice(), colWidths: cw.slice() };
	}),
	setRowHeight: (row, h) => set((s) => {
		const arr = s.rowHeights.slice(); arr[row] = h;
		return { rowHeights: arr, rowHeightsBySheet: { ...s.rowHeightsBySheet, [s.activeSheetId]: arr.slice() } };
	}),
	setColWidth: (col, w) => set((s) => {
		const arr = s.colWidths.slice(); arr[col] = w;
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
	toggleFreezeTopRow: () => set((s) => ({ freezeTopRow: !s.freezeTopRow })),
	toggleFreezeFirstCol: () => set((s) => ({ freezeFirstCol: !s.freezeFirstCol })),
	reset: (rows = DEFAULT_GRID_ROWS, cols = DEFAULT_GRID_COLS) => set({ rows, cols, cells: {}, styles: {}, active: null })
}));

