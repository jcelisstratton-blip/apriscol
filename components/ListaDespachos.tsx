"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Pencil, Truck } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_DESTINO_LECHE, ESCENA_TODOS_DESTINOS } from "@/lib/escenas-listas-leche";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { controlesDe, agruparControles } from "@/lib/controles-datos";
import { CONTROLES_DESPACHO, etiquetaResumen, resumenControles } from "@/lib/controles";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { formatoFecha, litros as formatoLitros } from "@/lib/fechas";
import { DESTINOS_LECHE, ETIQUETA_DESTINO, pesos } from "@/lib/leche-calidad";
import type { ControlCalidad, DespachoLeche, DestinoLeche } from "@/lib/tipos";

type FilaDespacho = DespachoLeche & { controles?: ControlCalidad[] };

/** Todos los despachos de leche de la finca, del más reciente al más antiguo. */
export function ListaDespachos({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [destino, setDestino] = useState<DestinoLeche | "todos">("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("despachos_leche").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (destino !== "todos") q = q.eq("destino_tipo", destino);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) q = q.or(`comprador.ilike.%${limpio}%,guia.ilike.%${limpio}%,tanque.ilike.%${limpio}%`);
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaDespacho[];
      if (filas.length) {
        const porDespacho = agruparControles(await controlesDe(supabase, fincaId, "despacho_id", filas.map((f) => f.id)), "despacho_id");
        for (const f of filas) f.controles = porDespacho.get(f.id) ?? [];
      }
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda, destino],
  );

  const hayFiltro = busqueda !== "" || destino !== "todos";

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar comprador, guía o tanque" />
      <FilaTarjetas etiqueta="Destino de la leche">
        <TarjetaOpcion escena={ESCENA_TODOS_DESTINOS} titulo="Todos" activo={destino === "todos"} onClick={() => setDestino("todos")} />
        {DESTINOS_LECHE.map((d) => (
          <TarjetaOpcion key={d} escena={ESCENA_DESTINO_LECHE[d]} titulo={ETIQUETA_DESTINO[d]} activo={destino === d} onClick={() => setDestino(d)} />
        ))}
      </FilaTarjetas>
      <ListaEscalable<FilaDespacho>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${destino}`}
        cargar={cargar}
        clave={(d) => d.id}
        fila={(d) => (
          <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <div className="min-w-0 flex-1">
              <span className="block font-bold [overflow-wrap:anywhere]">{formatoLitros(d.litros)} litros{d.comprador ? ` · ${d.comprador}` : ""}</span>
              <span className="block text-sm text-humo">
                {formatoFecha(d.fecha, { day: "numeric", month: "short", year: "numeric" })} · {ETIQUETA_DESTINO[d.destino_tipo]}
              </span>
              {d.guia || d.tanque ? (
                <span className="block text-sm text-humo [overflow-wrap:anywhere]">{[d.guia ? `Guía ${d.guia}` : null, d.tanque].filter(Boolean).join(" · ")}</span>
              ) : null}
              {d.valor_total != null ? (
                <span className="mt-1.5 block">
                  <Insignia tono="musgo">{`${pesos(d.valor_total)} (${pesos(d.precio_litro)}/l)`}</Insignia>
                </span>
              ) : null}
              {d.controles ? (
                <Link href={`/leche/despachos/${d.id}/controles`} className="mt-1.5 inline-flex min-h-8 items-center gap-1.5 underline-offset-4 hover:underline">
                  {(() => {
                    const e = etiquetaResumen(resumenControles(CONTROLES_DESPACHO, d.controles));
                    return <Insignia tono={e.tono}>{e.texto}</Insignia>;
                  })()}
                </Link>
              ) : null}
            </div>
            {puedeEditar ? (
              <Link href={`/leche/despachos/${d.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        )}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<Truck strokeWidth={1.5} />} titulo="Ningún despacho coincide" descripcion="Prueba con otro nombre o quita el filtro." />
          ) : (
            <EstadoVacio icono={<Truck strokeWidth={1.5} />} titulo="Aún no hay despachos" descripcion="Cuando saques leche de la finca, regístrala aquí con su guía, su destino y su precio." />
          )
        }
      />
    </div>
  );
}
