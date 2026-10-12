"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Pencil, Thermometer } from "lucide-react";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { formatoFecha } from "@/lib/fechas";
import { estadoTemperatura, ETIQUETA_MOMENTO_FRIO } from "@/lib/leche-calidad";
import type { ControlFrio } from "@/lib/tipos";

/** Mediciones de temperatura de la leche (cadena de frío), de la más reciente a la más antigua. */
export function ListaFrio({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      const { data, count, error } = await supabase
        .from("controles_frio")
        .select("*", { count: "exact" })
        .eq("finca_id", fincaId)
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as ControlFrio[], total: count ?? 0 };
    },
    [fincaId],
  );

  return (
    <ListaEscalable<ControlFrio>
      rejilla="grid-cols-1 lg:grid-cols-2"
      cargar={cargar}
      clave={(c) => c.id}
      fila={(c) => {
        const estado = estadoTemperatura(c.temperatura_c);
        return (
          <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <div className="min-w-0 flex-1">
              <span className="block font-bold tabular-nums">{c.temperatura_c.toLocaleString("es-CO")} °C</span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                {formatoFecha(c.fecha, { day: "numeric", month: "short", year: "numeric" })}
                {c.hora ? ` · ${c.hora.slice(0, 5)}` : ""} · {ETIQUETA_MOMENTO_FRIO[c.momento]}
                {c.equipo ? ` · ${c.equipo}` : ""}
              </span>
              <span className="mt-1.5 block">
                <Insignia tono={estado.tono}>{estado.texto}</Insignia>
              </span>
            </div>
            {puedeEditar ? (
              <Link href={`/leche/frio/${c.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        );
      }}
      vacio={<EstadoVacio icono={<Thermometer strokeWidth={1.5} />} titulo="Aún no hay mediciones" descripcion="Anota la temperatura de la leche después del ordeño y en el tanque para vigilar que se mantenga entre 4 y 6 °C." />}
    />
  );
}
