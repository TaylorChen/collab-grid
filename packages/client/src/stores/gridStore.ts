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

interface GridState {
	rows: number;
	cols: number;
	cells: Record<string, string | number | boolean | null>;
	formulas: Record<string, string>; // 存储原始公式
	computedValues: Record<string, any>; // 存储计算结果
	styles: Record<string, CellStyle>;
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
	toggleFreezeTopRow: () => void;
	toggleFreezeFirstCol: () => void;
	// 新的冻结函数
	setFreezeRows: (count: number) => void;
	setFreezeCols: (count: number) => void;
	setFreezePanes: (rows: number, cols: number) => void;
	clearFreeze: () => void;
	reset: (rows?: number, cols?: number) => void;
	// 撤销重做方法
	addToHistory: (entry: HistoryEntry) => void;
	undo: () => boolean;
	redo: () => boolean;
	canUndo: () => boolean;
	canRedo: () => boolean;
	clearHistory: () => void;
}

export const useGridStore = create<GridState>((set, get) => {
console.log('🔧 正在创建GridStore...');
const store = {
	rows: DEFAULT_GRID_ROWS,
	cols: DEFAULT_GRID_COLS,
	cells: {},
	formulas: {},
	computedValues: {},
	styles: {},
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

	setCell: (row, col, value) =>
		set((s) => {
			console.log('📝 setCell调用:', { row, col, value });
			const key = cellKey(row, col);
			const oldValue = s.cells[key];
			console.log('📝 setCell老值:', oldValue, '新值:', value);
			
			// 如果值没有变化，不记录历史
			if (oldValue === value) {
				console.log('📝 值未变化，不记录历史');
				return s;
			}
			
			// 记录历史
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
			
			// 添加到历史
			const newHistory = s.history.slice(0, s.historyIndex + 1);
			newHistory.push(historyEntry);
			console.log('📝 添加历史记录:', historyEntry);
			console.log('📝 新历史长度:', newHistory.length);
			
			// 限制历史记录数量（最多50条）
			if (newHistory.length > 50) {
				newHistory.shift();
			}
			
			const newState = { 
				cells: { ...s.cells, [key]: value },
				history: newHistory,
				historyIndex: newHistory.length - 1
			};
			
			// 如果值以=开头，将其作为公式处理
			if (typeof value === 'string' && value.startsWith('=')) {
				newState.formulas = { ...s.formulas, [key]: value };
				
				// TODO: 临时禁用公式计算来调试
				// const engine = new FormulaEngine(s.cells);
				// const result = engine.evaluate(value);
				// newState.computedValues = { ...s.computedValues, [key]: result.value };
				newState.computedValues = { ...s.computedValues, [key]: value };
			} else {
				// 清除公式记录
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
			// TODO: 临时禁用公式计算来调试
			// const engine = new FormulaEngine(s.cells);
			// const result = engine.evaluate(formula);
			
			return {
				formulas: { ...s.formulas, [key]: formula },
				computedValues: { ...s.computedValues, [key]: formula },
				cells: { ...s.cells, [key]: formula }
			};
		}),

	recalculateFormulas: () =>
		set((s) => {
			// TODO: 临时禁用公式计算来调试
			// const engine = new FormulaEngine(s.cells);
			const newComputedValues = { ...s.computedValues };
			const newCells = { ...s.cells };
			
			// 重新计算所有公式 - 临时禁用
			Object.entries(s.formulas).forEach(([key, formula]) => {
				// const result = engine.evaluate(formula);
				newComputedValues[key] = formula; // 临时直接返回公式文本
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
		
		// 如果有计算值，返回计算值，否则返回原始值
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
		console.log('🔄 setActiveSheet调用:', { sheetId, currentRows: s.rows, currentCols: s.cols, currentColWidths: s.colWidths?.length });
		
		// 确保新Sheet有默认的行高和列宽
		const defaultRowHeights = Array(s.rows).fill(24);
		const defaultColWidths = Array(s.cols).fill(80);
		
		const rh = s.rowHeightsBySheet[sheetId] ?? (s.rowHeights?.length > 0 ? s.rowHeights : defaultRowHeights);
		const cw = s.colWidthsBySheet[sheetId] ?? (s.colWidths?.length > 0 ? s.colWidths : defaultColWidths);
		
		console.log('🔄 setActiveSheet结果:', { 
			sheetId, 
			newRowHeights: rh.length, 
			newColWidths: cw.length, 
			fromSheetSpecific: !!s.colWidthsBySheet[sheetId],
			fromCurrent: s.colWidths?.length > 0,
			useDefault: s.colWidths?.length === 0
		});
		
		// 最终确保colWidths长度与cols匹配
		const finalColWidths = cw.length === s.cols ? cw.slice() : defaultColWidths;
		const finalRowHeights = rh.length === s.rows ? rh.slice() : defaultRowHeights;
		
		console.log('🔄 最终设置:', { 
			sheetId, 
			finalRowHeights: finalRowHeights.length, 
			finalColWidths: finalColWidths.length,
			cols: s.cols,
			rows: s.rows
		});
		
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
		console.log('⏪ undo被调用，当前状态:', { historyIndex, historyLength: history.length });
		if (historyIndex < 0) {
			console.log('⏪ 无法撤销，historyIndex < 0');
			return false;
		}
		
		const entry = history[historyIndex];
		console.log('⏪ 撤销操作:', entry.description, entry);
		
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
		console.log('⏩ 重做操作:', entry.description);
		
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
		console.log('🔍 canUndo检查:', { historyIndex, historyLength, result });
		return result;
	},
	
	canRedo: () => {
		const state = get();
		const historyIndex = state.historyIndex ?? -1;
		const historyLength = (state.history || []).length;
		const result = historyIndex < historyLength - 1;
		console.log('🔍 canRedo检查:', { historyIndex, historyLength, result });
		return result;
	},
	
	clearHistory: () => set({
		history: [],
		historyIndex: -1
	})
};

console.log('🔧 Store创建完成，方法列表:', {
	selectCell: typeof store.selectCell,
	selectRow: typeof store.selectRow,
	selectCol: typeof store.selectCol,
	selectAll: typeof store.selectAll,
	setCell: typeof store.setCell,
	setCellContent: store.setCell.toString().substring(0, 100),
	undo: typeof store.undo,
	redo: typeof store.redo,
	canUndo: typeof store.canUndo,
	canRedo: typeof store.canRedo
});

console.log('🔧 store.canUndo函数内容:', store.canUndo?.toString().substring(0, 100));

return store;
});

