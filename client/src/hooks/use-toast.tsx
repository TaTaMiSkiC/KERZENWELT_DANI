// ✅ Novi Toast kontekst baziran na React Context API
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 5000;

export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, "id">;

interface ToastContextType {
  toasts: ToasterToast[];
  toast: (props: Toast) => {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  };
  dismiss: (id?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToasterToast[]>([]);

  const addToast = (
    props: Toast,
  ): {
    id: string;
    dismiss: () => void;
    update: (props: ToasterToast) => void;
  } => {
    const id = Date.now().toString();

    const toast: ToasterToast = {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss(id);
      },
    };

    setToasts((prev) => [toast, ...prev].slice(0, TOAST_LIMIT));

    const timeout = setTimeout(() => {
      dismiss(id);
    }, TOAST_REMOVE_DELAY);

    return {
      id,
      dismiss: () => {
        clearTimeout(timeout);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      },
      update: (updated) => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updated } : t)),
        );
      },
    };
  };

  const dismiss = (id?: string) => {
    if (id) {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
      );
    } else {
      setToasts((prev) => prev.map((t) => ({ ...t, open: false })));
    }
  };

  return (
    <ToastContext.Provider value={{ toasts, toast: addToast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return context;
};
