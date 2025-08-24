import React, { useEffect, useRef, useState } from "react";
import { useGridStore } from "@/stores/gridStore";
import { getWS } from "@/services/websocket";
import { useUserStore } from "@/stores/userStore";

const CELL_W = 80;
const CELL_H = 24;

export default function CanvasGrid({ gridId = "demo", sheetId = 0 }: { gridId?: string; sheetId?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rows = useGridStore((s) => s.rows);
  const cols = useGridStore((s) => s.cols);
  const cells = useGridStore((s) => s.cells);
  const styles = useGridStore((s) => s.styles);
  const setActive = useGridStore((s) => s.setActive);
  const rowHeights = useGridStore((s) => s.rowHeights);
  const colWidths = useGridStore((s) => s.colWidths);
  const setRowHeight = useGridStore((s) => s.setRowHeight);
  const setColWidth = useGridStore((s) => s.setColWidth);
  const setCell = useGridStore((s) => s.setCell);
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const actorId = useUserStore((s) => s.user?.id);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fallback-friendly sum: 如果当前 sheet 尚未写入布局数组，则使用默认值
    const sumCols = () => {
      let s = 0; for (let i = 0; i < cols; i++) s += (colWidths[i] ?? CELL_W); return s;
    };
    const sumRows = () => {
      let s = 0; for (let i = 0; i < rows; i++) s += (rowHeights[i] ?? CELL_H); return s;
    };
    const width = sumCols() + 1;
    const height = sumRows() + 1;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    // 1) backgrounds first
    for (const key in styles) {
      const st = styles[key];
      if (!st?.bg) continue;
      const [r, c] = key.split(":").map(Number);
      const cellLeft = colWidths.slice(0, c).reduce((a, b) => a + b, 0);
      const cellTop = rowHeights.slice(0, r).reduce((a, b) => a + b, 0);
      const cw = colWidths[c] ?? CELL_W;
      const ch = rowHeights[r] ?? CELL_H;
      ctx.fillStyle = st.bg;
      ctx.fillRect(cellLeft + 1, cellTop + 1, cw - 1, ch - 1);
    }

    // 2) grid lines
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    let yAcc = 0.5;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, yAcc);
      ctx.lineTo(width, yAcc);
      ctx.stroke();
      yAcc += r < rows ? (rowHeights[r] ?? CELL_H) : 0;
    }
    let xAcc = 0.5;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(xAcc, 0);
      ctx.lineTo(xAcc, height);
      ctx.stroke();
      xAcc += c < cols ? (colWidths[c] ?? CELL_W) : 0;
    }

    // 3) values
    ctx.textBaseline = 'middle';
    for (const key in cells) {
      const [r, c] = key.split(":").map(Number);
      const v = String(cells[key] ?? "");
      const style = styles[key] || {};
      let cellLeft = 0; for (let i = 0; i < c; i++) cellLeft += (colWidths[i] ?? CELL_W);
      let cellTop = 0; for (let i = 0; i < r; i++) cellTop += (rowHeights[i] ?? CELL_H);
      let cellLeft2 = 0; for (let i = 0; i < c; i++) cellLeft2 += (colWidths[i] ?? CELL_W);
      let cellTop2 = 0; for (let i = 0; i < r; i++) cellTop2 += (rowHeights[i] ?? CELL_H);
      const cw = colWidths[c] ?? CELL_W;
      const ch = rowHeights[r] ?? CELL_H;
      const size = style.fontSize || 12;
      ctx.font = `${style.bold ? "bold " : ""}${size}px system-ui, -apple-system, Segoe UI, Roboto`;
      ctx.fillStyle = style.color || "#111827";
      let textX = cellLeft2 + 6;
      const textW = ctx.measureText(v).width;
      if (style.align === "center") textX = cellLeft2 + cw / 2 - textW / 2;
      if (style.align === "right") textX = cellLeft2 + cw - 6 - textW;
      const textY = cellTop2 + ch / 2;
      ctx.fillText(v, textX, textY);
    }
  }, [rows, cols, cells, styles, rowHeights, colWidths]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // map x/y to row/col with variable sizes
    let col = 0, sumX = 0;
    while (col < cols && sumX + (colWidths[col] ?? CELL_W) < x) { sumX += (colWidths[col] ?? CELL_W); col++; }
    let row = 0, sumY = 0;
    while (row < rows && sumY + (rowHeights[row] ?? CELL_H) < y) { sumY += (rowHeights[row] ?? CELL_H); row++; }
    const key = `${row}:${col}`;
    const current = cells[key];
    setEditing({ row, col, value: String(current ?? "") });
    setActive(row, col);
  }

  // simple resize by dragging right/bottom borders
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let col = 0, sumX = 0;
    while (col < cols && sumX + (colWidths[col] || CELL_W) < x) { sumX += (colWidths[col] || CELL_W); col++; }
    let row = 0, sumY = 0;
    while (row < rows && sumY + (rowHeights[row] || CELL_H) < y) { sumY += (rowHeights[row] || CELL_H); row++; }
    const nearRight = Math.abs(x - (sumX + (colWidths[col] || CELL_W))) < 4;
    const nearBottom = Math.abs(y - (sumY + (rowHeights[row] || CELL_H))) < 4;
    if (!nearRight && !nearBottom) return;
    const startX = x; const startY = y; const startW = colWidths[col] || CELL_W; const startH = rowHeights[row] || CELL_H;
    function onMove(ev: MouseEvent) {
      const nx = ev.clientX - rect.left; const ny = ev.clientY - rect.top;
      if (nearRight) setColWidth(col, Math.max(40, startW + (nx - startX)));
      if (nearBottom) setRowHeight(row, Math.max(18, startH + (ny - startY)));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const socket = getWS();
      // use latest arrays from store to avoid stale payload
      const s = useGridStore.getState();
      socket?.emit('grid:operation', { type: 'grid:resize', gridId, sheetId, payload: { rowHeights: s.rowHeights, colWidths: s.colWidths } });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleCommit() {
    if (!editing) return;
    setCell(editing.row, editing.col, editing.value);
    const socket = getWS();
    socket?.emit("grid:operation", {
      id: crypto.randomUUID?.() || String(Date.now()),
      gridId,
      sheetId,
      actorId,
      ts: Date.now(),
      type: "cell:update",
      payload: { row: editing.row, col: editing.col, value: editing.value }
    });
    setEditing(null);
  }

  return (
    <div className="mt-4 overflow-auto border rounded relative">
      <canvas ref={canvasRef} onClick={handleClick} onMouseDown={handleMouseDown} style={{ cursor: 'cell' }} />
      {editing && (
        <input
          autoFocus
          className="absolute border rounded px-1 py-0.5 text-sm bg-white shadow"
          style={{
            left: (() => { let s = 0; for (let i = 0; i < editing.col; i++) s += (colWidths[i] ?? CELL_W); return s + 1; })(),
            top: (() => { let s = 0; for (let i = 0; i < editing.row; i++) s += (rowHeights[i] ?? CELL_H); return s + 1; })(),
            width: (colWidths[editing.col] ?? CELL_W) - 2,
            height: (rowHeights[editing.row] ?? CELL_H) - 2
          }}
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCommit();
            if (e.key === "Escape") setEditing(null);
          }}
        />
      )}
    </div>
  );
}

