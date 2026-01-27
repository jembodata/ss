"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { ToastNotification } from "@carbon/react";

type ToastKind = "success" | "error" | "info";
type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  subtitle?: string;
};
type ToastContextValue = {
  push: (kind: ToastKind, title: string, subtitle?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const value = useMemo<ToastContextValue>(() => {
    return {
      push: (kind, title, subtitle) => {
        const id = `${Date.now()}-${Math.random()}`;
        setItems((prev) => [...prev, { id, kind, title, subtitle }]);
      }
    };
  }, []);

  function remove(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-6 top-16 z-50 space-y-2">
        {items.map((n) => (
          <ToastNotification
            key={n.id}
            kind={n.kind}
            lowContrast
            title={n.title}
            subtitle={n.subtitle}
            timeout={5000}
            onCloseButtonClick={() => remove(n.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
