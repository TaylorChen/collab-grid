import React from "react";
import { useGridStore } from "@/stores/gridStore";
import { getWS } from "@/services/websocket";

export default function FormatToolbar({ gridId, sheetId = 0, title, onTitleChange, onTitleBlur }: { gridId: string; sheetId?: number; title?: string; onTitleChange?: (v: string) => void; onTitleBlur?: () => void }) {
  const active = useGridStore((s) => s.active);
  const styles = useGridStore((s) => s.styles);
  const setStyle = useGridStore((s) => s.setStyle);
  const freezeTopRow = useGridStore((s) => s.freezeTopRow);
  const freezeFirstCol = useGridStore((s) => s.freezeFirstCol);
  const toggleFreezeTopRow = useGridStore((s) => s.toggleFreezeTopRow);
  const toggleFreezeFirstCol = useGridStore((s) => s.toggleFreezeFirstCol);

  function apply(patch: any) {
    if (!active) return;
    setStyle(active.row, active.col, patch);
    const socket = getWS();
    socket?.emit("grid:operation", {
      id: crypto.randomUUID?.() || String(Date.now()),
      gridId,
      sheetId,
      type: "cell:style",
      payload: { row: active.row, col: active.col, style: { ...styles[`${active.row}:${active.col}`], ...patch } }
    });
  }

  const key = active ? `${active.row}:${active.col}` : "";
  const st = (key && styles[key]) || {};

  return (
    <div className="flex gap-2 items-center border-b px-2 py-1 bg-white sticky top-0 z-10 select-none">
      <input
        className="h-8 min-w-[220px] border rounded px-2 text-sm"
        placeholder="Grid title"
        value={title ?? ""}
        onChange={(e) => onTitleChange?.(e.target.value)}
        onBlur={() => onTitleBlur?.()}
      />
      <button className={`px-2 py-1 border rounded ${st.bold?"bg-gray-200":""}`} onClick={() => apply({ bold: !st.bold })}>B</button>
      <button className={`px-2 py-1 border rounded ${st.align==='left'?"bg-gray-200":""}`} onClick={() => apply({ align: 'left' })}>左</button>
      <button className={`px-2 py-1 border rounded ${st.align==='center'?"bg-gray-200":""}`} onClick={() => apply({ align: 'center' })}>中</button>
      <button className={`px-2 py-1 border rounded ${st.align==='right'?"bg-gray-200":""}`} onClick={() => apply({ align: 'right' })}>右</button>
      <select className="border rounded px-1 py-0.5" value={st.fontSize || 12} onChange={(e) => apply({ fontSize: Number(e.target.value) })}>
        {[10,11,12,13,14,16,18,20,24,28,32].map(s => <option key={s} value={s}>{s}px</option>)}
      </select>
      <label className="text-xs">字色</label><input type="color" value={st.color || '#111827'} onChange={(e) => apply({ color: e.target.value })} />
      <label className="text-xs">底色</label><input type="color" value={st.bg || '#ffffff'} onChange={(e) => apply({ bg: e.target.value })} />
      <button className="px-2 py-1 border rounded" onClick={() => {
        const store = useGridStore.getState();
        const s = getWS();
        const next = store.rows + 1;
        store.setSize(next, store.cols);
        s?.emit('grid:operation', { type: 'grid:dimension', gridId, sheetId, payload: { rows: next } });
      }}>+行</button>
      <button className="px-2 py-1 border rounded" onClick={() => {
        const store = useGridStore.getState();
        const s = getWS();
        const next = store.cols + 1;
        store.setSize(store.rows, next);
        s?.emit('grid:operation', { type: 'grid:dimension', gridId, sheetId, payload: { cols: next } });
      }}>+列</button>
      <div className="mx-2 h-5 w-px bg-gray-300" />
      <button className={`px-2 py-1 border rounded ${freezeTopRow?"bg-gray-200":""}`} onClick={() => toggleFreezeTopRow()}>{freezeTopRow?"取消冻结首行":"冻结首行"}</button>
      <button className={`px-2 py-1 border rounded ${freezeFirstCol?"bg-gray-200":""}`} onClick={() => toggleFreezeFirstCol()}>{freezeFirstCol?"取消冻结首列":"冻结首列"}</button>
    </div>
  );
}


