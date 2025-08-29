import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CanvasGrid from "@/components/Grid/CanvasGrid";
import { useRealtime } from "@/hooks/useRealtime";
export default function Home() {
    useRealtime("demo");
    return (_jsxs("div", { className: "max-w-5xl mx-auto p-6", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsx("h2", { className: "text-xl font-semibold", children: "Demo Grid" }) }), _jsx(CanvasGrid, {})] }));
}
