"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { useToast } from "@/components/Toast";
import { marcarCobro } from "@/app/(app)/hato/ventas/actions";
import { ESCENA_LINEA_VENTA, ESCENA_TODAS_LINEAS } from "@/lib/escenas-costos";
import { formatoFecha } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cobroVencido, destinoVenta, ETIQUETA_LINEA, ETIQUETA_ORIGEN_VENTA, LINEAS } from "@/lib/ventas";
import type { LineaVenta, VentaLinea } from "@/lib/tipos";

type Fila = VentaLinea & { total: number };

/**
 * Todo lo que se vendió (las ventas registradas, la leche despachada y los animales vendidos), lo más reciente primero, con filtro por línea y el
 * rango de fechas que llegue. Lo que falta por cobrar se marca cobrado con un toque. Pagina en el servidor.
 */
export function ListaVentas({
  fincaId,
  hoy,
  puedeEditar,
  rango = { desde: null, hasta: null },
}: {
  fincaId: string;
  hoy: string;
  puedeEditar: boolean;
  rango?: { desde: string | null; hasta: string | null };
}) {
  const toast = useToast();
  const [linea, setLinea] = useState<LineaVenta | "todas">("todas");
  const [version, setVersion] = useState(0);
  const [cobrando, setCobrando] = useState<string | null>(null);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const { data, error } = await crearClienteNavegador().rpc("ventas_pagina", {
        p_finca: fincaId,
        p_desde: rango.desde,
        p_hasta: rango.hasta,
        p_linea: linea === "todas" ? null : linea,
        p_limite: cantidad,
        p_salto: desde,
      });
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as Fila[];
      return { filas, total: Number(filas[0]?.total ?? 0) };
    },
    // `version` fuerza a recargar la lista después de marcar un cobro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fincaId, rango.desde, rango.hasta, linea, version],
  );

  const cobrar = async (v: Fila) => {
    const llave = `${v.origen}-${v.origen_id}`;
    setCobrando(llave);
    const r = await marcarCobro(v.origen, v.origen_id, true);
    setCobrando(null);
    if (!r.ok) return toast.error(r.error);
    toast.exito("Venta marcada como cobrada");
    setVersion((n) => n + 1);
  };

  const hayFiltro = linea !== "todas" || Boolean(rango.desde || rango.hasta);

  return (
    <div className="space-y-3">
      <FilaTarjetas etiqueta="Línea de venta">
        <TarjetaOpcion escena={ESCENA_TODAS_LINEAS} titulo="Todas" activo={linea === "todas"} onClick={() => setLinea("todas")} />
        {LINEAS.map((l) => (
          <TarjetaOpcion key={l} escena={ESCENA_LINEA_VENTA[l]} titulo={ETIQUETA_LINEA[l]} activo={linea === l} onClick={() => setLinea(l)} />
        ))}
      </FilaTarjetas>
      <ListaEscalable<Fila>
        key={`${linea}|${rango.desde}|${rango.hasta}|${version}`}
        rejilla="grid-cols-1 lg:grid-cols-2"
        cargar={cargar}
        clave={(v) => `${v.origen}-${v.origen_id}`}
        fila={(v) => {
          const vencida = cobroVencido(v, hoy);
          const enlace = destinoVenta(v, puedeEditar);
          return (
            <div className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold [overflow-wrap:anywhere]">{v.producto}</p>
                  <p className="text-sm text-humo [overflow-wrap:anywhere]">
                    {formatoFecha(v.fecha, { day: "numeric", month: "short", year: "numeric" })}
                    {v.tercero ? ` · ${v.tercero}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-right font-display text-lg font-semibold tabular-nums">{pesos(Number(v.valor))}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Insignia tono={v.origen === "venta" ? "neutro" : "musgo"}>{ETIQUETA_ORIGEN_VENTA[v.origen]}</Insignia>
                {v.cobrado ? <Insignia tono="ok">Cobrado</Insignia> : vencida ? <Insignia tono="alerta">Vencido</Insignia> : <Insignia tono="aviso">Por cobrar</Insignia>}
                {!v.cobrado && v.cobro_vence ? <span className="text-xs text-humo">se espera el {formatoFecha(v.cobro_vence, { day: "numeric", month: "short" })}</span> : null}
                <span className="text-xs text-humo">
                  {String(Number(v.cantidad)).replace(".", ",")} {v.unidad ?? ""}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 border-t border-arena pt-1">
                {puedeEditar && !v.cobrado ? (
                  <button type="button" onClick={() => void cobrar(v)} disabled={cobrando === `${v.origen}-${v.origen_id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline disabled:opacity-60">
                    {cobrando === `${v.origen}-${v.origen_id}` ? "Guardando…" : "Marcar cobrado"}
                  </button>
                ) : null}
                {enlace ? (
                  <Link href={enlace} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    {v.origen === "venta" ? "Editar" : v.origen === "leche" ? "Ver el despacho" : "Ver el animal"}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        }}
        vacio={
          <EstadoVacio
            icono={<Banknote strokeWidth={1.5} />}
            titulo={hayFiltro ? "Nada con ese filtro" : "Todavía no hay ventas"}
            descripcion={hayFiltro ? "Prueba con otra línea u otras fechas." : "La leche que despachas con precio y los animales que vendes aparecen solos. Lo demás (carne, queso, abono…) lo registras en Hato → Ventas."}
          />
        }
      />
    </div>
  );
}
