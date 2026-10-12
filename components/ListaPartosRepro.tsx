"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Baby, Pencil } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_PARTO } from "@/lib/reproduccion";
import type { Parto } from "@/lib/tipos";

type FilaParto = Parto & { madre?: { numero_arete: string; nombre: string | null } };

/** Todos los partos de la finca (y abortos), del más reciente al más antiguo. Se registran desde la ficha de cada hembra. */
export function ListaPartosRepro({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("partos").select("*", { count: "exact" }).eq("finca_id", fincaId);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const ids = (animales ?? []).map((a) => a.id);
        if (ids.length === 0) return { filas: [] as FilaParto[], total: 0 };
        q = q.in("madre_id", ids);
      }
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaParto[];
      if (filas.length) {
        const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", [...new Set(filas.map((f) => f.madre_id))]);
        const porId = new Map((animales ?? []).map((a) => [a.id, a]));
        for (const f of filas) f.madre = porId.get(f.madre_id);
      }
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda],
  );

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" />
      <ListaEscalable<FilaParto>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={busqueda}
        cargar={cargar}
        clave={(p) => p.id}
        fila={(p) => (
          <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <Link href={`/hato/${p.madre_id}#reproduccion`} className="block min-w-0 flex-1">
              <span className="block font-bold [overflow-wrap:anywhere]">{p.madre ? etiquetaAnimal(p.madre) : "Hembra"}</span>
              <span className="block text-sm text-humo">{formatoFecha(p.fecha, { day: "numeric", month: "short", year: "numeric" })}</span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <Insignia tono={p.tipo === "aborto" ? "alerta" : p.tipo === "normal" ? "musgo" : "aviso"}>{ETIQUETA_PARTO[p.tipo]}</Insignia>
                {p.tipo !== "aborto" ? <Insignia>{`${p.numero_crias} ${p.numero_crias === 1 ? "cría" : "crías"}`}</Insignia> : null}
              </span>
            </Link>
            {puedeEditar ? (
              <Link href={`/reproduccion/partos/${p.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        )}
        vacio={
          busqueda ? (
            <EstadoVacio icono={<Baby strokeWidth={1.5} />} titulo="Ningún parto coincide" descripcion="Prueba con otro arete o nombre." />
          ) : (
            <EstadoVacio icono={<Baby strokeWidth={1.5} />} titulo="Aún no hay partos" descripcion="Los partos se registran desde la ficha de cada hembra, con sus crías, y aquí queda el compendio." />
          )
        }
      />
    </div>
  );
}
