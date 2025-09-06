import { jsx as _jsx } from "react/jsx-runtime";
import Toast from './Toast';
export default function ToastContainer({ toasts, onRemoveToast }) {
    return (_jsx("div", { className: "fixed top-0 right-0 z-[9999] pointer-events-none", children: _jsx("div", { className: "flex flex-col gap-2 p-4 pointer-events-auto", children: toasts.map((toast) => (_jsx(Toast, { ...toast, onClose: onRemoveToast }, toast.id))) }) }));
}
