import React, { useRef, useEffect, useState } from "react";
import { useGridStore } from "@/stores/gridStore";

const CELL_W = 80;
const CELL_H = 24;
const HEADER_W = 60;
const HEADER_H = 24;

interface SimpleFrozenGridProps {
  gridId: string;
  sheetId: number;
}

export default function SimpleFrozenGrid({ gridId, sheetId }: SimpleFrozenGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  
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
  
  // Calculate dimensions
  const frozenWidth = freezeCols > 0 ? colWidths.slice(0, freezeCols).reduce((sum, w) => sum + (w ?? CELL_W), 0) : 0;
  const frozenHeight = freezeRows > 0 ? rowHeights.slice(0, freezeRows).reduce((sum, h) => sum + (h ?? CELL_H), 0) : 0;
  
  const totalWidth = colWidths.reduce((sum, w) => sum + (w ?? CELL_W), 0);
  const totalHeight = rowHeights.reduce((sum, h) => sum + (h ?? CELL_H), 0);
  
  // Render a single cell
  const renderCell = (row: number, col: number, isHeader = false) => {
    const cellKey = `${row}:${col}`;
    const style = styles[cellKey] || {};
    const cellValue = getCellDisplayValue(row, col);
    const text = String(cellValue ?? "");
    
    const cellStyle: React.CSSProperties = {
      position: 'absolute',
      left: colWidths.slice(0, col).reduce((sum, w) => sum + (w ?? CELL_W), 0),
      top: rowHeights.slice(0, row).reduce((sum, h) => sum + (h ?? CELL_H), 0),
      width: colWidths[col] ?? CELL_W,
      height: rowHeights[row] ?? CELL_H,
      border: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      padding: '0 6px',
      backgroundColor: style.bg || '#ffffff',
      color: style.color || '#111827',
      fontSize: style.fontSize || 12,
      fontWeight: style.bold ? 'bold' : 'normal',
      textAlign: style.align || 'left',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      cursor: 'cell',
      boxSizing: 'border-box'
    };
    
    return (
      <div
        key={cellKey}
        style={cellStyle}
        onClick={() => setActive(row, col)}
      >
        {text}
      </div>
    );
  };
  
  // Generate cells for a region with scroll offset
  const renderRegion = (startRow: number, endRow: number, startCol: number, endCol: number, scrollLeft = 0, scrollTop = 0) => {
    const cells = [];
    for (let r = startRow; r < endRow && r < rows; r++) {
      for (let c = startCol; c < endCol && c < cols; c++) {
        const cellStyle: React.CSSProperties = {
          position: 'absolute',
          left: colWidths.slice(startCol, c).reduce((sum, w) => sum + (w ?? CELL_W), 0) - scrollLeft,
          top: rowHeights.slice(startRow, r).reduce((sum, h) => sum + (h ?? CELL_H), 0) - scrollTop,
          width: colWidths[c] ?? CELL_W,
          height: rowHeights[r] ?? CELL_H,
          border: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          padding: '0 6px',
          backgroundColor: styles[`${r}:${c}`]?.bg || '#ffffff',
          color: styles[`${r}:${c}`]?.color || '#111827',
          fontSize: styles[`${r}:${c}`]?.fontSize || 12,
          fontWeight: styles[`${r}:${c}`]?.bold ? 'bold' : 'normal',
          textAlign: styles[`${r}:${c}`]?.align || 'left',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          cursor: 'cell',
          boxSizing: 'border-box'
        };
        
        const cellValue = getCellDisplayValue(r, c);
        const text = String(cellValue ?? "");
        
        cells.push(
          <div
            key={`${r}:${c}`}
            style={cellStyle}
            onClick={() => setActive(r, c)}
          >
            {text}
          </div>
        );
      }
    }
    return cells;
  };
  
  // Handle main area scroll
  const handleMainScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScroll({
      left: target.scrollLeft,
      top: target.scrollTop
    });
  };
  
  return (
    <div ref={containerRef} className="relative w-full h-full bg-white overflow-hidden">
      {/* Headers - 固定不动 */}
      <div className="absolute top-0 left-0 w-full bg-gray-200 border-b z-50" style={{ height: HEADER_H }}>
        <div className="absolute top-0 left-0 w-15 h-6 bg-gray-300 border-r"></div>
      </div>
      <div className="absolute top-0 left-0 bg-gray-200 border-r z-50" style={{ width: HEADER_W, height: '100%' }}></div>
      
      {/* 冻结交集区域 - 完全固定 */}
      {freezeRows > 0 && freezeCols > 0 && (
        <div
          className="absolute z-40 bg-yellow-100 border border-yellow-300"
          style={{
            top: HEADER_H,
            left: HEADER_W,
            width: frozenWidth,
            height: frozenHeight,
          }}
        >
          <div className="relative overflow-hidden" style={{ width: frozenWidth, height: frozenHeight }}>
            {renderRegion(0, freezeRows, 0, freezeCols, 0, 0)}
          </div>
        </div>
      )}
      
      {/* 冻结顶部行 - 垂直固定，水平跟随主区域滚动 */}
      {freezeRows > 0 && (
        <div
          className="absolute z-30 bg-red-100 border border-red-300 overflow-hidden"
          style={{
            top: HEADER_H,
            left: HEADER_W + frozenWidth,
            right: 0,
            height: frozenHeight,
          }}
        >
          <div className="relative" style={{ 
            width: Math.max(400, totalWidth - frozenWidth), 
            height: frozenHeight,
            transform: `translateX(-${scroll.left}px)` // 关键：跟随水平滚动
          }}>
            {renderRegion(0, freezeRows, freezeCols, cols, 0, 0)}
          </div>
        </div>
      )}
      
      {/* 冻结左侧列 - 水平固定，垂直跟随主区域滚动 */}
      {freezeCols > 0 && (
        <div
          className="absolute z-30 bg-green-100 border border-green-300 overflow-hidden"
          style={{
            top: HEADER_H + frozenHeight,
            left: HEADER_W,
            bottom: 0,
            width: frozenWidth,
          }}
        >
          <div className="relative" style={{ 
            width: frozenWidth, 
            height: Math.max(300, totalHeight - frozenHeight),
            transform: `translateY(-${scroll.top}px)` // 关键：跟随垂直滚动
          }}>
            {renderRegion(freezeRows, rows, 0, freezeCols, 0, 0)}
          </div>
        </div>
      )}
      
      {/* 主滚动区域 */}
      <div
        className="absolute overflow-auto bg-white"
        style={{
          top: HEADER_H + frozenHeight,
          left: HEADER_W + frozenWidth,
          right: 0,
          bottom: 0
        }}
        onScroll={handleMainScroll}
      >
        <div className="relative" style={{ 
          width: Math.max(400, totalWidth - frozenWidth), 
          height: Math.max(300, totalHeight - frozenHeight) 
        }}>
          {renderRegion(freezeRows, rows, freezeCols, cols, 0, 0)}
        </div>
      </div>
      
      {/* Debug info */}
      <div className="absolute top-2 right-2 bg-black text-white text-xs p-2 rounded z-50">
        冻结: {freezeRows}行 {freezeCols}列
        <br />
        滚动: {scroll.left},{scroll.top}
      </div>
    </div>
  );
}
