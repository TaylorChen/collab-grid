import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import Grids from "@/pages/Grids";
import GridEditor from "@/pages/GridEditor";
import { useUserStore } from "@/stores/userStore";
import Header from "@/components/Header";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const token = useUserStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Grids /></RequireAuth>} />
        <Route path="/grid/:id" element={<RequireAuth><GridEditor /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}

