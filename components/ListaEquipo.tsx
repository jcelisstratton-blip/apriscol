"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Pencil, Wrench } from "lucide-react";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_MANTENIMIENTO } from "@/lib/leche-calidad";
import type { MantenimientoOrdeno } from "@/lib/tipos";

/** Lavados, presión de vacío, pulsadores y revisiones del equipo de ordeño, del más reciente al más antiguo. */
export function ListaEquipo({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      const { data, count, error } = await supabase
        .from("mantenimiento_ordeno")
        .select("*", { count: "exact" })
        .eq("finca_id", fincaId)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as MantenimientoOrdeno[], total: count ?? 0 };
    },
    [fincaId],
  );

  return (
    <ListaEscalable<MantenimientoOrdeno>
      rejilla="grid-cols-1 lg:grid-cols-2"
      cargar={cargar}
      clave={(m) => m.id}
      fila={(m) => (
        <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
          <div className="min-w-0 flex-1">
            <span className="block font-bold [overflow-wrap:anywhere]">
              {ETIQUETA_MANTENIMIENTO[m.tipo]}
              {m.presion_kpa != null ? ` · ${m.presion_kpa.toLocaleString("es-CO")} kPa` : ""}
            </span>
            <span className="block text-sm text-humo [overflow-wrap:anywhere]">
              {formatoFecha(m.fecha, { day: "numeric", month: "short", year: "numeric" })}
              {m.equipo ? ` · ${m.equipo}` : ""}
              {m.responsable ? ` · ${m.responsable}` : ""}
            </span>
            {m.proxima_fecha ? <span className="block text-sm text-humo">Próxima vez: {formatoFecha(m.proxima_fecha, { day: "numeric", month: "short" })}</span> : null}
          </div>
          {puedeEditar ? (
            <Link href={`/leche/equipo/${m.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
            </Link>
          ) : null}
        </div>
      )}
      vacio={<EstadoVacio icono={<Wrench strokeWidth={1.5} />} titulo="Aún no hay registros del equipo" descripcion="Anota los lavados, la presión de vacío y las revisiones de la ordeñadora para llevar su mantenimiento al día." />}
    />
  );
}
