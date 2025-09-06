import { create } from "zustand";
import { DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, cellKey } from "@collab-grid/shared";
export const useGridStore = create((set, get) => ({
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
    setCell: (row, col, value) => set((s) => {
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
        const historyEntry = {
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
            formulas: s.formulas,
            computedValues: s.computedValues,
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
        }
        else {
            // 清除公式记录
            const { [key]: removed, ...restFormulas } = s.formulas;
            const { [key]: removedComputed, ...restComputed } = s.computedValues;
            newState.formulas = restFormulas;
            newState.computedValues = restComputed;
        }
        return newState;
    }),
    setCellFormula: (row, col, formula) => set((s) => {
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
    recalculateFormulas: () => set((s) => {
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
    setStyle: (row, col, patch) => set((s) => ({ styles: { ...s.styles, [cellKey(row, col)]: { ...s.styles[cellKey(row, col)], ...patch } } })),
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
        let selectedRows = new Set();
        if (current?.type === 'row' && current.row !== undefined) {
            selectedRows.add(current.row);
        }
        else if (current?.type === 'multi' && current.selectedRows) {
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
        let selectedCols = new Set();
        if (current?.type === 'col' && current.col !== undefined) {
            selectedCols.add(current.col);
        }
        else if (current?.type === 'multi' && current.selectedCols) {
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
        let selectedCells = new Set();
        if (current?.type === 'cell' && current.row !== undefined && current.col !== undefined) {
            selectedCells.add(`${current.row}:${current.col}`);
        }
        else if (current?.type === 'multi' && current.selectedCells) {
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
        const nextHeights = s.rowHeights.slice();
        while (nextHeights.length < rows)
            nextHeights.push(24);
        const nextWidths = s.colWidths.slice();
        while (nextWidths.length < cols)
            nextWidths.push(80);
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
        rows, cols, cells: {}, formulas: {}, computedValues: {}, styles: {}, active: null, selection: null,
        rowHeights: Array(rows).fill(24), colWidths: Array(cols).fill(80),
        freezeRows: 0, freezeCols: 0, freezeTopRow: false, freezeFirstCol: false,
        history: [], historyIndex: -1
    }),
    // 撤销重做实现
    addToHistory: (entry) => set((s) => {
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
                    }
                    else {
                        const { [key]: removed, ...rest } = newState.cells;
                        newState.cells = rest;
                    }
                }
                else if (entry.type === 'style_change') {
                    if (change.oldStyle !== undefined) {
                        newState.styles = { ...newState.styles, [key]: change.oldStyle };
                    }
                    else {
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
        if (state.historyIndex >= state.history.length - 1)
            return false;
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
                    }
                    else {
                        const { [key]: removed, ...rest } = newState.cells;
                        newState.cells = rest;
                    }
                }
                else if (entry.type === 'style_change') {
                    if (change.newStyle !== undefined) {
                        newState.styles = { ...newState.styles, [key]: change.newStyle };
                    }
                    else {
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
    insertRow: (at, where, count = 1) => {
        set((s) => {
            const insertAt = where === 'after' ? at + 1 : at;
            const newRows = s.rows + count;
            // 调整单元格位置
            const newCells = {};
            const newStyles = {};
            Object.entries(s.cells).forEach(([key, value]) => {
                const [row, col] = key.split(':').map(Number);
                if (row >= insertAt) {
                    newCells[`${row + count}:${col}`] = value;
                }
                else {
                    newCells[key] = value;
                }
            });
            Object.entries(s.styles || {}).forEach(([key, value]) => {
                const [row, col] = key.split(':').map(Number);
                if (row >= insertAt) {
                    newStyles[`${row + count}:${col}`] = value;
                }
                else {
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
    deleteRow: (at, count = 1) => {
        set((s) => {
            const endRow = Math.min(s.rows - 1, at + count - 1);
            const actualCount = endRow - at + 1;
            if (actualCount <= 0 || s.rows - actualCount < 1)
                return s; // 至少保留一行
            // 调整单元格位置
            const newCells = {};
            const newStyles = {};
            Object.entries(s.cells).forEach(([key, value]) => {
                const [row, col] = key.split(':').map(Number);
                if (row < at || row > endRow) {
                    if (row > endRow) {
                        newCells[`${row - actualCount}:${col}`] = value;
                    }
                    else {
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
                    }
                    else {
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
    insertCol: (at, where, count = 1) => {
        set((s) => {
            const insertAt = where === 'after' ? at + 1 : at;
            const newCols = s.cols + count;
            // 调整单元格位置
            const newCells = {};
            const newStyles = {};
            Object.entries(s.cells).forEach(([key, value]) => {
                const [row, col] = key.split(':').map(Number);
                if (col >= insertAt) {
                    newCells[`${row}:${col + count}`] = value;
                }
                else {
                    newCells[key] = value;
                }
            });
            Object.entries(s.styles || {}).forEach(([key, value]) => {
                const [row, col] = key.split(':').map(Number);
                if (col >= insertAt) {
                    newStyles[`${row}:${col + count}`] = value;
                }
                else {
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
    deleteCol: (at, count = 1) => {
        set((s) => {
            const endCol = Math.min(s.cols - 1, at + count - 1);
            const actualCount = endCol - at + 1;
            if (actualCount <= 0 || s.cols - actualCount < 1)
                return s; // 至少保留一列
            // 调整单元格位置
            const newCells = {};
            const newStyles = {};
            Object.entries(s.cells).forEach(([key, value]) => {
                const [row, col] = key.split(':').map(Number);
                if (col < at || col > endCol) {
                    if (col > endCol) {
                        newCells[`${row}:${col - actualCount}`] = value;
                    }
                    else {
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
                    }
                    else {
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
    // 合并单元格实现
    mergeCells: function (startRow, startCol, endRow, endCol) {
        set((s) => {
            // 确保参数顺序正确
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);
            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);
            const mergeKey = `${minRow}:${minCol}`;
            // 检查是否与现有合并区域冲突
            for (const [key, existing] of Object.entries(s.mergedCells)) {
                const overlaps = !(maxRow < existing.startRow ||
                    minRow > existing.endRow ||
                    maxCol < existing.startCol ||
                    minCol > existing.endCol);
                if (overlaps) {
                    console.warn('合并区域与现有合并单元格冲突:', key, existing);
                    return s; // 不执行合并
                }
            }
            // 收集合并区域内的所有值，保留左上角的值
            const topLeftKey = `${minRow}:${minCol}`;
            const topLeftValue = s.cells[topLeftKey] || '';
            // 创建合并单元格
            const mergedCell = {
                startRow: minRow,
                startCol: minCol,
                endRow: maxRow,
                endCol: maxCol,
                value: topLeftValue
            };
            // 清除合并区域内其他单元格的值（保留左上角）
            const newCells = { ...s.cells };
            const newStyles = { ...s.styles };
            for (let row = minRow; row <= maxRow; row++) {
                for (let col = minCol; col <= maxCol; col++) {
                    const cellKey = `${row}:${col}`;
                    if (cellKey !== topLeftKey) {
                        delete newCells[cellKey];
                        // 样式可以保留或清除，这里选择清除
                        delete newStyles[cellKey];
                    }
                }
            }
            return {
                mergedCells: { ...s.mergedCells, [mergeKey]: mergedCell },
                cells: newCells,
                styles: newStyles
            };
        });
    },
    unmergeCells: function (startRow, startCol) {
        set((s) => {
            const mergeKey = `${startRow}:${startCol}`;
            const mergedCell = s.mergedCells[mergeKey];
            if (!mergedCell) {
                console.warn('未找到要取消的合并单元格:', mergeKey);
                return s;
            }
            // 恢复合并单元格的值到左上角
            const newCells = { ...s.cells };
            const topLeftKey = `${mergedCell.startRow}:${mergedCell.startCol}`;
            newCells[topLeftKey] = mergedCell.value || '';
            // 移除合并信息
            const newMergedCells = { ...s.mergedCells };
            delete newMergedCells[mergeKey];
            return {
                mergedCells: newMergedCells,
                cells: newCells
            };
        });
    },
    getMergedCell: function (row, col) {
        const s = get();
        for (const mergedCell of Object.values(s.mergedCells || {})) {
            if (row >= mergedCell.startRow && row <= mergedCell.endRow &&
                col >= mergedCell.startCol && col <= mergedCell.endCol) {
                return mergedCell;
            }
        }
        return null;
    },
    isCellMerged: (row, col) => {
        const s = get();
        // 直接在这里实现逻辑，避免循环引用
        for (const mergedCell of Object.values(s.mergedCells || {})) {
            if (row >= mergedCell.startRow && row <= mergedCell.endRow &&
                col >= mergedCell.startCol && col <= mergedCell.endCol) {
                return true;
            }
        }
        return false;
    },
}));
// 调试：验证 store 创建
// 测试 store 的函数
const testState = useGridStore.getState();
// 详细的函数检查
const functionKeys = Object.keys(testState).filter(key => typeof testState[key] === 'function');
// 检查合并相关的属性
