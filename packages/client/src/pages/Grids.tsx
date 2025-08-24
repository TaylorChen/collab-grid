import React, { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useUserStore } from "@/stores/userStore";

export default function Grids() {
  const token = useUserStore((s) => s.token);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!token) return;
    const res: any = await api.listGrids(token);
    if (res?.success) setItems(res.data);
  }

  async function create() {
    setError(null);
    if (!token) { setError("未登录或凭证失效"); return; }
    const t = title.trim();
    if (!t) { setError("请输入表格标题"); return; }
    setLoading(true);
    try {
      const res: any = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/grids/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: t, name: t })
      }).then((r) => r.json());
      if (res?.success) {
        setTitle("");
        await refresh();
        // 跳转到新建表格
        try {
          if (res.data?.id) {
            window.location.href = `/grid/${res.data.public_id || res.data.id}`;
          }
        } catch {}
      } else {
        setError("创建失败");
      }
    } catch (e: any) {
      setError(`创建失败 (${e?.message || "网络错误"})`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [token]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex gap-2 items-start">
        <input className="border rounded p-2 flex-1" placeholder="新建表格标题" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? "bg-green-400 cursor-not-allowed" : "bg-green-600"}`} onClick={create}>{loading ? "创建中..." : "创建"}</button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <ul className="space-y-2">
        {items.map((g) => (
          <li key={g.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{g.title}</div>
              <div className="text-gray-500 text-sm">#{g.id} · 创建: {new Date(g.created_at).toLocaleString()} · 最近: {g.last_modified ? new Date(g.last_modified).toLocaleString() : "-"} · 最近编辑: {g.last_editor || "-"}</div>
            </div>
            <div className="flex gap-3 items-center">
              <a className="text-blue-600" href={`/grid/${g.public_id || g.id}`}>打开</a>
              {g.is_owner ? (
                <button className="text-red-600" onClick={async () => {
                  if (!token) return;
                  await api.deleteGrid(token, g.id).catch(()=>{});
                  refresh();
                }}>删除</button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

