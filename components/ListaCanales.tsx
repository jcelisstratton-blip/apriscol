"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Pencil, Scissors } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { ETIQUETA_CONFORMACION, kg, pctUno } from "@/lib/carne";
import { formatoFecha } from "@/lib/fechas";
import type { CanalVista } from "@/lib/tipos";

type FilaCanal = CanalVista & { animal?: { numero_arete: string; nombre: string | null } };

/** Las canales de los animales sacrificados, con su rendimiento. Se registran desde la ficha del animal (Salida del hato). */
export function ListaCanales({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("v_canales").select("*", { count: "exact" }).eq("finca_id", fincaId);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const ids = (animales ?? []).map((a) => a.id);
        if (ids.length === 0) return { filas: [] as FilaCanal[], total: 0 };
        q = q.in("animal_id", ids);
      }
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaCanal[];
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
      <ListaEscalable<FilaCanal>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={busqueda}
        cargar={cargar}
        clave={(c) => c.id}
        fila={(c) => (
          <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <Link href={`/hato/${c.animal_id}#salida`} className="block min-w-0 flex-1">
              <span className="block font-bold [overflow-wrap:anywhere]">{c.animal ? etiquetaAnimal(c.animal) : "Animal"}</span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                {formatoFecha(c.fecha, { day: "numeric", month: "short", year: "numeric" })}
                {c.planta ? ` · ${c.planta}` : ""}
              </span>
              <span className="mt-1 block text-sm [overflow-wrap:anywhere]">
                Canal {kg(c.peso_canal_caliente_kg)}
                {c.peso_vivo_kg != null ? ` de ${kg(c.peso_vivo_kg)} en vivo` : ""}
              </span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {c.rendimiento_caliente_pct != null ? <Insignia tono="musgo">{`Rendimiento ${pctUno(c.rendimiento_caliente_pct)}`}</Insignia> : null}
                {c.conformacion ? <Insignia>{ETIQUETA_CONFORMACION[c.conformacion]}</Insignia> : null}
              </span>
            </Link>
            {puedeEditar ? (
              <Link href={`/carne/canales/${c.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        )}
        vacio={
          busqueda ? (
            <EstadoVacio icono={<Scissors strokeWidth={1.5} />} titulo="Ninguna canal coincide" descripcion="Prueba con otro arete o nombre." />
          ) : (
            <EstadoVacio icono={<Scissors strokeWidth={1.5} />} titulo="Aún no hay canales" descripcion="Cuando sacrifiques un animal, registra su canal desde su ficha (Salida del hato) para conocer su rendimiento." />
          )
        }
      />
    </div>
  );
}
