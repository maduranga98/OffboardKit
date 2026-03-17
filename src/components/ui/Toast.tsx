import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import clsx from "clsx";

type ToastType = "success" | "error" | "info";

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const styleMap = {
  success: "border-teal bg-teal/5",
  error: "border-ember bg-ember/5",
  info: "border-navy bg-navy/5",
};

const iconColorMap = {
  success: "text-teal",
  error: "text-ember",
  info: "text-navy",
};

let toastListeners: ((toast: ToastData) => void)[] = [];

export function showToast(type: ToastType, title: string, message?: string) {
  const toast: ToastData = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
  };
  toastListeners.forEach((listener) => listener(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const listener = (toast: ToastData) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={clsx(
              "flex items-start gap-3 p-4 bg-white rounded-lg shadow-card border-l-4 animate-[slideIn_0.2s_ease-out]",
              styleMap[toast.type]
            )}
          >
            <Icon size={20} className={iconColorMap[toast.type]} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy">{toast.title}</p>
              {toast.message && (
                <p className="text-sm text-mist mt-0.5">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-mist hover:text-navy"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
