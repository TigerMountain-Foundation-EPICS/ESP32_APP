import { X } from "lucide-react";
import { useToast } from "../../hooks/useToast";

const kindStyles = {
  info: "border-slate-200 bg-white text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800"
};

export const ToastViewport = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto flex max-w-md flex-col gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center justify-between rounded-xl border px-3 py-2 text-sm shadow-card ${kindStyles[toast.kind]}`}
          role="status"
        >
          <span>{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="rounded p-1 transition hover:bg-black/5"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
