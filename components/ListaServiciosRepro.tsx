"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { HeartHandshake, Pencil } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_SERVICIO } from "@/lib/reproduccion";
import type { Servicio } from "@/lib/tipos";

type Corto = { numero_arete: string; nombre: string | null };
type FilaServicio = Servicio & { hembra?: Corto; macho?: Corto };

/** Todos los servicios de la finca, del más reciente al más antiguo. Se registran desde la ficha de cada hembra. */
export function ListaServiciosRepro({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("servicios").select("*", { count: "exact" }).eq("finca_id", fincaId);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const ids = (animales ?? []).map((a) => a.id);
        if (ids.length === 0) return { filas: [] as FilaServicio[], total: 0 };
        q = q.in("hembra_id", ids);
      }
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaServicio[];
      const ids = [...new Set(filas.flatMap((f) => [f.hembra_id, f.macho_id]).filter((i): i is string => Boolean(i)))];
      if (ids.length) {
        const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", ids);
        const porId = new Map((animales ?? []).map((a) => [a.id, a]));
        for (const f of filas) {
          f.hembra = porId.get(f.hembra_id);
          if (f.macho_id) f.macho = porId.get(f.macho_id);
        }
      }
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda],
  );

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" />
      <ListaEscalable<FilaServicio>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={busqueda}
        cargar={cargar}
        clave={(s) => s.id}
        fila={(s) => (
          <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <Link href={`/hato/${s.hembra_id}#reproduccion`} className="block min-w-0 flex-1">
              <span className="block font-bold [overflow-wrap:anywhere]">{s.hembra ? etiquetaAnimal(s.hembra) : "Hembra"}</span>
              <span className="block text-sm text-humo">
                {formatoFecha(s.fecha, { day: "numeric", month: "short", year: "numeric" })} · {ETIQUETA_SERVICIO[s.tipo]}
              </span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">{s.macho ? `Con ${etiquetaAnimal(s.macho)}` : s.macho_externo ? `Con ${s.macho_externo}` : "Reproductor sin registrar"}</span>
            </Link>
            {puedeEditar ? (
              <Link href={`/reproduccion/servicios/${s.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        )}
        vacio={
          busqueda ? (
            <EstadoVacio icono={<HeartHandshake strokeWidth={1.5} />} titulo="Ningún servicio coincide" descripcion="Prueba con otro arete o nombre." />
          ) : (
            <EstadoVacio icono={<HeartHandshake strokeWidth={1.5} />} titulo="Aún no hay servicios" descripcion="Los servicios (monta, inseminación) se registran desde la ficha de cada hembra y aquí queda el compendio." />
          )
        }
      />
    </div>
  );
}
