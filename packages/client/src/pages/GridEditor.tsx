import React from "react";
import { useParams } from "react-router-dom";
import CanvasGrid from "@/components/Grid/CanvasGrid";
import { useRealtime } from "@/hooks/useRealtime";
import { useUserStore } from "@/stores/userStore";
import { connectWS } from "@/services/websocket";
import { api } from "@/services/api";
import FormatToolbar from "@/components/Toolbar/FormatToolbar";
import { useGridStore } from "@/stores/gridStore";

export default function GridEditor() {
  const { id } = useParams();
  const token = useUserStore((s) => s.token);
  const user = useUserStore((s) => s.user);
  const [title, setTitle] = React.useState<string>("Loading...");
  const [ownerId, setOwnerId] = React.useState<number | null>(null);
  const [sheets, setSheets] = React.useState<Array<{ id: number; name: string }>>([]);
  const [currentSheet, setCurrentSheet] = React.useState<number>(0);
  const [email, setEmail] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    connectWS(token || undefined);
  }, [token]);

  React.useEffect(() => {
    (async () => {
      try {
        if (!id || !token) return;
        const res: any = await api.getGrid(token, id);
        if (res?.success) {
          setTitle(res.data?.title || `#${id}`);
          setOwnerId(res.data?.owner_id ?? null);
          setSheets(res.data?.sheets || []);
          if (res.data?.sheets?.[0]?.id) setCurrentSheet(res.data.sheets[0].id);
        } else setTitle(`#${id}`);
      } catch {
        setTitle(`#${id}`);
      }
    })();
  }, [id, token]);

  useRealtime(id || "demo", currentSheet);

  // 切换激活 sheet 时，同步到 store，用于尺寸隔离
  React.useEffect(() => {
    if (currentSheet != null) {
      useGridStore.getState().setActiveSheet(currentSheet);
    }
  }, [currentSheet]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <FormatToolbar gridId={id || "demo"} sheetId={currentSheet} />
      <div className="flex items-center gap-2 mb-2">
        <input className="text-xl font-semibold border rounded px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={async () => {
          if (!token || !id) return;
          try { await api.renameGrid(token, id, title.trim() || "Untitled"); } catch {}
        }} />
        <button className="px-2 py-1 text-sm border rounded" onClick={async () => {
          if (!token || !id) return;
          const name = `Sheet${(sheets?.length || 0) + 1}`;
          const res: any = await api.createSheet(token, id, name);
          if (res?.success) {
            setSheets(res.data);
            if (res.data?.length) {
              const newId = res.data[res.data.length - 1].id;
              setCurrentSheet(newId);
              useGridStore.getState().setActiveSheet(newId);
            }
          }
        }}>新建Sheet</button>
      </div>
      <div className="flex gap-2 mb-2">
        {sheets.map((s) => (
          <div key={s.id} className="flex items-center gap-1">
            <button className={`px-3 py-1 rounded border ${currentSheet===s.id?"bg-blue-600 text-white":"bg-white"}`} onClick={() => setCurrentSheet(s.id)}>{s.name}</button>
            <button className="text-xs text-gray-600" onClick={async () => {
              const name = prompt("重命名 sheet", s.name) || s.name;
              if (!token || !id || !name.trim()) return;
              const res: any = await api.renameSheet(token, id, s.id, name.trim());
              if (res?.success) setSheets(res.data);
            }}>✎</button>
            <button className="text-red-600" onClick={async () => {
              if (!token || !id) return;
              await api.deleteSheet(token, id, s.id);
              const res: any = await api.listSheets(token, id);
              if (res?.success) {
                setSheets(res.data);
                if (res.data?.length && !res.data.find((x: any) => x.id === currentSheet)) {
                  setCurrentSheet(res.data[0].id);
                }
              }
            }}>×</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {ownerId && user?.id === ownerId ? (
        <>
        <input className="border rounded p-2" placeholder="邀请协作者邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={async () => {
          setMsg(null);
          const emailTrim = (email || "").trim();
          if (!emailTrim) { setMsg("请输入邮箱"); return; }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) { setMsg("邮箱格式不正确"); return; }
          try {
            const res: any = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/collab/share`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ gridId: id, email: emailTrim })
            }).then((r) => r.json());
            if (res?.success) setMsg("已邀请协作"); else setMsg("邀请失败");
          } catch (e: any) {
            setMsg(`邀请失败(${e?.message || "网络错误"})`);
          }
        }}>邀请</button>
        {msg && <div className="text-sm text-gray-600 self-center">{msg}</div>}
        </>
        ) : null}
      </div>
      <CanvasGrid gridId={id || "demo"} sheetId={currentSheet} />
    </div>
  );
}

