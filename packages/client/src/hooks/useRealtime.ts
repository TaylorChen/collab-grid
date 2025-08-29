import { useEffect } from "react";
import { connectWS, disconnectWS, getWS } from "@/services/websocket";
import { useRealtimeStore } from "@/stores/realtimeStore";
import { useGridStore } from "@/stores/gridStore";

export function useRealtime(gridId: string, sheetId?: number, token?: string) {
  const setConnected = useRealtimeStore((s) => s.setConnected);

  useEffect(() => {
    console.log('🔌 useRealtime: 连接中...', { gridId, sheetId, token: !!token });
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
    const socket = getWS();
    if (socket && socket.connected && sheetId != null) {
      socket.emit("grid:join", { gridId, sheetId });
    }
  }, [gridId, sheetId]);

  return { socket: getWS() };
}

