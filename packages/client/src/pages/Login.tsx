import React, { useState } from "react";
import { api } from "@/services/api";
import { useUserStore } from "@/stores/userStore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useUserStore((s) => s.setAuth);
  const nav = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const emailTrim = (email || "").trim();
    const pwdTrim = (password || "").trim();
    const nameTrim = (displayName || "").trim();
    if (!emailTrim) { setError("请输入邮箱"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) { setError("邮箱格式不正确"); return; }
    if (!pwdTrim) { setError("请输入密码"); return; }
    if (mode === "register" && !nameTrim) { setError("请输入昵称"); return; }
    if (mode === "register") {
      const local = emailTrim.split("@")[0] || "";
      const tooShort = pwdTrim.length < 8 || pwdTrim.length > 128;
      const hasLower = /[a-z]/.test(pwdTrim);
      const hasUpper = /[A-Z]/.test(pwdTrim);
      const hasDigit = /\d/.test(pwdTrim);
      const hasSymbol = /[^\w\s]/.test(pwdTrim);
      const hasSpace = /\s/.test(pwdTrim);
      const containsName = nameTrim && pwdTrim.toLowerCase().includes(nameTrim.toLowerCase());
      const containsLocal = local && pwdTrim.toLowerCase().includes(local.toLowerCase());
      if (tooShort || hasSpace || !hasLower || !hasUpper || !hasDigit || !hasSymbol || containsName || containsLocal) {
        setError("密码太弱：至少8位，含大小写字母、数字、符号，不含空格，且不能包含昵称或邮箱名");
        return;
      }
    }

    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res: any = await api.login({ email: emailTrim, password: pwdTrim });
        if (res?.success) {
          setAuth(res.data.token, res.data.user);
          nav("/");
        } else {
          setError("登录失败，请检查邮箱或密码");
        }
      } else {
        const res: any = await api.register({ email: emailTrim, password: pwdTrim, displayName: nameTrim });
        if (res?.success) {
          setAuth(res.data.token, res.data.user);
          nav("/");
        } else {
          setError("注册失败，请稍后再试");
        }
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (mode === "login") {
        if (msg === "401") setError("邮箱或密码错误");
        else if (msg === "400") setError("请求参数有误");
        else setError(`登录失败(${msg || "网络错误"})`);
      } else {
        if (msg === "409") setError("该邮箱已被注册");
        else if (msg === "400") setError("请求参数有误");
        else setError(`注册失败(${msg || "网络错误"})`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center">
      <form className="w-full max-w-sm space-y-3" onSubmit={handleLogin}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{mode === "login" ? "登录" : "注册"}</h1>
          <button
            type="button"
            className="text-sm text-blue-600"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          >{mode === "login" ? "没有账号？注册" : "已有账号？登录"}</button>
        </div>
        <input className="border rounded w-full p-2" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === "register" && (
          <input className="border rounded w-full p-2" placeholder="昵称" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        )}
        <input className="border rounded w-full p-2" placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-60" type="submit" disabled={loading}>
          {loading ? (mode === "login" ? "登录中..." : "注册中...") : (mode === "login" ? "登录" : "注册")}
        </button>
      </form>
    </div>
  );
}

