"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ETIQUETA_GRUPO_COSTO, ETIQUETA_ORIGEN, ETIQUETA_RUBRO, GRUPOS_COSTO, type GrupoCosto } from "@/lib/costos";
import { ESCENA_GRUPO_COSTO, ESCENA_TODOS_GRUPOS } from "@/lib/escenas-costos";
import { formatoFecha } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { CostoLinea } from "@/lib/tipos";

type Fila = CostoLinea;

/** A dónde lleva cada línea de costo: la compra se corrige en Hato → Compras; el tratamiento, en su evento de Sanidad; el alimento, en los lotes de Carne; la compra de un animal, en su ficha; el pago al personal, en Personal. */
const destino = (l: Fila, puedeEditar: boolean) =>
  l.origen === "gasto" ? (puedeEditar ? `/hato/gastos/${l.origen_id}/editar` : null) : l.origen === "sanidad" ? `/sanidad/evento/${l.origen_id}` : l.origen === "compra" ? `/hato/${l.origen_id}` : l.origen === "nomina" ? (puedeEditar ? `/personal/pagos/${l.origen_id}/editar` : null) : "/carne?vista=lotes";

/**
 * Todo lo que costó en el periodo (compras, tratamientos, alimento de ceba y animales comprados), lo más reciente primero, con filtro por grupo. Pagina en el servidor.
 */
export function ListaCostos({ fincaId, hoy, puedeEditar, rango }: { fincaId: string; hoy: string; puedeEditar: boolean; rango: { desde: string | null; hasta: string | null } }) {
  const [grupo, setGrupo] = useState<GrupoCosto | "todos">("todos");

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const { data, error } = await crearClienteNavegador().rpc("costos_pagina", {
        p_finca: fincaId,
        p_desde: rango.desde,
        p_hasta: rango.hasta,
        p_rubro: grupo === "todos" ? null : `grupo:${grupo}`,
        p_limite: cantidad,
        p_salto: desde,
      });
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as (Fila & { total: number })[];
      return { filas, total: Number(filas[0]?.total ?? 0) };
    },
    [fincaId, rango.desde, rango.hasta, grupo],
  );

  return (
    <div className="space-y-3">
      <FilaTarjetas etiqueta="Grupo de compra">
        <TarjetaOpcion escena={ESCENA_TODOS_GRUPOS} titulo="Todos" activo={grupo === "todos"} onClick={() => setGrupo("todos")} />
        {GRUPOS_COSTO.map((g) => (
          <TarjetaOpcion key={g} escena={ESCENA_GRUPO_COSTO[g]} titulo={ETIQUETA_GRUPO_COSTO[g]} activo={grupo === g} onClick={() => setGrupo(g)} />
        ))}
      </FilaTarjetas>
      <ListaEscalable<Fila>
        key={`${grupo}|${rango.desde}|${rango.hasta}`}
        rejilla="grid-cols-1 lg:grid-cols-2"
        cargar={cargar}
        clave={(l) => `${l.origen}-${l.origen_id}`}
        fila={(l) => {
          const vencido = !l.pagado && l.vence !== null && l.vence < hoy;
          const enlace = destino(l, puedeEditar);
          const contenido = (
            <>
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-bold [overflow-wrap:anywhere]">{l.descripcion}</span>
                  <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                    {ETIQUETA_RUBRO[l.rubro]} · {formatoFecha(l.fecha, { day: "numeric", month: "short", year: "numeric" })}
                    {l.proveedor ? ` · ${l.proveedor}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right font-display text-lg font-semibold tabular-nums">{pesos(l.monto)}</span>
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Insignia tono={l.origen === "gasto" ? "neutro" : "musgo"}>{ETIQUETA_ORIGEN[l.origen]}</Insignia>
                {l.pagado ? null : vencido ? <Insignia tono="alerta">Vencido</Insignia> : <Insignia tono="aviso">Por pagar</Insignia>}
              </span>
            </>
          );
          const clases = "block min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena";
          return enlace ? (
            <Link href={enlace} className={`${clases} transition active:scale-[0.99]`}>
              {contenido}
            </Link>
          ) : (
            <div className={clases}>{contenido}</div>
          );
        }}
        vacio={
          <EstadoVacio
            icono={<Receipt strokeWidth={1.5} />}
            titulo={grupo !== "todos" || rango.desde || rango.hasta ? "Nada con ese filtro" : "Todavía no hay costos"}
            descripcion={grupo !== "todos" || rango.desde || rango.hasta ? "Prueba con otro grupo u otras fechas." : "Cuando registres compras, pagos al personal, tratamientos con costo o alimento de ceba, aparecerán aquí."}
          />
        }
      />
    </div>
  );
}
