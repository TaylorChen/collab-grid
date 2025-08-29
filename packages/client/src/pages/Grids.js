import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
export default function Grids() {
    const token = useUserStore((s) => s.token);
    const [title, setTitle] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    async function refresh() {
        if (!token)
            return;
        const res = await api.listGrids(token);
        if (res?.success)
            setItems(res.data);
    }
    async function create() {
        setError(null);
        if (!token) {
            setError("未登录或凭证失效");
            return;
        }
        const t = title.trim();
        if (!t) {
            setError("请输入表格标题");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/grids/`, {
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
                }
                catch { }
            }
            else {
                setError("创建失败");
            }
        }
        catch (e) {
            setError(`创建失败 (${e?.message || "网络错误"})`);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { refresh(); }, [token]);
    return (_jsxs("div", { className: "max-w-3xl mx-auto p-6 space-y-4", children: [_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("input", { className: "border rounded p-2 flex-1", placeholder: "\u65B0\u5EFA\u8868\u683C\u6807\u9898", value: title, onChange: (e) => setTitle(e.target.value) }), _jsx("button", { disabled: loading, className: `px-4 py-2 rounded text-white ${loading ? "bg-green-400 cursor-not-allowed" : "bg-green-600"}`, onClick: create, children: loading ? "创建中..." : "创建" })] }), error && _jsx("div", { className: "text-red-600 text-sm", children: error }), _jsx("ul", { className: "space-y-2", children: items.map((g) => (_jsxs("li", { className: "border rounded p-3 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: g.title }), _jsxs("div", { className: "text-gray-500 text-sm", children: ["#", g.id, " \u00B7 \u521B\u5EFA: ", new Date(g.created_at).toLocaleString(), " \u00B7 \u6700\u8FD1: ", g.last_modified ? new Date(g.last_modified).toLocaleString() : "-", " \u00B7 \u6700\u8FD1\u7F16\u8F91: ", g.last_editor || "-"] })] }), _jsxs("div", { className: "flex gap-3 items-center", children: [_jsx("a", { className: "text-blue-600", href: `/grid/${g.public_id || g.id}`, children: "\u6253\u5F00" }), g.is_owner ? (_jsx("button", { className: "text-red-600", onClick: async () => {
                                        if (!token)
                                            return;
                                        await api.deleteGrid(token, g.id).catch(() => { });
                                        refresh();
                                    }, children: "\u5220\u9664" })) : null] })] }, g.id))) })] }));
}
