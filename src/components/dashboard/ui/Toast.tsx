"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        success: (message) => addToast("success", message),
        error: (message) => addToast("error", message),
        warning: (message) => addToast("warning", message),
        info: (message) => addToast("info", message),
        dismiss,
      }}
    >
      {children}
      <div className="fixed bottom-4 right-4 z-[800] flex flex-col gap-2" role="region" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: "bg-green-900/90 border-green-700 text-green-100",
    error: "bg-red-900/90 border-red-700 text-red-100",
    warning: "bg-yellow-900/90 border-yellow-700 text-yellow-100",
    info: "bg-blue-900/90 border-blue-700 text-blue-100",
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border shadow-lg min-w-[300px] max-w-md animate-in slide-in-from-right-full duration-300",
        colors[toast.type]
      )}
      role="alert"
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-current/70 hover:text-current transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export const toast = {
  success: (message: string) => console.log("toast.success:", message),
  error: (message: string) => console.log("toast.error:", message),
  warning: (message: string) => console.log("toast.warning:", message),
  info: (message: string) => console.log("toast.info:", message),
};