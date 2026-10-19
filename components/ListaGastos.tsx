"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Paperclip, Receipt } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { useToast } from "@/components/Toast";
import { marcarPago } from "@/app/(app)/hato/gastos/actions";
import { ETIQUETA_GRUPO, ETIQUETA_RUBRO, GRUPOS, RUBROS_DE, estaVencido, type GrupoGasto } from "@/lib/costos";
import { ESCENA_GRUPO_GASTO, ESCENA_TODOS_GRUPOS } from "@/lib/escenas-costos";
import { formatoFecha } from "@/lib/fechas";
import { pesos } from "@/lib/ferias";
import { direccionSoporte } from "@/lib/soportes";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { Gasto } from "@/lib/tipos";

/**
 * Los gastos registrados de la finca, lo más reciente primero: filtro por grupo, búsqueda por descripción o proveedor, y el rango de fechas que
 * llegue. Cada gasto se corrige desde aquí y, si quedó por pagar, se marca como pagado con un toque. Pagina en el servidor.
 */
export function ListaGastos({
  fincaId,
  hoy,
  puedeEditar,
  rango = { desde: null, hasta: null },
  soloPorPagar = false,
}: {
  fincaId: string;
  hoy: string;
  puedeEditar: boolean;
  rango?: { desde: string | null; hasta: string | null };
  soloPorPagar?: boolean;
}) {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState("");
  const [grupo, setGrupo] = useState<GrupoGasto | "todos">("todos");
  const [version, setVersion] = useState(0);
  const [pagando, setPagando] = useState<string | null>(null);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      let q = crearClienteNavegador().from("gastos").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (soloPorPagar) q = q.is("pagado_en", null);
      if (grupo !== "todos") q = q.in("rubro", RUBROS_DE[grupo]);
      if (rango.desde) q = q.gte("fecha", rango.desde);
      if (rango.hasta) q = q.lte("fecha", rango.hasta);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) q = q.or(`descripcion.ilike.%${limpio}%,proveedor.ilike.%${limpio}%`);
      const orden = soloPorPagar ? q.order("vence", { ascending: true, nullsFirst: false }).order("fecha", { ascending: false }) : q.order("fecha", { ascending: false }).order("created_at", { ascending: false });
      const { data, count, error } = await orden.range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as Gasto[], total: count ?? 0 };
    },
    // `version` fuerza a recargar la lista después de marcar un pago.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fincaId, busqueda, grupo, rango.desde, rango.hasta, soloPorPagar, version],
  );

  const pagar = async (g: Gasto) => {
    setPagando(g.id);
    const r = await marcarPago(g.id, true);
    setPagando(null);
    if (!r.ok) return toast.error(r.error);
    toast.exito("Gasto marcado como pagado");
    setVersion((v) => v + 1);
  };

  const hayFiltro = busqueda !== "" || grupo !== "todos" || Boolean(rango.desde || rango.hasta);

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por descripción o proveedor" />
      <FilaTarjetas etiqueta="Grupo de compra">
        <TarjetaOpcion escena={ESCENA_TODOS_GRUPOS} titulo="Todos" activo={grupo === "todos"} onClick={() => setGrupo("todos")} />
        {GRUPOS.map((g) => (
          <TarjetaOpcion key={g} escena={ESCENA_GRUPO_GASTO[g]} titulo={ETIQUETA_GRUPO[g]} activo={grupo === g} onClick={() => setGrupo(g)} />
        ))}
      </FilaTarjetas>
      <ListaEscalable<Gasto>
        key={`${busqueda}|${grupo}|${rango.desde}|${rango.hasta}|${soloPorPagar}|${version}`}
        rejilla="grid-cols-1 lg:grid-cols-2"
        cargar={cargar}
        clave={(g) => g.id}
        fila={(g) => {
          const vencido = estaVencido(g, hoy);
          return (
            <div className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold [overflow-wrap:anywhere]">{g.descripcion}</p>
                  <p className="text-sm text-humo [overflow-wrap:anywhere]">
                    {ETIQUETA_RUBRO[g.rubro]} · {formatoFecha(g.fecha, { day: "numeric", month: "short", year: "numeric" })}
                    {g.proveedor ? ` · ${g.proveedor}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-right font-display text-lg font-semibold tabular-nums">{pesos(g.monto)}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {g.pagado_en ? <Insignia tono="ok">Pagado</Insignia> : vencido ? <Insignia tono="alerta">Vencido</Insignia> : <Insignia tono="aviso">Por pagar</Insignia>}
                {!g.pagado_en && g.vence ? <span className="text-xs text-humo">vence el {formatoFecha(g.vence, { day: "numeric", month: "short" })}</span> : null}
                {g.cantidad ? <span className="text-xs text-humo">{String(g.cantidad).replace(".", ",")} {g.unidad ?? ""}</span> : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 border-t border-arena pt-1">
                {puedeEditar && !g.pagado_en ? (
                  <button type="button" onClick={() => void pagar(g)} disabled={pagando === g.id} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline disabled:opacity-60">
                    {pagando === g.id ? "Guardando…" : "Marcar pagado"}
                  </button>
                ) : null}
                {puedeEditar ? (
                  <Link href={`/hato/gastos/${g.id}/editar`} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    Editar
                  </Link>
                ) : null}
                {g.soporte_path ? (
                  <a href={direccionSoporte(g.soporte_path)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    <Paperclip className="size-3.5" strokeWidth={2} aria-hidden="true" /> Factura
                  </a>
                ) : null}
              </div>
            </div>
          );
        }}
        vacio={
          <EstadoVacio
            icono={<Receipt strokeWidth={1.5} />}
            titulo={soloPorPagar && !hayFiltro ? "No tienes compras por pagar" : hayFiltro ? "Nada con ese filtro" : "Todavía no hay compras"}
            descripcion={
              hayFiltro
                ? "Prueba con otro grupo, otras fechas o quita la búsqueda."
                : soloPorPagar
                  ? "Cuando registres una compra a crédito, aquí verás cuándo vence."
                  : "Registra lo que compras y pagas (concentrado, sales, vacunas…) y aquí queda el historial."
            }
          />
        }
      />
    </div>
  );
}
