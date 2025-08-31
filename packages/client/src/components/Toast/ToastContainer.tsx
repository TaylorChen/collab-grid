import React from 'react';
import Toast, { ToastProps } from './Toast';

interface ToastContainerProps {
  toasts: ToastProps[];
  onRemoveToast: (id: string) => void;
}

export default function ToastContainer({ toasts, onRemoveToast }: ToastContainerProps) {
  return (
    <div className="fixed top-0 right-0 z-[9999] pointer-events-none">
      <div className="flex flex-col gap-2 p-4 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={onRemoveToast}
          />
        ))}
      </div>
    </div>
  );
}
