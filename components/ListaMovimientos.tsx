"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Pencil } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_MOTIVO } from "@/lib/corrales";
import type { MovimientoAnimal } from "@/lib/tipos";

type Fila = MovimientoAnimal & { animal?: { numero_arete: string; nombre: string | null } };

/**
 * El historial de movimientos de animales entre corrales y potreros, lo más reciente primero. De toda la finca (con el periodo elegido) o de una
 * sola instalación. Pagina en el servidor.
 */
export function ListaMovimientos({
  fincaId,
  ubicaciones,
  ubicacionId,
  rango = { desde: null, hasta: null },
  animalId,
  puedeEditar = false,
}: {
  fincaId: string;
  /** Los nombres de las instalaciones por id (para no pedirlos en cada fila). */
  ubicaciones: Record<string, string>;
  ubicacionId?: string;
  rango?: { desde: string | null; hasta: string | null };
  animalId?: string;
  /** Muestra «Corregir» en cada movimiento (a qué instalación fue, desde cuándo, motivo). */
  puedeEditar?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("movimientos_animales").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (ubicacionId) q = q.eq("ubicacion_id", ubicacionId);
      if (animalId) q = q.eq("animal_id", animalId);
      if (rango.desde) q = q.gte("desde", rango.desde);
      if (rango.hasta) q = q.lte("desde", rango.hasta);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const ids = (animales ?? []).map((a) => a.id);
        if (ids.length === 0) return { filas: [] as Fila[], total: 0 };
        q = q.in("animal_id", ids);
      }
      const { data, count, error } = await q.order("desde", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as Fila[];
      const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", [...new Set(filas.map((f) => f.animal_id))]);
      const porId = new Map((animales ?? []).map((a) => [a.id, a]));
      for (const f of filas) f.animal = porId.get(f.animal_id);
      return { filas, total: count ?? 0 };
    },
    [fincaId, ubicacionId, animalId, rango.desde, rango.hasta, busqueda],
  );

  return (
    <div className="space-y-3">
      {!animalId ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      <ListaEscalable<Fila>
        key={`${busqueda}|${ubicacionId}|${animalId}|${rango.desde}|${rango.hasta}`}
        rejilla="grid-cols-1 lg:grid-cols-2"
        cargar={cargar}
        clave={(m) => m.id}
        fila={(m) => (
          <div className="min-w-0 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <Link href={`/hato/${m.animal_id}#ubicacion`} className="block min-w-0">
            <span className="block font-bold [overflow-wrap:anywhere]">{m.animal ? etiquetaAnimal(m.animal) : "Animal"}</span>
            <span className="block text-sm text-humo [overflow-wrap:anywhere]">
              {ubicaciones[m.ubicacion_id] ?? "Instalación"} · desde el {formatoFecha(m.desde, { day: "numeric", month: "short", year: "numeric" })}
              {m.hasta ? ` hasta el ${formatoFecha(m.hasta, { day: "numeric", month: "short", year: "numeric" })}` : ""}
            </span>
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              <Insignia tono={m.hasta ? "neutro" : "musgo"}>{m.hasta ? "Salió" : "Está ahí"}</Insignia>
              <Insignia>{ETIQUETA_MOTIVO[m.motivo]}</Insignia>
            </span>
            {m.observaciones ? <span className="mt-1 block text-sm text-humo [overflow-wrap:anywhere]">{m.observaciones}</span> : null}
            </Link>
            {puedeEditar ? (
              <Link
                href={`/hato/corrales/movimiento/${m.id}/editar${ubicacionId ? `?volver=${ubicacionId}` : ""}`}
                className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline"
              >
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Corregir
              </Link>
            ) : null}
          </div>
        )}
        vacio={<EstadoVacio icono={<ArrowRightLeft strokeWidth={1.5} />} titulo="Sin movimientos" descripcion={busqueda || rango.desde || rango.hasta ? "No hay movimientos con ese filtro." : "Cuando muevas animales entre corrales y potreros, aquí queda el historial."} />}
      />
    </div>
  );
}
