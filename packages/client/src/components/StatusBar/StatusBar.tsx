import React, { useMemo } from 'react';
import { useGridStore } from '@/stores/gridStore';

interface StatusBarProps {
  gridId: string;
  sheetId: number;
}

/**
 * 状态栏 - 显示当前选中信息和统计
 */
export default function StatusBar({ gridId, sheetId }: StatusBarProps) {
  const { active, selection, cells, rows, cols } = useGridStore((s) => ({
    active: s.active,
    selection: s.selection,
    cells: s.cells || {},
    rows: s.rows,
    cols: s.cols
  }));

  // 计算选中区域的统计信息
  const statistics = useMemo(() => {
    let selectedCells: string[] = [];
    
    if (selection?.type === 'cell' && selection.row !== undefined && selection.col !== undefined) {
      selectedCells = [`${selection.row}:${selection.col}`];
    } else if (selection?.type === 'row' && selection.row !== undefined) {
      // 整行选中
      for (let c = 0; c < cols; c++) {
        selectedCells.push(`${selection.row}:${c}`);
      }
    } else if (selection?.type === 'col' && selection.col !== undefined) {
      // 整列选中
      for (let r = 0; r < rows; r++) {
        selectedCells.push(`${r}:${selection.col}`);
      }
    } else if (selection?.type === 'all') {
      // 全选
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          selectedCells.push(`${r}:${c}`);
        }
      }
    } else if (selection?.type === 'multi') {
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
    const values: number[] = [];
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
        } else {
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
    if (!active) return '无选择';
    
    const colName = String.fromCharCode(65 + active.col);
    const rowName = active.row + 1;
    
    if (selection?.type === 'row') {
      return `第${rowName}行`;
    } else if (selection?.type === 'col') {
      return `第${colName}列`;
    } else if (selection?.type === 'all') {
      return '全选';
    } else if (selection?.type === 'multi') {
      const rowCount = selection.selectedRows?.size || 0;
      const colCount = selection.selectedCols?.size || 0;
      const cellCount = selection.selectedCells?.size || 0;
      return `多选 (${rowCount}行, ${colCount}列, ${cellCount}单元格)`;
    } else {
      return `${colName}${rowName}`;
    }
  };

  // 格式化数字
  const formatNumber = (num: number) => {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    return num.toFixed(2);
  };

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-1 flex items-center justify-between text-xs text-gray-600 select-none">
      {/* 左侧：位置和选中信息 */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="font-medium">位置:</span>
          <span className="text-blue-600 font-mono">{getPositionInfo()}</span>
        </div>
        
        {statistics.totalCells > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-medium">选中:</span>
            <span>{statistics.totalCells} 个单元格</span>
            {statistics.nonEmptyCount > 0 && (
              <span>({statistics.nonEmptyCount} 个有内容)</span>
            )}
          </div>
        )}

        {statistics.numberCount > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="font-medium">求和:</span>
              <span className="text-green-600 font-mono">{formatNumber(statistics.sum)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">平均:</span>
              <span className="text-blue-600 font-mono">{formatNumber(statistics.avg)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">最小:</span>
              <span className="text-orange-600 font-mono">{formatNumber(statistics.min)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">最大:</span>
              <span className="text-purple-600 font-mono">{formatNumber(statistics.max)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：系统信息 */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <span>表格: {rows}行 × {cols}列</span>
          <span>数据: {Object.keys(cells).length} 个单元格有内容</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>已连接</span>
          </div>
          <span>缩放: 100%</span>
          <span className="text-gray-500">Collab Grid v1.0</span>
        </div>
      </div>
    </div>
  );
}
