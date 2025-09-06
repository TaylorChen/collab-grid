import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import Grids from "@/pages/Grids";
import GridEditor from "@/pages/GridEditor";
import { useUserStore } from "@/stores/userStore";
import Header from "@/components/Header";
function RequireAuth({ children }) {
    const token = useUserStore((s) => s.token);
    if (!token)
        return _jsx(Navigate, { to: "/login", replace: true });
    return children;
}
export default function App() {
    return (_jsxs(BrowserRouter, { children: [_jsx(Header, {}), _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/", element: _jsx(RequireAuth, { children: _jsx(Grids, {}) }) }), _jsx(Route, { path: "/grid/:id", element: _jsx(RequireAuth, { children: _jsx(GridEditor, {}) }) })] })] }));
}
