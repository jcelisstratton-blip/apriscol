"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Pencil, Scale } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { ETIQUETA_PESAJE, kg } from "@/lib/carne";
import { formatoFecha } from "@/lib/fechas";
import type { Pesaje } from "@/lib/tipos";

type FilaPesaje = Pesaje & { animal?: { numero_arete: string; nombre: string | null } };

/** Todos los pesos de la finca, del más reciente al más antiguo. Se registran desde Hato → Ceba o la ficha; aquí se consultan y corrigen. */
export function ListaPesajes({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("pesajes").select("*", { count: "exact" }).eq("finca_id", fincaId);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const ids = (animales ?? []).map((a) => a.id);
        // Sin animales que coincidan, no hay pesos que mostrar (una lista vacía en `in` no es válida).
        if (ids.length === 0) return { filas: [] as FilaPesaje[], total: 0 };
        q = q.in("animal_id", ids);
      }
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaPesaje[];
      if (filas.length) {
        const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", [...new Set(filas.map((f) => f.animal_id))]);
        const porId = new Map((animales ?? []).map((a) => [a.id, a]));
        for (const f of filas) f.animal = porId.get(f.animal_id);
      }
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda],
  );

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" />
      <ListaEscalable<FilaPesaje>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={busqueda}
        cargar={cargar}
        clave={(p) => p.id}
        fila={(p) => (
          <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <Link href={`/hato/${p.animal_id}#crecimiento`} className="block min-w-0 flex-1">
              <span className="block font-bold [overflow-wrap:anywhere]">{kg(p.peso_kg)}</span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">{p.animal ? etiquetaAnimal(p.animal) : "Animal"}</span>
              <span className="block text-sm text-humo">{formatoFecha(p.fecha, { day: "numeric", month: "short", year: "numeric" })}</span>
              {p.tipo !== "control" ? (
                <span className="mt-1.5 block">
                  <Insignia tono="musgo">{ETIQUETA_PESAJE[p.tipo]}</Insignia>
                </span>
              ) : null}
            </Link>
            {puedeEditar ? (
              <Link href={`/carne/pesajes/${p.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        )}
        vacio={
          busqueda ? (
            <EstadoVacio icono={<Scale strokeWidth={1.5} />} titulo="Ningún peso coincide" descripcion="Prueba con otro arete o nombre." />
          ) : (
            <EstadoVacio icono={<Scale strokeWidth={1.5} />} titulo="Aún no hay pesos" descripcion="Los pesos de tus animales quedan aquí. Se registran desde Hato → Ceba o desde la ficha de cada animal." />
          )
        }
      />
    </div>
  );
}
