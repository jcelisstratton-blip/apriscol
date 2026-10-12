"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Pencil, Truck } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { controlesDe, agruparControles } from "@/lib/controles-datos";
import { controlesDeSalida, etiquetaResumen, resumenControles } from "@/lib/controles";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { kg } from "@/lib/carne";
import { formatoFecha } from "@/lib/fechas";
import { pesos } from "@/lib/leche-calidad";
import type { Baja, ControlCalidad } from "@/lib/tipos";

type FilaSalida = Baja & { animal?: { numero_arete: string; nombre: string | null }; controles?: ControlCalidad[] };
type Filtro = "todas" | "sacrificio" | "consumo" | "pie";

/**
 * Hacia dónde salieron los animales (ventas y sacrificios): guía de movilización, destino, peso en vivo y valor. Si pasó por consumo,
 * el sistema ya verificó que no estuviera en periodo de retiro de carne (no deja registrarlo si lo está).
 */
export function ListaSalidas({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("bajas").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (filtro === "sacrificio") q = q.eq("tipo", "sacrificio");
      else if (filtro === "consumo") q = q.eq("tipo", "venta").eq("destino_consumo", true);
      else if (filtro === "pie") q = q.eq("tipo", "venta").eq("destino_consumo", false);
      else q = q.in("tipo", ["venta", "sacrificio"]);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const condiciones = [`comprador.ilike.%${limpio}%`, `guia_movilizacion.ilike.%${limpio}%`, `destino.ilike.%${limpio}%`];
        const ids = (animales ?? []).map((a) => a.id);
        if (ids.length) condiciones.push(`animal_id.in.(${ids.join(",")})`);
        q = q.or(condiciones.join(","));
      }
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaSalida[];
      if (filas.length) {
        const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", [...new Set(filas.map((f) => f.animal_id))]);
        const porId = new Map((animales ?? []).map((a) => [a.id, a]));
        for (const f of filas) f.animal = porId.get(f.animal_id);
        const porAnimal = agruparControles(await controlesDe(supabase, fincaId, "animal_id", filas.map((f) => f.animal_id)), "animal_id");
        for (const f of filas) f.controles = porAnimal.get(f.animal_id) ?? [];
      }
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda, filtro],
  );

  const hayFiltro = busqueda !== "" || filtro !== "todas";

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar animal, comprador, guía o destino" />
      <FilaDesplazable>
        <Chip activo={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas</Chip>
        <Chip activo={filtro === "sacrificio"} onClick={() => setFiltro("sacrificio")}>Sacrificio</Chip>
        <Chip activo={filtro === "consumo"} onClick={() => setFiltro("consumo")}>Venta para consumo</Chip>
        <Chip activo={filtro === "pie"} onClick={() => setFiltro("pie")}>Venta en pie</Chip>
      </FilaDesplazable>
      <ListaEscalable<FilaSalida>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${filtro}`}
        cargar={cargar}
        clave={(b) => b.id}
        fila={(b) => (
          <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <div className="min-w-0 flex-1">
            <Link href={`/hato/${b.animal_id}#salida`} className="block">
              <span className="block font-bold [overflow-wrap:anywhere]">{b.animal ? etiquetaAnimal(b.animal) : "Animal"}</span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                {formatoFecha(b.fecha, { day: "numeric", month: "short", year: "numeric" })}
                {b.comprador ? ` · ${b.comprador}` : ""}
                {b.destino ? ` · ${b.destino}` : ""}
              </span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                {[b.peso_kg ? `${kg(b.peso_kg)} en vivo` : null, b.guia_movilizacion ? `Guía ${b.guia_movilizacion}` : null, b.valor ? pesos(b.valor) : null].filter(Boolean).join(" · ")}
              </span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <Insignia tono={b.tipo === "sacrificio" ? "alerta" : "musgo"}>{b.tipo === "sacrificio" ? "Sacrificio" : b.destino_consumo ? "Venta para consumo" : "Venta en pie"}</Insignia>
                {!b.guia_movilizacion ? <Insignia tono="aviso">Sin guía</Insignia> : null}
              </span>
            </Link>
            {b.controles && controlesDeSalida(b.tipo, b.destino_consumo).length > 0 ? (
              <Link href={`/hato/${b.animal_id}/controles`} className="mt-1 inline-flex min-h-11 items-center underline-offset-4 hover:underline" aria-label="Controles de calidad">
                {(() => {
                  const e = etiquetaResumen(resumenControles(controlesDeSalida(b.tipo, b.destino_consumo), b.controles));
                  return <Insignia tono={e.tono}>{e.texto}</Insignia>;
                })()}
              </Link>
            ) : null}
            </div>
            {puedeEditar ? (
              <Link href={`/hato/${b.animal_id}/baja/editar`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        )}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<Truck strokeWidth={1.5} />} titulo="Ninguna salida coincide" descripcion="Prueba con otro nombre o quita el filtro." />
          ) : (
            <EstadoVacio icono={<Truck strokeWidth={1.5} />} titulo="Aún no hay salidas" descripcion="Las ventas y los sacrificios que registres al dar de baja un animal quedan aquí, con su guía de movilización y su destino." />
          )
        }
      />
    </div>
  );
}
