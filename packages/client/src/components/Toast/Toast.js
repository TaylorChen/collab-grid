import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
export default function Toast({ id, message, type = 'info', duration = 3000, onClose }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);
        return () => clearTimeout(timer);
    }, [id, duration, onClose]);
    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'warning':
                return 'bg-orange-50 border-orange-200 text-orange-800';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            default:
                return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };
    const getIcon = () => {
        switch (type) {
            case 'success':
                return '✅';
            case 'warning':
                return '⚠️';
            case 'error':
                return '❌';
            default:
                return 'ℹ️';
        }
    };
    return (_jsx("div", { className: `
      fixed top-4 right-4 z-[9999] 
      min-w-[300px] max-w-[400px] 
      p-4 rounded-lg border shadow-lg
      animate-in slide-in-from-right-5 duration-300
      ${getTypeStyles()}
    `, children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "text-lg flex-shrink-0", children: getIcon() }), _jsx("div", { className: "flex-1", children: _jsx("p", { className: "text-sm font-medium whitespace-pre-line", children: message }) }), _jsx("button", { onClick: () => onClose(id), className: "flex-shrink-0 text-lg hover:opacity-70 transition-opacity", children: "\u2715" })] }) }));
}
