import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useUserStore } from "@/stores/userStore";
import { useNavigate } from "react-router-dom";
export default function Header() {
    const nav = useNavigate();
    const token = useUserStore((s) => s.token);
    const user = useUserStore((s) => s.user);
    const setAuth = useUserStore((s) => s.setAuth);
    const logout = useUserStore((s) => s.logout);
    async function changeDisplayName() {
        const displayName = prompt("输入新的昵称", user?.displayName || "");
        if (!displayName || !displayName.trim() || !token)
            return;
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/auth/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ displayName: displayName.trim() })
        }).then((r) => r.json()).catch(() => null);
        if (res?.success)
            setAuth(res.data.token, res.data.user);
    }
    async function changePassword() {
        const currentPassword = prompt("输入当前密码");
        if (!currentPassword || !token)
            return;
        const newPassword = prompt("输入新密码（至少6位）");
        if (!newPassword || newPassword.length < 6)
            return;
        await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/auth/change-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ currentPassword, newPassword })
        });
    }
    return (_jsx("div", { className: "w-full border-b bg-white", children: _jsxs("div", { className: "max-w-6xl mx-auto px-4 py-3 flex items-center justify-between", children: [_jsx("a", { href: "/", className: "font-semibold", children: "CollabGrid" }), _jsx("div", { className: "flex items-center gap-3", children: user ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-sm text-gray-700", children: [user.displayName, " (", user.email, ")"] }), _jsx("button", { className: "text-blue-600 text-sm", onClick: changeDisplayName, children: "\u6539\u6635\u79F0" }), _jsx("button", { className: "text-blue-600 text-sm", onClick: changePassword, children: "\u6539\u5BC6\u7801" }), _jsx("button", { className: "text-red-600 text-sm", onClick: () => { logout(); nav("/login"); }, children: "\u9000\u51FA" })] })) : (_jsx("button", { className: "text-blue-600 text-sm", onClick: () => nav("/login"), children: "\u767B\u5F55" })) })] }) }));
}
