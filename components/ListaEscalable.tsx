"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { EsqueletoFilas } from "@/components/Cargando";
import { Boton } from "@/components/Boton";

/**
 * Lista pensada para crecer a cientos o miles de filas: carga por tramos de 20 al llegar al final,
 * contador «Mostrando X de N» y botón «Arriba». Para reiniciar al buscar o filtrar, cambia su `key`.
 * El servidor pagina (PostgREST corta cada respuesta en 1000), así que nunca se dibuja todo de una vez.
 */
export function ListaEscalable<T>({
  cargar,
  fila,
  clave,
  vacio,
  tramo = 20,
  rejilla = "grid-cols-1",
}: {
  cargar: (desde: number, cantidad: number) => Promise<{ filas: T[]; total: number }>;
  fila: (item: T) => React.ReactNode;
  clave: (item: T) => string;
  vacio: React.ReactNode;
  tramo?: number;
  /** Columnas de la rejilla. Empieza siempre con `grid-cols-1` (celular); en pantallas anchas puede abrir más. */
  rejilla?: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hayScroll, setHayScroll] = useState(false);
  const ocupado = useRef(false);
  const centinela = useRef<HTMLDivElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const cantidad = useRef(0);

  const siguiente = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setCargando(true);
    setError(null);
    try {
      const { filas, total: t } = await cargar(cantidad.current, tramo);
      cantidad.current += filas.length;
      setItems((previo) => [...previo, ...filas]);
      setTotal(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la lista.");
    } finally {
      ocupado.current = false;
      setCargando(false);
    }
  }, [cargar, tramo]);

  useEffect(() => {
    void siguiente();
  }, [siguiente]);

  const completo = total !== null && items.length >= total;

  useEffect(() => {
    const el = centinela.current;
    if (!el || completo || error) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting && cantidad.current > 0) void siguiente();
      },
      { rootMargin: "320px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [completo, error, siguiente, items.length]);

  useEffect(() => {
    const alScroll = () => setHayScroll(window.scrollY > 600 || (contenedor.current?.scrollTop ?? 0) > 400);
    window.addEventListener("scroll", alScroll, { passive: true });
    const c = contenedor.current;
    c?.addEventListener("scroll", alScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", alScroll);
      c?.removeEventListener("scroll", alScroll);
    };
  }, []);

  if (total === 0) return <>{vacio}</>;

  return (
    <div>
      {total !== null ? (
        <p className="mb-2 text-sm text-humo" aria-live="polite">
          Mostrando {items.length} de {total}
        </p>
      ) : null}
      <div ref={contenedor} className="lg:max-h-[640px] lg:overflow-y-auto">
        <ul className={`grid gap-2.5 ${rejilla}`}>
          {items.map((it) => (
            <li key={clave(it)} className="min-w-0">
              {fila(it)}
            </li>
          ))}
        </ul>
        {total === null && cargando ? <EsqueletoFilas filas={6} /> : null}
        {error ? (
          <div className="space-y-3 py-4">
            <Aviso tipo="error">{error}</Aviso>
            <Boton variante="secundario" onClick={() => void siguiente()}>
              Reintentar
            </Boton>
          </div>
        ) : null}
        {!completo && !error ? (
          <div ref={centinela} className="grid h-14 place-items-center text-sm text-humo">
            {cargando && total !== null ? <span className="anim-pulso">Cargando más…</span> : null}
          </div>
        ) : null}
      </div>
      {hayScroll ? (
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            contenedor.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tinta px-4 text-sm font-semibold text-lana shadow-lg"
        >
          <ArrowUp className="size-4" strokeWidth={2} /> Arriba
        </button>
      ) : null}
    </div>
  );
}
