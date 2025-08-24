import React from "react";
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
    if (!displayName || !displayName.trim() || !token) return;
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ displayName: displayName.trim() })
    }).then((r) => r.json()).catch(() => null);
    if (res?.success) setAuth(res.data.token, res.data.user);
  }

  async function changePassword() {
    const currentPassword = prompt("输入当前密码");
    if (!currentPassword || !token) return;
    const newPassword = prompt("输入新密码（至少6位）");
    if (!newPassword || newPassword.length < 6) return;
    await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  return (
    <div className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="font-semibold">CollabGrid</a>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">{user.displayName} ({user.email})</span>
              <button className="text-blue-600 text-sm" onClick={changeDisplayName}>改昵称</button>
              <button className="text-blue-600 text-sm" onClick={changePassword}>改密码</button>
              <button className="text-red-600 text-sm" onClick={() => { logout(); nav("/login"); }}>退出</button>
            </div>
          ) : (
            <button className="text-blue-600 text-sm" onClick={() => nav("/login")}>登录</button>
          )}
        </div>
      </div>
    </div>
  );
}


