"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, OctagonAlert } from "lucide-react";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

type Toast = { id: number; tipo: "exito" | "error"; texto: string };
type Api = { exito: (t: string) => void; error: (t: string) => void };

const Contexto = createContext<Api | null>(null);

export function ProveedorToasts({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const siguiente = useRef(1);

  const mostrar = useCallback((tipo: Toast["tipo"], texto: string) => {
    const id = siguiente.current++;
    setToasts((t) => [...t.slice(-2), { id, tipo, texto: tipo === "error" ? mensajeAmigable(texto) : texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === "error" ? 5000 : 2600);
  }, []);

  const api = useMemo<Api>(() => ({ exito: (t) => mostrar("exito", t), error: (t) => mostrar("error", t) }), [mostrar]);

  return (
    <Contexto value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-sube pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl bg-tinta px-4 py-3 text-[0.9375rem] font-medium text-lana shadow-lg"
          >
            {t.tipo === "exito" ? (
              <CheckCircle2 className="size-5 shrink-0 text-ok" strokeWidth={1.75} />
            ) : (
              <OctagonAlert className="size-5 shrink-0 text-rojo" strokeWidth={1.75} />
            )}
            <span className="min-w-0">{t.texto}</span>
          </div>
        ))}
      </div>
    </Contexto>
  );
}

export function useToast(): Api {
  const api = useContext(Contexto);
  if (!api) throw new Error("useToast debe usarse dentro de ProveedorToasts");
  return api;
}
