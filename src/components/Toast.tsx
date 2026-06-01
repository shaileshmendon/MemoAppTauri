import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error:   (msg: string) => void;
  warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error:   () => {},
  warning: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = nextId++;
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const remove = useCallback((id: number) =>
    setToasts(t => t.filter(x => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{
      success: m => add("success", m),
      error:   m => add("error",   m),
      warning: m => add("warning", m),
    }}>
      {children}

      {/* Toast container — bottom right */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl text-sm max-w-sm pointer-events-auto
              animate-in slide-in-from-bottom-2 duration-200
              ${t.type === "success" ? "bg-green-900 text-green-100 border border-green-700" :
                t.type === "error"   ? "bg-red-900   text-red-100   border border-red-700"   :
                                       "bg-amber-900 text-amber-100 border border-amber-700"}`}>
            <span className="shrink-0 mt-0.5">
              {t.type === "success" ? <CheckCircle2 size={16} /> :
               t.type === "error"   ? <XCircle      size={16} /> :
                                      <AlertCircle  size={16} />}
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => remove(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
