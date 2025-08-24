import React, { useEffect, useRef, useState } from "react";
import { useGridStore } from "@/stores/gridStore";
import { getWS } from "@/services/websocket";
import { useUserStore } from "@/stores/userStore";
import { useRealtimeStore } from "@/stores/realtimeStore";

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
  const lockByCell = useRealtimeStore((s) => s.lockByCell);
  const lockTokenRef = useRef<string | null>(null);
  const renewTimerRef = useRef<any>(null);
  const [notice, setNotice] = useState<{ left: number; top: number; text: string } | null>(null);
  const noticeTimerRef = useRef<any>(null);

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

    // 3) values (support multi-line by splitting on \n)
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
      const lines = v.split("\n");
      const lineH = (Math.max(12, size)) * 1.2;
      const centerY = cellTop2 + ch / 2;
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i];
        const w = ctx.measureText(t).width;
        let tx = cellLeft2 + 6;
        if (style.align === "center") tx = cellLeft2 + cw / 2 - w / 2;
        if (style.align === "right") tx = cellLeft2 + cw - 6 - w;
        const ty = centerY + (i - (lines.length - 1) / 2) * lineH;
        ctx.fillText(t, tx, ty);
      }
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
    const cellKey = `${sheetId}:${row}:${col}`;
    const current = cells[key];
    setActive(row, col);
    // 软提示
    getWS()?.emit('cell:focus', { gridId, sheetId, row, col });
    // 若已被占用，给出提示
    const holder = lockByCell[cellKey];
    if (holder) {
      // 气泡提示，非阻塞
      let left = 0; for (let i = 0; i < col; i++) left += (colWidths[i] ?? CELL_W);
      let top = 0; for (let i = 0; i < row; i++) top += (rowHeights[i] ?? CELL_H);
      setNotice({ left: left + 8, top: top + 8, text: `${holder.displayName || (holder as any).name || '他人'} 正在编辑` });
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => setNotice(null), 1500);
      return;
    }
    // 申请锁
    const token = (crypto as any).randomUUID?.() || String(Date.now());
    lockTokenRef.current = token;
    const socket = getWS();
    socket?.emit('cell:lock:acquire', { gridId, sheetId, row, col, token });
    // 监听一次性结果
    const onGranted = (payload: any) => {
      if (!payload?.cellKey || payload?.token !== lockTokenRef.current) return;
      const [sId, rStr, cStr] = String(payload.cellKey).split(':');
      if (Number(sId) !== sheetId || Number(rStr) !== row || Number(cStr) !== col) return;
      setEditing({ row, col, value: String(current ?? "") });
      // 开始续期
      renewTimerRef.current = setInterval(() => {
        const t = lockTokenRef.current; if (!t) return;
        getWS()?.emit('cell:lock:renew', { gridId, sheetId, row, col, token: t });
      }, 2000);
      socket?.off('cell:lock:granted', onGranted);
      socket?.off('cell:lock:denied', onDenied);
    };
    const onDenied = (payload: any) => {
      if (!payload?.cellKey) return;
      const [sId, rStr, cStr] = String(payload.cellKey).split(':');
      if (Number(sId) !== sheetId || Number(rStr) !== row || Number(cStr) !== col) return;
      let left = 0; for (let i = 0; i < col; i++) left += (colWidths[i] ?? CELL_W);
      let top = 0; for (let i = 0; i < row; i++) top += (rowHeights[i] ?? CELL_H);
      const nick = payload?.holder?.displayName || payload?.holder?.name || '他人';
      setNotice({ left: left + 8, top: top + 8, text: `${nick} 正在编辑` });
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => setNotice(null), 1500);
      lockTokenRef.current = null;
      socket?.off('cell:lock:granted', onGranted);
      socket?.off('cell:lock:denied', onDenied);
    };
    socket?.on('cell:lock:granted', onGranted);
    socket?.on('cell:lock:denied', onDenied);
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
    // 释放锁与清理
    try {
      const t = lockTokenRef.current;
      if (t) socket?.emit('cell:lock:release', { gridId, sheetId, row: editing.row, col: editing.col, token: t });
    } catch {}
    lockTokenRef.current = null;
    if (renewTimerRef.current) { clearInterval(renewTimerRef.current); renewTimerRef.current = null; }
  }

  return (
    <div className="mt-4 overflow-auto border rounded relative">
      <canvas ref={canvasRef} onClick={handleClick} onMouseDown={handleMouseDown} style={{ cursor: 'cell' }} />
      {notice && (
        <div className="absolute text-xs bg-black/70 text-white px-2 py-1 rounded" style={{ left: notice.left, top: notice.top }}>
          {notice.text}
        </div>
      )}
      {editing && (
        <textarea
          autoFocus
          className="absolute border rounded px-1 py-0.5 text-sm bg-white shadow"
          style={{
            left: (() => { let s = 0; for (let i = 0; i < editing.col; i++) s += (colWidths[i] ?? CELL_W); return s + 1; })(),
            top: (() => { let s = 0; for (let i = 0; i < editing.row; i++) s += (rowHeights[i] ?? CELL_H); return s + 1; })(),
            width: (colWidths[editing.col] ?? CELL_W) - 2,
            height: (rowHeights[editing.row] ?? CELL_H) - 2,
            resize: 'none',
            overflow: 'auto'
          }}
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !(e as any).shiftKey) { e.preventDefault(); handleCommit(); }
            if (e.key === "Escape") setEditing(null);
          }}
        />
      )}
    </div>
  );
}

