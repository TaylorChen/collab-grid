import React, { useEffect, useRef, useState } from "react";
import { useGridStore } from "@/stores/gridStore";
import { getWS } from "@/services/websocket";
import { useUserStore } from "@/stores/userStore";
import { useRealtimeStore } from "@/stores/realtimeStore";

const CELL_W = 80;
const CELL_H = 24;
const HEADER_W = 0; // rollback: no headers
const HEADER_H = 0;

export default function CanvasGrid({ gridId = "demo", sheetId = 0 }: { gridId?: string; sheetId?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollHostRef = useRef<HTMLDivElement | null>(null);
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
  const freezeTopRow = useGridStore((s) => s.freezeTopRow);
  const freezeFirstCol = useGridStore((s) => s.freezeFirstCol);
  const toggleFreezeTopRow = useGridStore((s) => s.toggleFreezeTopRow);
  const toggleFreezeFirstCol = useGridStore((s) => s.toggleFreezeFirstCol);
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null);
  const actorId = useUserStore((s) => s.user?.id);
  const lockByCell = useRealtimeStore((s) => s.lockByCell);
  const lockTokenRef = useRef<string | null>(null);
  const renewTimerRef = useRef<any>(null);
  const [notice, setNotice] = useState<{ left: number; top: number; text: string } | null>(null);
  const noticeTimerRef = useRef<any>(null);
  const [menu, setMenu] = useState<{ left: number; top: number; row: number; col: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const topFreezeRef = useRef<HTMLCanvasElement | null>(null);
  const leftFreezeRef = useRef<HTMLCanvasElement | null>(null);
  const cornerFreezeRef = useRef<HTMLCanvasElement | null>(null);
  const colHeaderRef = useRef<HTMLCanvasElement | null>(null);
  const rowHeaderRef = useRef<HTMLCanvasElement | null>(null);
  const [scroll, setScroll] = useState<{ left: number; top: number }>(() => ({ left: 0, top: 0 }));

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!menu) return;
      const el = menuRef.current;
      if (el && el.contains(e.target as Node)) return;
      setMenu(null);
    }
    if (menu) document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [menu]);

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
    // 0) clip out frozen regions to avoid overlap when overlays draw them
    const fh = freezeTopRow ? (rowHeights[0] ?? CELL_H) : 0;
    const fw = freezeFirstCol ? (colWidths[0] ?? CELL_W) : 0;
    if (fh || fw) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fw + (freezeFirstCol ? 1 : 0), fh + (freezeTopRow ? 1 : 0), width - (fw + (freezeFirstCol ? 1 : 0)), height - (fh + (freezeTopRow ? 1 : 0)));
      ctx.clip();
    }
    // 1) backgrounds first（若冻结顶部/首列，则跳过对应区域，避免与覆盖层重叠）
    for (const key in styles) {
      const st = styles[key];
      if (!st?.bg) continue;
      const [r, c] = key.split(":").map(Number);
      if ((freezeTopRow && r === 0) || (freezeFirstCol && c === 0)) continue;
      const cellLeft = colWidths.slice(0, c).reduce((a, b) => a + b, 0);
      const cellTop = rowHeights.slice(0, r).reduce((a, b) => a + b, 0);
      const cw = colWidths[c] ?? CELL_W;
      const ch = rowHeights[r] ?? CELL_H;
      ctx.fillStyle = st.bg;
      ctx.fillRect(cellLeft + 1, cellTop + 1, cw - 1, ch - 1);
    }

    // 2) grid lines（避开冻结边界，避免叠线重影）
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    let yAcc = (freezeTopRow ? (rowHeights[0] ?? CELL_H) : 0) + 0.5;
    for (let r = (freezeTopRow ? 1 : 0); r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, yAcc);
      ctx.lineTo(width, yAcc);
      ctx.stroke();
      yAcc += r < rows ? (rowHeights[r] ?? CELL_H) : 0;
    }
    let xAcc = (freezeFirstCol ? (colWidths[0] ?? CELL_W) : 0) + 0.5;
    for (let c = (freezeFirstCol ? 1 : 0); c <= cols; c++) {
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
      if ((freezeTopRow && r === 0) || (freezeFirstCol && c === 0)) continue;
      const v = String(cells[key] ?? "");
      const style = styles[key] || {};
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
    if (fh || fw) ctx.restore();
    // 4) 冻结首行/首列的高亮边界（视觉提示）
    if (freezeTopRow) {
      const h = rowHeights[0] ?? CELL_H;
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h + 0.5);
      ctx.lineTo(width, h + 0.5);
      ctx.stroke();
    }
    if (freezeFirstCol) {
      const w = colWidths[0] ?? CELL_W;
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w + 0.5, 0);
      ctx.lineTo(w + 0.5, height);
      ctx.stroke();
    }
  }, [rows, cols, cells, styles, rowHeights, colWidths, freezeTopRow, freezeFirstCol]);

  // draw frozen top row overlay
  useEffect(() => {
    if (!freezeTopRow) return;
    const canvas = topFreezeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const container = containerRef.current;
    const visibleW = container ? container.clientWidth : (() => { let s = 0; for (let i = 0; i < cols; i++) s += (colWidths[i] ?? CELL_W); return s; })();
    const height = (rowHeights[0] ?? CELL_H) + 1;
    canvas.width = visibleW; canvas.height = height; ctx.clearRect(0, 0, visibleW, height);
    // find start col and offset by scroll.left
    let x = 0, startCol = 0; let leftOffset = scroll.left;
    while (startCol < cols) {
      const w = colWidths[startCol] ?? CELL_W;
      if (leftOffset < w) break; else { leftOffset -= w; startCol++; }
    }
    // draw visible cols
    let drawX = -leftOffset;
    ctx.textBaseline = 'middle';
    for (let c = startCol; c < cols && drawX < visibleW; c++) {
      const cw = colWidths[c] ?? CELL_W; const ch = rowHeights[0] ?? CELL_H;
      const st = styles[`0:${c}`] as any;
      if (st?.bg) { ctx.fillStyle = st.bg; ctx.fillRect(drawX + 1, 1, cw - 1, ch - 1); }
      // vertical grid line
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(drawX + 0.5, 0); ctx.lineTo(drawX + 0.5, height); ctx.stroke();
      // text
      const v = String(cells[`0:${c}`] ?? ""); const size = st?.fontSize || 12; ctx.font = `${st?.bold ? 'bold ' : ''}${size}px system-ui, -apple-system, Segoe UI, Roboto`; ctx.fillStyle = st?.color || '#111827';
      const lines = v.split('\n'); const lineH = Math.max(12, size) * 1.2; const centerY = ch / 2;
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i]; const w = ctx.measureText(t).width;
        let tx = drawX + 6; if (st?.align === 'center') tx = drawX + cw / 2 - w / 2; if (st?.align === 'right') tx = drawX + cw - 6 - w;
        const ty = centerY + (i - (lines.length - 1) / 2) * lineH; ctx.fillText(t, tx, ty);
      }
      drawX += cw;
    }
    // bottom bold line
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, (rowHeights[0] ?? CELL_H) + 0.5); ctx.lineTo(visibleW, (rowHeights[0] ?? CELL_H) + 0.5); ctx.stroke();
  }, [freezeTopRow, rows, cols, cells, styles, rowHeights, colWidths, scroll.left]);

  // draw frozen first col overlay
  useEffect(() => {
    if (!freezeFirstCol) return;
    const canvas = leftFreezeRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const container = containerRef.current; const visibleH = container ? container.clientHeight : (() => { let s = 0; for (let i = 0; i < rows; i++) s += (rowHeights[i] ?? CELL_H); return s; })();
    const width = (colWidths[0] ?? CELL_W) + 1;
    canvas.width = width; canvas.height = visibleH; ctx.clearRect(0, 0, width, visibleH);
    // find start row by scroll.top
    let topOffset = scroll.top; let startRow = 0; while (startRow < rows) { const h = rowHeights[startRow] ?? CELL_H; if (topOffset < h) break; else { topOffset -= h; startRow++; } }
    // draw visible rows
    ctx.textBaseline = 'middle';
    let drawY = -topOffset;
    for (let r = startRow; r < rows && drawY < visibleH; r++) {
      const cw = colWidths[0] ?? CELL_W; const ch = rowHeights[r] ?? CELL_H; const st = styles[`${r}:0`] as any;
      if (st?.bg) { ctx.fillStyle = st.bg; ctx.fillRect(1, drawY + 1, cw - 1, ch - 1); }
      // horizontal grid line
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, drawY + 0.5); ctx.lineTo(width, drawY + 0.5); ctx.stroke();
      const v = String(cells[`${r}:0`] ?? ""); const size = st?.fontSize || 12; ctx.font = `${st?.bold ? 'bold ' : ''}${size}px system-ui, -apple-system, Segoe UI, Roboto`; ctx.fillStyle = st?.color || '#111827';
      const lines = v.split('\n'); const lineH = Math.max(12, size) * 1.2; const centerY = drawY + ch / 2;
      for (let i = 0; i < lines.length; i++) { const t = lines[i]; const w = ctx.measureText(t).width; let tx = 6; if (st?.align === 'center') tx = cw / 2 - w / 2; if (st?.align === 'right') tx = cw - 6 - w; const ty = centerY + (i - (lines.length - 1) / 2) * lineH; ctx.fillText(t, tx, ty); }
      drawY += ch;
    }
    // right bold line
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo((colWidths[0] ?? CELL_W) + 0.5, 0); ctx.lineTo((colWidths[0] ?? CELL_W) + 0.5, visibleH); ctx.stroke();
  }, [freezeFirstCol, rows, cols, cells, styles, rowHeights, colWidths, scroll.top]);

  // draw corner overlay when both frozen
  useEffect(() => {
    if (!(freezeTopRow && freezeFirstCol)) return;
    const canvas = cornerFreezeRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const cw = (colWidths[0] ?? CELL_W) + 1; const ch = (rowHeights[0] ?? CELL_H) + 1; canvas.width = cw; canvas.height = ch; ctx.clearRect(0, 0, cw, ch);
    const st = styles['0:0'] || {} as any; if (st.bg) { ctx.fillStyle = st.bg; ctx.fillRect(1, 1, (colWidths[0] ?? CELL_W) - 1, (rowHeights[0] ?? CELL_H) - 1); }
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, (rowHeights[0] ?? CELL_H) + 0.5); ctx.lineTo(cw, (rowHeights[0] ?? CELL_H) + 0.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo((colWidths[0] ?? CELL_W) + 0.5, 0); ctx.lineTo((colWidths[0] ?? CELL_W) + 0.5, ch); ctx.stroke();
    const size = st.fontSize || 12; ctx.font = `${st.bold ? 'bold ' : ''}${size}px system-ui, -apple-system, Segoe UI, Roboto`; ctx.fillStyle = st.color || '#111827'; const v = String(cells['0:0'] ?? ""); const lines = v.split('\n'); const lineH = Math.max(12, size) * 1.2; const centerY = (rowHeights[0] ?? CELL_H) / 2;
    for (let i = 0; i < lines.length; i++) { const t = lines[i]; const w = ctx.measureText(t).width; let tx = 6; if (st.align === 'center') tx = (colWidths[0] ?? CELL_W) / 2 - w / 2; if (st.align === 'right') tx = (colWidths[0] ?? CELL_W) - 6 - w; const ty = centerY + (i - (lines.length - 1) / 2) * lineH; ctx.fillText(t, tx, ty); }
  }, [freezeTopRow, freezeFirstCol, rows, cols, cells, styles, rowHeights, colWidths]);

  // 绘制列表头（A,B,C...），固定在容器顶部，宽度=容器可见宽度
  useEffect(() => {
    const canvas = colHeaderRef.current; const host = containerRef.current; if (!canvas || !host) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = host.clientWidth; const h = HEADER_H;
    canvas.width = Math.max(1, Math.floor(w * dpr)); canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f9fafb'; ctx.fillRect(0, 0, w, h);
    // 根据 scroll.left 计算起始列
    let offset = scroll.left; let start = 0; while (start < cols) { const cw = colWidths[start] ?? CELL_W; if (offset < cw) break; offset -= cw; start++; }
    let x = -offset; ctx.strokeStyle = '#e5e7eb'; ctx.fillStyle = '#374151'; ctx.textBaseline = 'middle'; ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto';
    const colName = (n: number) => { let s = ''; let t = n; do { s = String.fromCharCode(65 + (t % 26)) + s; t = Math.floor(t / 26) - 1; } while (t >= 0); return s; };
    for (let c = start; c < cols && x < w; c++) {
      const cw = colWidths[c] ?? CELL_W;
      // 分隔线
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      // 文本
      const label = colName(c);
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, x + cw / 2 - tw / 2, h / 2);
      x += cw;
    }
    // 底部分隔加深
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, h - 1); ctx.lineTo(w, h - 1); ctx.stroke();
  }, [cols, colWidths, scroll.left]);

  // 绘制行表头（1,2,3...），固定在容器左侧，高度=容器可见高度
  useEffect(() => {
    const canvas = rowHeaderRef.current; const host = containerRef.current; if (!canvas || !host) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = HEADER_W; const h = host.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr)); canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f9fafb'; ctx.fillRect(0, 0, w, h);
    // 根据 scroll.top 计算起始行
    let offset = scroll.top; let start = 0; while (start < rows) { const rh = rowHeights[start] ?? CELL_H; if (offset < rh) break; offset -= rh; start++; }
    let y = -offset; ctx.strokeStyle = '#e5e7eb'; ctx.fillStyle = '#374151'; ctx.textBaseline = 'middle'; ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto';
    for (let r = start; r < rows && y < h; r++) {
      const rh = rowHeights[r] ?? CELL_H;
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
      const label = String(r + 1); const tw = ctx.measureText(label).width;
      ctx.fillText(label, w - 6 - tw, y + rh / 2);
      y += rh;
    }
    // 右侧分隔加深
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w - 1, 0); ctx.lineTo(w - 1, h); ctx.stroke();
  }, [rows, rowHeights, scroll.top]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
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
      setNotice({ left: left - scroll.left + 8, top: top - scroll.top + 8, text: `${holder.displayName || (holder as any).name || '他人'} 正在编辑` });
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
      setNotice({ left: left - scroll.left + 8, top: top - scroll.top + 8, text: `${nick} 正在编辑` });
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => setNotice(null), 1500);
      lockTokenRef.current = null;
      socket?.off('cell:lock:granted', onGranted);
      socket?.off('cell:lock:denied', onDenied);
    };
    socket?.on('cell:lock:granted', onGranted);
    socket?.on('cell:lock:denied', onDenied);
  }

  // Right-click context menu for insert/delete rows/cols (中文菜单)
  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    let col = 0, sumX = 0;
    while (col < cols && sumX + (colWidths[col] ?? CELL_W) < x) { sumX += (colWidths[col] ?? CELL_W); col++; }
    let row = 0, sumY = 0;
    while (row < rows && sumY + (rowHeights[row] ?? CELL_H) < y) { sumY += (rowHeights[row] ?? CELL_H); row++; }
    const container = canvasRef.current?.parentElement;
    const crect = container?.getBoundingClientRect();
    const left = crect ? (e.clientX - crect.left) : e.clientX;
    const top = crect ? (e.clientY - crect.top) : e.clientY;
    setMenu({ left, top, row, col });
  }

  function actInsertRow(where: 'before' | 'after') {
    if (!menu) return; const socket = getWS(); if (!socket) return;
    // optimistic UI update
    const s = useGridStore.getState();
    const pivot = where === 'after' ? (menu.row + 1) : menu.row;
    const arr = s.rowHeights.slice();
    arr.splice(pivot, 0, 24);
    s.setAllRowHeights(s.activeSheetId, arr);
    s.setSize(s.rows + 1, s.cols);
    // server persist
    socket.emit('grid:operation', { type: 'grid:row:insert', gridId, sheetId, payload: { where, at: menu.row, count: 1 } });
    setMenu(null);
  }
  function actDeleteRow() {
    if (!menu) return; if (rows <= 1) { alert('至少保留一行'); return; }
    const socket = getWS(); if (!socket) return;
    // optimistic
    const s = useGridStore.getState();
    const arr = s.rowHeights.slice();
    arr.splice(menu.row, 1);
    s.setAllRowHeights(s.activeSheetId, arr);
    s.setSize(Math.max(1, s.rows - 1), s.cols);
    // server
    socket.emit('grid:operation', { type: 'grid:row:delete', gridId, sheetId, payload: { at: menu.row, count: 1 } });
    setMenu(null);
  }
  function actInsertCol(where: 'before' | 'after') {
    if (!menu) return; const socket = getWS(); if (!socket) return;
    // optimistic
    const s = useGridStore.getState();
    const pivot = where === 'after' ? (menu.col + 1) : menu.col;
    const arr = s.colWidths.slice();
    arr.splice(pivot, 0, 80);
    s.setAllColWidths(s.activeSheetId, arr);
    s.setSize(s.rows, s.cols + 1);
    // server
    socket.emit('grid:operation', { type: 'grid:col:insert', gridId, sheetId, payload: { where, at: menu.col, count: 1 } });
    setMenu(null);
  }
  function actDeleteCol() {
    if (!menu) return; if (cols <= 1) { alert('至少保留一列'); return; }
    const socket = getWS(); if (!socket) return;
    // optimistic
    const s = useGridStore.getState();
    const arr = s.colWidths.slice();
    arr.splice(menu.col, 1);
    s.setAllColWidths(s.activeSheetId, arr);
    s.setSize(s.rows, Math.max(1, s.cols - 1));
    // server
    socket.emit('grid:operation', { type: 'grid:col:delete', gridId, sheetId, payload: { at: menu.col, count: 1 } });
    setMenu(null);
  }

  // simple resize by dragging right/bottom borders
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    let col = 0, sumX = 0;
    while (col < cols && sumX + (colWidths[col] || CELL_W) < x) { sumX += (colWidths[col] || CELL_W); col++; }
    let row = 0, sumY = 0;
    while (row < rows && sumY + (rowHeights[row] || CELL_H) < y) { sumY += (rowHeights[row] || CELL_H); row++; }
    const nearRight = Math.abs(x - (sumX + (colWidths[col] || CELL_W))) < 4;
    const nearBottom = Math.abs(y - (sumY + (rowHeights[row] || CELL_H))) < 4;
    if (!nearRight && !nearBottom) return;
    const startX = x; const startY = y; const startW = colWidths[col] || CELL_W; const startH = rowHeights[row] || CELL_H;
    function onMove(ev: MouseEvent) {
      const nx = (ev.clientX - rect.left); const ny = (ev.clientY - rect.top);
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

  // attach scroll listener to nearest scrollable ancestor
  useEffect(() => {
    let el: HTMLDivElement | null = containerRef.current;
    let host: HTMLDivElement | null = el;
    // climb up to find the element that actually scrolls
    while (host && host.parentElement) {
      const style = window.getComputedStyle(host);
      const isScrollable = /(auto|scroll)/.test(style.overflowY) || host.scrollHeight > host.clientHeight;
      if (isScrollable) break;
      host = host.parentElement as HTMLDivElement;
    }
    if (!host) return;
    scrollHostRef.current = host;
    const onScroll = () => setScroll({ left: host!.scrollLeft, top: host!.scrollTop });
    host.addEventListener('scroll', onScroll);
    return () => host && host.removeEventListener('scroll', onScroll);
  }, []);


  return (
    <div ref={containerRef} className="mt-4 border rounded relative overflow-auto">
      <canvas ref={canvasRef} onClick={handleClick} onMouseDown={handleMouseDown} onContextMenu={handleContextMenu} style={{ cursor: 'cell', display: 'block' }} />
      {/* Frozen overlays */}
      {freezeTopRow && (<canvas ref={topFreezeRef} className="z-10" style={{ position: 'absolute', pointerEvents: 'none', background: 'transparent', top: 0, left: 0 }} />)}
      {freezeFirstCol && (<canvas ref={leftFreezeRef} className="z-10" style={{ position: 'absolute', pointerEvents: 'none', background: 'transparent', top: 0, left: 0 }} />)}
      {freezeTopRow && freezeFirstCol && (<canvas ref={cornerFreezeRef} className="z-20" style={{ position: 'absolute', pointerEvents: 'none', background: 'transparent', top: 0, left: 0 }} />)}
      {menu && (
        <div ref={menuRef} className="absolute bg-white border rounded shadow text-sm select-none" style={{ left: menu.left, top: menu.top, minWidth: 180 }}>
          <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => actInsertRow('before')}>在上方插入行</div>
          <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => actInsertRow('after')}>在下方插入行</div>
          <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={actDeleteRow}>删除行</div>
          <div className="h-px bg-gray-200 my-1" />
          <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => actInsertCol('before')}>在左侧插入列</div>
          <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => actInsertCol('after')}>在右侧插入列</div>
          <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer" onClick={actDeleteCol}>删除列</div>
        </div>
      )}
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
            left: HEADER_W + (() => { let s = 0; for (let i = 0; i < editing.col; i++) s += (colWidths[i] ?? CELL_W); return s + 1; })() - scroll.left,
            top: HEADER_H + (() => { let s = 0; for (let i = 0; i < editing.row; i++) s += (rowHeights[i] ?? CELL_H); return s + 1; })() - scroll.top,
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

