'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const ToastProvider = React.createContext<{
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

export function ToastProviderComponent({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { ...toast, id }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastProvider.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'rounded-lg border px-4 py-3 shadow-lg transition-all',
              'bg-background text-foreground',
              toast.variant === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground'
            )}
          >
            {toast.title && <div className="font-semibold">{toast.title}</div>}
            {toast.description && <div className="text-sm opacity-90">{toast.description}</div>}
          </div>
        ))}
      </div>
    </ToastProvider.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastProvider);
  if (!context) {
    // Return a mock implementation for server-side rendering
    return {
      toast: (props: Omit<Toast, 'id'>) => {
        console.log('Toast:', props);
      },
      toasts: [],
    };
  }
  
  return {
    toast: (props: Omit<Toast, 'id'>) => {
      context.addToast(props);
    },
    toasts: context.toasts,
  };
}
