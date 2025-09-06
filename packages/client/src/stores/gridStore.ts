import { create } from "zustand";
import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, cellKey } from "@collab-grid/shared";
// TODO: 临时注释掉 FormulaEngine 导入来调试
// import { FormulaEngine } from "@collab-grid/shared";

type Align = 'left' | 'center' | 'right';
interface CellStyle { 
  bold?: boolean; 
  italic?: boolean;
  underline?: boolean;
  align?: Align; 
  color?: string; 
  bg?: string; 
  fontSize?: number;
  border?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

// 列筛选结构：当前实现为“按值多选”
export interface ColumnFilter {
  type: 'values';
  selected: string[]; // 选中的显示值（字符串化）
}

// 历史记录类型
interface HistoryEntry {
	type: 'cell_change' | 'style_change' | 'bulk_change';
	timestamp: number;
	changes: Array<{
		row: number;
		col: number;
		oldValue?: string | number | boolean | null;
		newValue?: string | number | boolean | null;
		oldStyle?: CellStyle;
		newStyle?: CellStyle;
	}>;
	description: string;
}

// 参考 Luckysheet 的合并单元格数据结构
interface MergedCell {
	r: number;     // 合并区域左上角行索引  
	c: number;     // 合并区域左上角列索引
	rs: number;    // 合并的行数（row span）
	cs: number;    // 合并的列数（column span）
}

interface GridState {
	rows: number;
	cols: number;
	cells: Record<string, string | number | boolean | null>;
	formulas: Record<string, string>; // 存储原始公式
	computedValues: Record<string, any>; // 存储计算结果
	styles: Record<string, CellStyle>;
	mergedCells: Record<string, MergedCell>; // key: "row_col" (Luckysheet format)
	active: { row: number; col: number } | null;
	// 选择状态：支持单元格、整行、整列选择
	selection: {
		type: 'cell' | 'row' | 'col' | 'all' | 'multi';
		row?: number;  // 选中的行（仅对row/cell类型有效）
		col?: number;  // 选中的列（仅对col/cell类型有效）
		// 多选数据
		selectedRows?: Set<number>;
		selectedCols?: Set<number>;
		selectedCells?: Set<string>; // "row:col" format
	} | null;
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
	// 撤销重做历史
	history: HistoryEntry[];
	historyIndex: number; // 当前历史位置
	// 扩展冻结功能：支持任意行列冻结
	freezeRows: number; // 冻结的行数（从第1行开始）
	freezeCols: number; // 冻结的列数（从第1列开始）

	setCell: (row: number, col: number, value: string | number | boolean | null) => void;
	setCellFormula: (row: number, col: number, formula: string) => void;
	recalculateFormulas: () => void;
	getCellDisplayValue: (row: number, col: number) => any;
	setStyle: (row: number, col: number, patch: Partial<CellStyle>) => void;
	setActive: (row: number, col: number) => void;
	// 选择相关方法
	selectCell: (row: number, col: number) => void;
	selectRow: (row: number) => void;
	selectCol: (col: number) => void;
	selectAll: () => void;
	clearSelection: () => void;
	// 多选方法
	toggleRowSelection: (row: number, ctrlKey: boolean) => void;
	toggleColSelection: (col: number, ctrlKey: boolean) => void;
	toggleCellSelection: (row: number, col: number, ctrlKey: boolean) => void;
	setSize: (rows: number, cols: number) => void;
	setActiveSheet: (sheetId: number) => void;
	setRowHeight: (row: number, h: number) => void;
	setColWidth: (col: number, w: number) => void;
	setAllRowHeights: (sheetId: number, arr: number[]) => void;
	setAllColWidths: (sheetId: number, arr: number[]) => void;
	// 排序与筛选（基础）
	sortSpec?: { col: number | null; asc: boolean };
	filters?: Record<number, ColumnFilter | null>;
	setSort: (col: number | null, asc?: boolean) => void;
	clearSort: () => void;
	setFilter: (col: number, filter: ColumnFilter | null) => void;
	clearFilter: (col: number) => void;
	toggleFreezeTopRow: () => void;
	toggleFreezeFirstCol: () => void;
	// 新的冻结函数
	setFreezeRows: (count: number) => void;
	setFreezeCols: (count: number) => void;
	setFreezePanes: (rows: number, cols: number) => void;
	clearFreeze: () => void;
	// 行列操作函数
	insertRow: (at: number, where: 'before' | 'after', count?: number) => void;
	deleteRow: (at: number, count?: number) => void;
	insertCol: (at: number, where: 'before' | 'after', count?: number) => void;
	deleteCol: (at: number, count?: number) => void;
	// 合并单元格函数（已禁用）
	mergeCells: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
	unmergeCells: (startRow: number, startCol: number) => void;
	getMergedCell: (row: number, col: number) => MergedCell | null;
	isCellMerged: (row: number, col: number) => boolean;
	reset: (rows?: number, cols?: number) => void;
	// 撤销重做方法
	addToHistory: (entry: HistoryEntry) => void;
	undo: () => boolean;
	redo: () => boolean;
	canUndo: () => boolean;
	canRedo: () => boolean;
	clearHistory: () => void;
}


export const useGridStore = create<GridState>((set, get) => ({
	rows: DEFAULT_GRID_ROWS,
	cols: DEFAULT_GRID_COLS,
	cells: {},
	formulas: {},
	computedValues: {},
	styles: {},
	mergedCells: {},
	active: null,
	selection: null,
	rowHeights: Array(DEFAULT_GRID_ROWS).fill(24),
	colWidths: Array(DEFAULT_GRID_COLS).fill(80),
	activeSheetId: 0,
	rowHeightsBySheet: {},
	colWidthsBySheet: {},
	freezeTopRow: false,
	freezeFirstCol: false,
	freezeRows: 0,
	freezeCols: 0,
	history: [],
	historyIndex: -1,

	// 设置单元格值
	setCell: (row, col, value) =>
		set((s) => {
			const key = cellKey(row, col);
			const oldValue = s.cells[key];
			if (oldValue === value) return s;
			
			const historyEntry: HistoryEntry = {
				type: 'cell_change',
				timestamp: Date.now(),
				changes: [{
					row,
					col,
					oldValue,
					newValue: value
				}],
				description: `编辑单元格 ${String.fromCharCode(65 + col)}${row + 1}`
			};
			
			const newHistory = s.history.slice(0, s.historyIndex + 1);
			newHistory.push(historyEntry);
			
			if (newHistory.length > 50) {
				newHistory.shift();
			}
			
			const newState = { 
				cells: { ...s.cells, [key]: value },
				formulas: s.formulas,
				computedValues: s.computedValues,
				history: newHistory,
				historyIndex: newHistory.length - 1
			};
			
			if (typeof value === 'string' && value.startsWith('=')) {
				newState.formulas = { ...s.formulas, [key]: value };
				newState.computedValues = { ...s.computedValues, [key]: value };
			} else {
				const { [key]: removed, ...restFormulas } = s.formulas;
				const { [key]: removedComputed, ...restComputed } = s.computedValues;
				newState.formulas = restFormulas;
				newState.computedValues = restComputed;
			}
			
			return newState;
		}),

	setCellFormula: (row, col, formula) =>
		set((s) => {
			const key = cellKey(row, col);
			return {
				formulas: { ...s.formulas, [key]: formula },
				computedValues: { ...s.computedValues, [key]: formula },
				cells: { ...s.cells, [key]: formula }
			};
		}),

	recalculateFormulas: () =>
		set((s) => {
			const newComputedValues = { ...s.computedValues };
			const newCells = { ...s.cells };
			
			Object.entries(s.formulas).forEach(([key, formula]) => {
				newComputedValues[key] = formula;
				newCells[key] = formula;
			});
			
			return {
				computedValues: newComputedValues,
				cells: newCells
			};
		}),

	getCellDisplayValue: (row, col) => {
		const state = get();
		const key = cellKey(row, col);
		
		if (key in state.computedValues) {
			return state.computedValues[key];
		}
		return state.cells[key];
	},

	setStyle: (row, col, patch) =>
		set((s) => ({ styles: { ...s.styles, [cellKey(row, col)]: { ...s.styles[cellKey(row, col)], ...patch } } })),
	setActive: (row, col) => set({ active: { row, col } }),
	
	// 选择相关方法实现
	selectCell: (row, col) => set({ 
		active: { row, col }, 
		selection: { type: 'cell', row, col } 
	}),
	selectRow: (row) => set({ 
		active: null, 
		selection: { type: 'row', row } 
	}),
	selectCol: (col) => set({ 
		active: null, 
		selection: { type: 'col', col } 
	}),
	selectAll: () => set({ 
		active: null, 
		selection: { type: 'all' } 
	}),
	clearSelection: () => set({ 
		active: null, 
		selection: null 
	}),
	
	// 多选方法实现
	toggleRowSelection: (row, ctrlKey) => set((state) => {
		if (!ctrlKey) {
			// 不按Ctrl，单选行
			return {
				active: null,
				selection: { type: 'row', row }
			};
		}
		
		// 按Ctrl，多选行
		const current = state.selection;
		if (current?.type === 'row' && current.row === row) {
			// 取消选择当前行
			return { active: null, selection: null };
		}
		
		let selectedRows = new Set<number>();
		if (current?.type === 'row' && current.row !== undefined) {
			selectedRows.add(current.row);
		} else if (current?.type === 'multi' && current.selectedRows) {
			selectedRows = new Set(current.selectedRows);
		}
		
		selectedRows.add(row);
		
		return {
			active: null,
			selection: {
				type: 'multi',
				selectedRows,
				selectedCols: new Set(),
				selectedCells: new Set()
			}
		};
	}),
	
	toggleColSelection: (col, ctrlKey) => set((state) => {
		if (!ctrlKey) {
			// 不按Ctrl，单选列
			return {
				active: null,
				selection: { type: 'col', col }
			};
		}
		
		// 按Ctrl，多选列
		const current = state.selection;
		if (current?.type === 'col' && current.col === col) {
			// 取消选择当前列
			return { active: null, selection: null };
		}
		
		let selectedCols = new Set<number>();
		if (current?.type === 'col' && current.col !== undefined) {
			selectedCols.add(current.col);
		} else if (current?.type === 'multi' && current.selectedCols) {
			selectedCols = new Set(current.selectedCols);
		}
		
		selectedCols.add(col);
		
		return {
			active: null,
			selection: {
				type: 'multi',
				selectedRows: new Set(),
				selectedCols,
				selectedCells: new Set()
			}
		};
	}),
	
	toggleCellSelection: (row, col, ctrlKey) => set((state) => {
		const cellKey = `${row}:${col}`;
		
		if (!ctrlKey) {
			// 不按Ctrl，单选单元格
			return {
				active: { row, col },
				selection: { type: 'cell', row, col }
			};
		}
		
		// 按Ctrl，多选单元格
		const current = state.selection;
		if (current?.type === 'cell' && current.row === row && current.col === col) {
			// 取消选择当前单元格
			return { active: null, selection: null };
		}
		
		let selectedCells = new Set<string>();
		if (current?.type === 'cell' && current.row !== undefined && current.col !== undefined) {
			selectedCells.add(`${current.row}:${current.col}`);
		} else if (current?.type === 'multi' && current.selectedCells) {
			selectedCells = new Set(current.selectedCells);
		}
		
		selectedCells.add(cellKey);
		
		return {
			active: { row, col },
			selection: {
				type: 'multi',
				selectedRows: new Set(),
				selectedCols: new Set(),
				selectedCells
			}
		};
	}),
	setSize: (rows, cols) => set((s) => {
		const nextHeights = s.rowHeights.slice(); while (nextHeights.length < rows) nextHeights.push(24);
		const nextWidths = s.colWidths.slice(); while (nextWidths.length < cols) nextWidths.push(80);
		return { rows, cols, rowHeights: nextHeights, colWidths: nextWidths };
	}),
	setActiveSheet: (sheetId) => set((s) => {
		
		// 确保新Sheet有默认的行高和列宽
		const defaultRowHeights = Array(s.rows).fill(24);
		const defaultColWidths = Array(s.cols).fill(80);
		
		const rh = s.rowHeightsBySheet[sheetId] ?? (s.rowHeights?.length > 0 ? s.rowHeights : defaultRowHeights);
		const cw = s.colWidthsBySheet[sheetId] ?? (s.colWidths?.length > 0 ? s.colWidths : defaultColWidths);
		
		// 最终确保colWidths长度与cols匹配
		const finalColWidths = cw.length === s.cols ? cw.slice() : defaultColWidths;
		const finalRowHeights = rh.length === s.rows ? rh.slice() : defaultRowHeights;
		
		
		return { activeSheetId: sheetId, rowHeights: finalRowHeights, colWidths: finalColWidths };
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

	// ===== 排序 / 筛选 =====
	sortSpec: { col: null, asc: true },
	filters: {},
	setSort: (col, asc) => set((s) => ({ sortSpec: col == null ? { col: null, asc: true } : { col, asc: asc ?? (s.sortSpec?.col === col ? !s.sortSpec!.asc : true) } })),
	clearSort: () => set(() => ({ sortSpec: { col: null, asc: true } })),
	setFilter: (col, filter) => set((s) => ({ filters: { ...(s.filters || {}), [col]: filter } })),
	clearFilter: (col) => set((s) => { const next = { ...(s.filters || {}) }; delete next[col]; return { filters: next }; }),
	toggleFreezeTopRow: () => set((s) => ({ 
		freezeTopRow: !s.freezeTopRow,
		freezeRows: !s.freezeTopRow ? 1 : 0
	})),
	toggleFreezeFirstCol: () => set((s) => ({ 
		freezeFirstCol: !s.freezeFirstCol,
		freezeCols: !s.freezeFirstCol ? 1 : 0
	})),
	
	// 新的冻结函数实现
	setFreezeRows: (count: number) => set((s) => ({
		freezeRows: Math.max(0, Math.min(count, s.rows - 1)),
		freezeTopRow: count > 0
	})),
	setFreezeCols: (count: number) => set((s) => ({
		freezeCols: Math.max(0, Math.min(count, s.cols - 1)),
		freezeFirstCol: count > 0
	})),
	setFreezePanes: (rows: number, cols: number) => set((s) => ({
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
		rows, cols, cells: {}, formulas: {}, computedValues: {}, styles: {}, active: null, selection: null,
		rowHeights: Array(rows).fill(24), colWidths: Array(cols).fill(80),
		freezeRows: 0, freezeCols: 0, freezeTopRow: false, freezeFirstCol: false,
		history: [], historyIndex: -1
	}),
	
	// 撤销重做实现
	addToHistory: (entry: HistoryEntry) => set((s) => {
		const newHistory = s.history.slice(0, s.historyIndex + 1);
		newHistory.push(entry);
		
		// 限制历史记录数量
		if (newHistory.length > 50) {
			newHistory.shift();
		}
		
		return {
			history: newHistory,
			historyIndex: newHistory.length - 1
		};
	}),
	
	undo: () => {
		const state = get();
		const historyIndex = state.historyIndex ?? -1;
		const history = state.history || [];
		if (historyIndex < 0) {
			return false;
		}
		
		const entry = history[historyIndex];
		
		set((s) => {
			const newState = { ...s };
			
			// 应用撤销
			entry.changes.forEach(change => {
				const key = cellKey(change.row, change.col);
				
				if (entry.type === 'cell_change') {
					if (change.oldValue !== undefined) {
						newState.cells = { ...newState.cells, [key]: change.oldValue };
					} else {
						const { [key]: removed, ...rest } = newState.cells;
						newState.cells = rest;
					}
				} else if (entry.type === 'style_change') {
					if (change.oldStyle !== undefined) {
						newState.styles = { ...newState.styles, [key]: change.oldStyle };
					} else {
						const { [key]: removed, ...rest } = newState.styles;
						newState.styles = rest;
					}
				}
			});
			
			newState.historyIndex = s.historyIndex - 1;
			return newState;
		});
		
		return true;
	},
	
	redo: () => {
		const state = get();
		if (state.historyIndex >= state.history.length - 1) return false;
		
		const entry = state.history[state.historyIndex + 1];
		
		set((s) => {
			const newState = { ...s };
			
			// 应用重做
			entry.changes.forEach(change => {
				const key = cellKey(change.row, change.col);
				
				if (entry.type === 'cell_change') {
					if (change.newValue !== undefined) {
						newState.cells = { ...newState.cells, [key]: change.newValue };
					} else {
						const { [key]: removed, ...rest } = newState.cells;
						newState.cells = rest;
					}
				} else if (entry.type === 'style_change') {
					if (change.newStyle !== undefined) {
						newState.styles = { ...newState.styles, [key]: change.newStyle };
					} else {
						const { [key]: removed, ...rest } = newState.styles;
						newState.styles = rest;
					}
				}
			});
			
			newState.historyIndex = s.historyIndex + 1;
			return newState;
		});
		
		return true;
	},
	
	canUndo: () => {
		const state = get();
		const historyIndex = state.historyIndex ?? -1;
		const historyLength = (state.history || []).length;
		const result = historyIndex >= 0;
		return result;
	},
	
	canRedo: () => {
		const state = get();
		const historyIndex = state.historyIndex ?? -1;
		const historyLength = (state.history || []).length;
		const result = historyIndex < historyLength - 1;
		return result;
	},
	
	clearHistory: () => set({
		history: [],
		historyIndex: -1
	}),

	// 行列操作实现
	insertRow: (at: number, where: 'before' | 'after', count: number = 1) => {
		set((s) => {
			const insertAt = where === 'after' ? at + 1 : at;
			const newRows = s.rows + count;
			
			// 调整单元格位置
			const newCells: Record<string, any> = {};
			const newStyles: Record<string, any> = {};
			
			Object.entries(s.cells).forEach(([key, value]) => {
				const [row, col] = key.split(':').map(Number);
				if (row >= insertAt) {
					newCells[`${row + count}:${col}`] = value;
				} else {
					newCells[key] = value;
				}
			});
			
			Object.entries(s.styles || {}).forEach(([key, value]) => {
				const [row, col] = key.split(':').map(Number);
				if (row >= insertAt) {
					newStyles[`${row + count}:${col}`] = value;
				} else {
					newStyles[key] = value;
				}
			});
			
			// 调整行高
			const newRowHeights = [...(s.rowHeights || [])];
			const defaultRowHeight = 24;
			for (let i = 0; i < count; i++) {
				newRowHeights.splice(insertAt, 0, defaultRowHeight);
			}
			
			return {
				rows: newRows,
				cells: newCells,
				styles: newStyles,
				rowHeights: newRowHeights
			};
		});
	},

	deleteRow: (at: number, count: number = 1) => {
		set((s) => {
			const endRow = Math.min(s.rows - 1, at + count - 1);
			const actualCount = endRow - at + 1;
			
			if (actualCount <= 0 || s.rows - actualCount < 1) return s; // 至少保留一行
			
			// 调整单元格位置
			const newCells: Record<string, any> = {};
			const newStyles: Record<string, any> = {};
			
			Object.entries(s.cells).forEach(([key, value]) => {
				const [row, col] = key.split(':').map(Number);
				if (row < at || row > endRow) {
					if (row > endRow) {
						newCells[`${row - actualCount}:${col}`] = value;
					} else {
						newCells[key] = value;
					}
				}
				// 删除范围内的单元格直接忽略
			});
			
			Object.entries(s.styles || {}).forEach(([key, value]) => {
				const [row, col] = key.split(':').map(Number);
				if (row < at || row > endRow) {
					if (row > endRow) {
						newStyles[`${row - actualCount}:${col}`] = value;
					} else {
						newStyles[key] = value;
					}
				}
			});
			
			// 调整行高
			const newRowHeights = [...(s.rowHeights || [])];
			newRowHeights.splice(at, actualCount);
			
			return {
				rows: s.rows - actualCount,
				cells: newCells,
				styles: newStyles,
				rowHeights: newRowHeights
			};
		});
	},

	insertCol: (at: number, where: 'before' | 'after', count: number = 1) => {
		set((s) => {
			const insertAt = where === 'after' ? at + 1 : at;
			const newCols = s.cols + count;
			
			// 调整单元格位置
			const newCells: Record<string, any> = {};
			const newStyles: Record<string, any> = {};
			
			Object.entries(s.cells).forEach(([key, value]) => {
				const [row, col] = key.split(':').map(Number);
				if (col >= insertAt) {
					newCells[`${row}:${col + count}`] = value;
				} else {
					newCells[key] = value;
				}
			});
			
			Object.entries(s.styles || {}).forEach(([key, value]) => {
				const [row, col] = key.split(':').map(Number);
				if (col >= insertAt) {
					newStyles[`${row}:${col + count}`] = value;
				} else {
					newStyles[key] = value;
				}
			});
			
			// 调整列宽
			const newColWidths = [...(s.colWidths || [])];
			const defaultColWidth = 80;
			for (let i = 0; i < count; i++) {
				newColWidths.splice(insertAt, 0, defaultColWidth);
			}
			
			return {
				cols: newCols,
				cells: newCells,
				styles: newStyles,
				colWidths: newColWidths
			};
		});
	},

	deleteCol: (at: number, count: number = 1) => {
		set((s) => {
			const endCol = Math.min(s.cols - 1, at + count - 1);
			const actualCount = endCol - at + 1;
			
			if (actualCount <= 0 || s.cols - actualCount < 1) return s; // 至少保留一列
			
			// 调整单元格位置
			const newCells: Record<string, any> = {};
			const newStyles: Record<string, any> = {};
			
			Object.entries(s.cells).forEach(([key, value]) => {
				const [row, col] = key.split(':').map(Number);
				if (col < at || col > endCol) {
					if (col > endCol) {
						newCells[`${row}:${col - actualCount}`] = value;
					} else {
						newCells[key] = value;
					}
				}
				// 删除范围内的单元格直接忽略
			});
			
			Object.entries(s.styles || {}).forEach(([key, value]) => {
				const [row, col] = key.split(':').map(Number);
				if (col < at || col > endCol) {
					if (col > endCol) {
						newStyles[`${row}:${col - actualCount}`] = value;
					} else {
						newStyles[key] = value;
					}
				}
			});
			
			// 调整列宽
			const newColWidths = [...(s.colWidths || [])];
			newColWidths.splice(at, actualCount);
			
			return {
				cols: s.cols - actualCount,
				cells: newCells,
				styles: newStyles,
				colWidths: newColWidths
			};
		});
	},

	// 📋 合并单元格功能已禁用
	mergeCells(startRow: number, startCol: number, endRow: number, endCol: number) {
		console.log("⚠️ mergeCells 功能已禁用");
		return;
	},	
	// 📋 参考 Luckysheet 的 cancelRangeMerge 函数重新实现取消合并逻辑
	unmergeCells(startRow: number, startCol: number) {
		console.log("⚠️ unmergeCells 功能已禁用");
		return;
	},	
	// 🔀 Luckysheet 风格的合并单元格检测
	getMergedCell(row: number, col: number) {
		return null;
	},
	// 🔀 Luckysheet 风格的合并检测
	isCellMerged: (row: number, col: number) => {
		return false;
	},
}));

// 调试：验证 store 创建

// 测试 store 的函数
const testState = useGridStore.getState();

// 详细的函数检查
const functionKeys = Object.keys(testState).filter(key => typeof testState[key] === 'function');

// 检查合并相关的属性

// 测试合并功能
console.log('🧪 测试基础合并功能');
try {
  const beforeMerge = testState.mergedCells;
  console.log('🧪 合并前的状态:', beforeMerge);
  
  // 直接测试 mergeCells 方法
  if (typeof testState.mergeCells === 'function') {
    testState.mergeCells(0, 0, 0, 1);
    
    // 检查状态是否更新
    setTimeout(() => {
      const afterMerge = useGridStore.getState().mergedCells;
      console.log('🧪 合并后的状态:', afterMerge);
    }, 100);
  }
} catch (error) {
  console.error('🧪 测试合并功能失败:', error);
}

// 验证函数是否正确存在
console.log('✅ 函数验证完成');
console.log('✅ getMergedCell 存在:', typeof testState.getMergedCell === 'function');
console.log('✅ mergeCells 存在:', typeof testState.mergeCells === 'function');
console.log('✅ unmergeCells 存在:', typeof testState.unmergeCells === 'function');


