import { create } from 'zustand';
export const useToastStore = create((set, get) => ({
    toasts: [],
    addToast: (message, type = 'info', duration = 3000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        const toast = { id, message, type, duration };
        set((state) => ({
            toasts: [...state.toasts, toast]
        }));
        return id;
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter(toast => toast.id !== id)
        }));
    },
    clearToasts: () => {
        set({ toasts: [] });
    }
}));
// 便捷的全局函数
export const toast = {
    info: (message, duration) => useToastStore.getState().addToast(message, 'info', duration),
    success: (message, duration) => useToastStore.getState().addToast(message, 'success', duration),
    warning: (message, duration) => useToastStore.getState().addToast(message, 'warning', duration),
    error: (message, duration) => useToastStore.getState().addToast(message, 'error', duration),
};
