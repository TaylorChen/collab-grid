import React, { useState } from "react";
import { api } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useUserStore((s) => s.setAuth);
  const nav = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const emailTrim = (email || "").trim();
    const pwdTrim = (password || "").trim();
    if (!emailTrim) { setError("请输入邮箱"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) { setError("邮箱格式不正确"); return; }
    if (!pwdTrim) { setError("请输入密码"); return; }

    setError(null);
    setLoading(true);
    try {
      const res: any = await api.login({ email: emailTrim, password: pwdTrim });
      if (res?.success) {
        setAuth(res.data.token, res.data.user);
        nav("/");
      } else {
        setError("登录失败，请检查邮箱或密码");
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg === "401") setError("邮箱或密码错误");
      else if (msg === "400") setError("请求参数有误");
      else setError(`登录失败(${msg || "网络错误"})`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center">
      <form className="w-full max-w-sm space-y-3" onSubmit={handleLogin}>
        <h1 className="text-xl font-semibold">登录</h1>
        <input className="border rounded w-full p-2" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="border rounded w-full p-2" placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-60" type="submit" disabled={loading}>{loading ? "登录中..." : "登录"}</button>
      </form>
    </div>
  );
}

