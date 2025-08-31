import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type'], duration?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  
  addToast: (message: string, type: Toast['type'] = 'info', duration: number = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const toast: Toast = { id, message, type, duration };
    
    set((state) => ({
      toasts: [...state.toasts, toast]
    }));
    
    return id;
  },
  
  removeToast: (id: string) => {
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
  info: (message: string, duration?: number) => useToastStore.getState().addToast(message, 'info', duration),
  success: (message: string, duration?: number) => useToastStore.getState().addToast(message, 'success', duration),
  warning: (message: string, duration?: number) => useToastStore.getState().addToast(message, 'warning', duration),
  error: (message: string, duration?: number) => useToastStore.getState().addToast(message, 'error', duration),
};
