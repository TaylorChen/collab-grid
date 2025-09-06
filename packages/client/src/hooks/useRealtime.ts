import { useEffect } from "react";
import { connectWS, disconnectWS, getWS } from "@/services/websocket";
import { useRealtimeStore } from "@/stores/realtimeStore";
import { useGridStore } from "@/stores/gridStore";

export function useRealtime(gridId: string, sheetId?: number, token?: string) {
  const setConnected = useRealtimeStore((s) => s.setConnected);

  useEffect(() => {
    console.log('🔌 useRealtime: 检查Demo模式', { gridId, sheetId, token: !!token });
    
    // 在demo模式下，完全跳过WebSocket
    if (token?.startsWith('demo-token-')) {
      console.log('🎭 Demo模式：完全禁用WebSocket和实时功能');
      setConnected(false);
      return () => {
        console.log('🎭 Demo模式：cleanup函数（无操作）');
      };
    }
    
    const socket = connectWS(token);
    socket.on("connect", () => {
      console.log('🔌 useRealtime: WebSocket已连接', { gridId, sheetId });
      setConnected(true);
      if (sheetId != null) {
        console.log('🔌 useRealtime: 准备设置activeSheet...', { sheetId });
        useGridStore.getState().setActiveSheet(sheetId);
      }
      console.log('🔌 useRealtime: 发送grid:join...', { gridId, sheetId });
      socket.emit("grid:join", { gridId, sheetId });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("grid:snapshot", (snap: any) => {
      console.log('📊 收到grid:snapshot:', { 
        rows: snap.rows, 
        cols: snap.cols, 
        rowHeights: snap.rowHeights?.length, 
        colWidths: snap.colWidths?.length,
        sheetId 
      });
      
      useGridStore.getState().reset(snap.rows, snap.cols);
      // apply local fallback layout if server didn't send sizes
      try {
        if ((!Array.isArray(snap.rowHeights) || !Array.isArray(snap.colWidths)) && sheetId != null) {
          const key = `grid:layout:${gridId}:${sheetId}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.rowHeights)) useGridStore.getState().setAllRowHeights(sheetId, parsed.rowHeights);
            if (Array.isArray(parsed.colWidths)) useGridStore.getState().setAllColWidths(sheetId, parsed.colWidths);
          }
        }
      } catch {}
      if (sheetId != null && typeof sheetId === 'number') {
        if (Array.isArray(snap.rowHeights)) {
          useGridStore.getState().setAllRowHeights(sheetId, snap.rowHeights);
        }
        if (Array.isArray(snap.colWidths)) {
          useGridStore.getState().setAllColWidths(sheetId, snap.colWidths);
        }
        // 无论如何都要调用setActiveSheet，它会确保有默认的colWidths
        useGridStore.getState().setActiveSheet(sheetId);
      } else {
        if (Array.isArray(snap.rowHeights)) snap.rowHeights.forEach((h: number, i: number) => useGridStore.getState().setRowHeight(i, h));
        if (Array.isArray(snap.colWidths)) snap.colWidths.forEach((w: number, i: number) => useGridStore.getState().setColWidth(i, w));
      }
      // apply persisted cells if provided
      if (Array.isArray(snap.cells)) {
        const setCell = useGridStore.getState().setCell;
        const setStyle = useGridStore.getState().setStyle;
        for (const c of snap.cells) {
          if (typeof c.row === "number" && typeof c.col === "number") {
            setCell(c.row, c.col, c.value ?? null);
            if (c.style) setStyle(c.row, c.col, c.style);
          }
        }
      }
    });
    socket.on("grid:operation", (op: any) => {
      if (op?.sheetId != null && op.sheetId !== sheetId) return;
      if (op?.type === "cell:update") {
        const { row, col, value } = op.payload || {};
        useGridStore.getState().setCell(row, col, value);
        // 气泡提示：展示协作者对该单元格的更新
        try {
          const el = document.createElement('div');
          el.textContent = `单元格 ${String.fromCharCode(65 + (col ?? 0))}${(row ?? 0) + 1} 已更新`;
          el.style.position = 'fixed';
          el.style.right = '16px';
          el.style.bottom = '16px';
          el.style.background = 'rgba(17,24,39,0.9)';
          el.style.color = '#fff';
          el.style.padding = '8px 12px';
          el.style.borderRadius = '8px';
          el.style.fontSize = '12px';
          el.style.zIndex = '9999';
          document.body.appendChild(el);
          setTimeout(() => el.remove(), 1800);
        } catch {}
      } else if (op?.type === "cell:style") {
        const { row, col, style } = op.payload || {};
        if (row != null && col != null && style) useGridStore.getState().setStyle(row, col, style);
      } else if (op?.type === "grid:dimension") {
        const { rows, cols } = op.payload || {};
        if (rows) useGridStore.getState().setSize(rows, useGridStore.getState().cols);
        if (cols) useGridStore.getState().setSize(useGridStore.getState().rows, cols);
      } else if (op?.type === "grid:resize") {
        const { rowHeights, colWidths } = op.payload || {};
        const s = useGridStore.getState();
        if (Array.isArray(rowHeights)) rowHeights.forEach((h: number, i: number) => s.setRowHeight(i, h));
        if (Array.isArray(colWidths)) colWidths.forEach((w: number, i: number) => s.setColWidth(i, w));
      } else if (op?.type === "grid:row:insert") {
        const { at, where, count } = op.payload || {};
        if (typeof at === 'number' && where && typeof count === 'number') {
          useGridStore.getState().insertRow(at, where, count);
        }
      } else if (op?.type === "grid:row:delete") {
        const { at, count } = op.payload || {};
        if (typeof at === 'number' && typeof count === 'number') {
          useGridStore.getState().deleteRow(at, count);
        }
      } else if (op?.type === "grid:col:insert") {
        const { at, where, count } = op.payload || {};
        if (typeof at === 'number' && where && typeof count === 'number') {
          useGridStore.getState().insertCol(at, where, count);
        }
      } else if (op?.type === "grid:col:delete") {
        const { at, count } = op.payload || {};
        if (typeof at === 'number' && typeof count === 'number') {
          useGridStore.getState().deleteCol(at, count);
        }
      } else if (op?.type === "grid:merge:cells") {
        const { startRow, startCol, endRow, endCol } = op.payload || {};
        if (typeof startRow === 'number' && typeof startCol === 'number' && 
            typeof endRow === 'number' && typeof endCol === 'number') {
          useGridStore.getState().mergeCells(startRow, startCol, endRow, endCol);
        }
      } else if (op?.type === "grid:unmerge:cells") {
        const { startRow, startCol } = op.payload || {};
        if (typeof startRow === 'number' && typeof startCol === 'number') {
          useGridStore.getState().unmergeCells(startRow, startCol);
        }
      }
    });

    // presence & lock events
    socket.on("cell:presence", (data: any) => {
      if (!data?.cellKey) return;
      useRealtimeStore.getState().setCellPresence(data.cellKey, data.users || []);
    });
    socket.on("cell:lock:granted", ({ cellKey, holder }: any) => {
      useRealtimeStore.getState().setCellLock(cellKey, holder || null);
    });
    socket.on("cell:lock:denied", ({ cellKey, holder }: any) => {
      // 只给出锁拒绝提示，锁状态仍以 granted 为准
      useRealtimeStore.getState().setCellLock(cellKey, holder || null);
    });
    socket.on("cell:lock:released", ({ cellKey }: any) => {
      useRealtimeStore.getState().setCellLock(cellKey, null);
    });

    return () => {
      disconnectWS();
    };
  }, [gridId, sheetId, setConnected]);

  // 当切换 sheet 时，重新加入并等待快照（不立即清空数据）
  useEffect(() => {
    // Demo模式下跳过sheet切换的WebSocket操作
    if (token?.startsWith('demo-token-')) {
      console.log('🎭 Demo模式：跳过sheet切换WebSocket操作');
      return;
    }
    
    const socket = getWS();
    if (socket && socket.connected && sheetId != null) {
      socket.emit("grid:join", { gridId, sheetId });
    }
  }, [gridId, sheetId, token]);

  return { socket: getWS() };
}

