import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import Grids from "@/pages/Grids";
import GridEditor from "@/pages/GridEditor";
// MergeTest 已移除
import { useUserStore } from "@/stores/userStore";
import Header from "@/components/Header";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const token = useUserStore((s) => s.token);
  const setAuth = useUserStore((s) => s.setAuth);
  
  console.log('🔐 RequireAuth 检查:', { hasToken: !!token });
  
  // 如果没有token，创建一个demo token
  if (!token) {
    console.log('❌ 未登录，创建demo token');
    const demoToken = 'demo-token-' + Date.now();
    const demoUser = {
      id: 1,
      email: 'demo@example.com',
      displayName: 'Demo User'
    };
    setAuth(demoToken, demoUser);
    console.log('✅ Demo登录成功');
  }
  
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* MergeTest 路由已移除 */}
        <Route path="/" element={<RequireAuth><Grids /></RequireAuth>} />
        <Route path="/grid/:id" element={<RequireAuth><GridEditor /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}

