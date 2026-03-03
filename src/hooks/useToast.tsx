import { createContext, useContext, useMemo, useState } from "react";

export type ToastKind = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toasts: Toast[];
  pushToast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (message: string, kind: ToastKind = "info") => {
    const toast: Toast = { id: crypto.randomUUID(), message, kind };
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== toast.id));
    }, 3400);
  };

  const dismissToast = (id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  };

  const value = useMemo(
    () => ({
      toasts,
      pushToast,
      dismissToast
    }),
    [toasts]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
};
