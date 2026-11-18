"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaEscalable } from "@/components/ListaEscalable";
import { useToast } from "@/components/Toast";
import { definirCoberturaEnGrupo } from "@/app/(app)/esquila/actions";
import type { OvejaEsquila } from "@/lib/esquila-servidor";

/**
 * Las ovejas «por definir» (criollas, cruces o sin raza): se elige un grupo y se marcan de lana o de pelo de una vez, sin entrar a la ficha de cada una.
 * Las que se marcan de lana pasan a «Por esquilar» y las de pelo dejan de aparecer como pendientes.
 */
export function DefinirCobertura({ ovejas }: { ovejas: OvejaEsquila[] }) {
  const router = useRouter();
  const toast = useToast();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [cual, setCual] = useState<"lana" | "pelo" | null>(null);

  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: ovejas.slice(desde, desde + cantidad), total: ovejas.length }), [ovejas]);
  const alternar = (id: string) =>
    setElegidas((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const definir = (cobertura: "lana" | "pelo") => {
    setError(null);
    setCual(cobertura);
    iniciar(async () => {
      const r = await definirCoberturaEnGrupo([...elegidas], cobertura);
      if (!r.ok) return setError(r.error);
      toast.exito(`${r.n} ${r.n === 1 ? "oveja marcada" : "ovejas marcadas"} como de ${cobertura === "lana" ? "lana" : "pelo"}`);
      setElegidas(new Set());
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <Aviso tipo="info">Elige las ovejas y dinos si son de lana o de pelo. Solo las de lana se esquilan.</Aviso>
      <FilaDesplazable>
        <Chip activo={false} onClick={() => setElegidas(new Set(ovejas.map((o) => o.id)))}>
          Elegir todas · {ovejas.length}
        </Chip>
        <Chip activo={false} onClick={() => setElegidas(new Set())}>
          Quitar la elección
        </Chip>
      </FilaDesplazable>
      <ListaEscalable<OvejaEsquila>
        cargar={cargar}
        clave={(o) => o.id}
        vacio={<p className="px-2 py-8 text-center text-[0.9375rem] text-humo">No hay ovejas por definir.</p>}
        fila={(o) => {
          const activa = elegidas.has(o.id);
          return (
            <button
              type="button"
              aria-pressed={activa}
              onClick={() => alternar(o.id)}
              className={`flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl bg-papel px-4 py-3 text-left ring-1 transition ${activa ? "ring-2 ring-musgo" : "ring-arena"}`}
            >
              <span className={`grid size-6 shrink-0 place-items-center rounded-md ring-1 ${activa ? "bg-musgo text-sobre-musgo ring-musgo" : "bg-papel ring-arena"}`}>
                {activa ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">
                {o.numero_arete}
                {o.nombre ? <span className="font-normal text-humo"> · {o.nombre}</span> : null}
              </span>
            </button>
          );
        }}
      />
      {elegidas.size === 0 ? <Aviso tipo="atencion">Elige al menos una oveja: llevas 0 de 1 mínima.</Aviso> : <Aviso tipo="info">{elegidas.size} {elegidas.size === 1 ? "oveja elegida" : "ovejas elegidas"}.</Aviso>}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Boton onClick={() => definir("lana")} disabled={elegidas.size === 0 || pendiente} pendiente={pendiente && cual === "lana"} cargando="Guardando…">
          Son de lana
        </Boton>
        <Boton variante="secundario" onClick={() => definir("pelo")} disabled={elegidas.size === 0 || pendiente} pendiente={pendiente && cual === "pelo"} cargando="Guardando…">
          Son de pelo
        </Boton>
      </div>
    </div>
  );
}
