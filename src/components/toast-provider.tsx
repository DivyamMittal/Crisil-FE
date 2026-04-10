import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { showToast, toastEventName, type ToastPayload } from "@/lib/toast";

type ToastItem = ToastPayload & { id: number };

const ToastContext = createContext<{ push: (payload: ToastPayload) => void } | null>(null);

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = (payload: ToastPayload) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { ...payload, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  };

  useEffect(() => {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<ToastPayload>;
      push(custom.detail);
    };

    window.addEventListener(toastEventName, listener);
    return () => window.removeEventListener(toastEventName, listener);
  }, []);

  const value = useMemo(() => ({ push }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
};

export { showToast };

