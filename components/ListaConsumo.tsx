"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Pencil, Wheat } from "lucide-react";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { formatoFecha } from "@/lib/fechas";
import { kg } from "@/lib/carne";
import { pesos } from "@/lib/leche-calidad";
import type { ConsumoLote } from "@/lib/tipos";

/** El alimento que ha comido un lote, del más reciente al más antiguo. */
export function ListaConsumo({ fincaId, loteId, puedeEditar }: { fincaId: string; loteId: string; puedeEditar: boolean }) {
  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const { data, count, error } = await crearClienteNavegador()
        .from("consumo_lote")
        .select("*", { count: "exact" })
        .eq("finca_id", fincaId)
        .eq("lote_id", loteId)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as ConsumoLote[], total: count ?? 0 };
    },
    [fincaId, loteId],
  );

  return (
    <ListaEscalable<ConsumoLote>
      rejilla="grid-cols-1 lg:grid-cols-2"
      cargar={cargar}
      clave={(c) => c.id}
      fila={(c) => (
        <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
          <div className="min-w-0 flex-1">
            <span className="block font-bold [overflow-wrap:anywhere]">
              {kg(c.kg_alimento)}
              {c.alimento ? ` · ${c.alimento}` : ""}
            </span>
            <span className="block text-sm text-humo">
              {formatoFecha(c.fecha, { day: "numeric", month: "short", year: "numeric" })}
              {c.costo != null ? ` · ${pesos(c.costo)}` : ""}
            </span>
          </div>
          {puedeEditar ? (
            <Link href={`/carne/consumo/${c.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
            </Link>
          ) : null}
        </div>
      )}
      vacio={<EstadoVacio icono={<Wheat strokeWidth={1.5} />} titulo="Aún no hay alimento registrado" descripcion="Anota cuánto alimento come el lote para calcular cuántos kilos necesita por cada kilo que gana." />}
    />
  );
}
