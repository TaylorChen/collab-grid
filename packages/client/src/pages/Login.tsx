import React, { useState } from "react";
import { api } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const setAuth = useUserStore((s) => s.setAuth);
  const nav = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res: any = await api.login({ email, password });
    if (res?.success) {
      setAuth(res.data.token, res.data.user);
      nav("/");
    }
  }

  return (
    <div className="h-full flex items-center justify-center">
      <form className="w-full max-w-sm space-y-3" onSubmit={handleLogin}>
        <h1 className="text-xl font-semibold">登录</h1>
        <input className="border rounded w-full p-2" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border rounded w-full p-2" placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full" type="submit">登录</button>
      </form>
    </div>
  );
}

