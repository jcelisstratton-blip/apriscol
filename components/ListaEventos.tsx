"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronRight, Syringe } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EnlaceBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_EVENTO, ESCENA_TODOS_TIPOS } from "@/lib/escenas-sanidad";
import { IconoEvento } from "@/components/IconoEvento";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { ETIQUETA_EVENTO, TIPOS_EVENTO, nombreEvento } from "@/lib/sanidad";
import type { EventoResumen, TipoEvento } from "@/lib/tipos";

/**
 * Historial de todo lo que se ha aplicado en la finca, lo más reciente primero. Cada fila lleva al detalle del evento
 * (a quiénes se aplicó, retiro, próxima dosis). Pagina en el servidor.
 */
export function ListaEventos({ fincaId, puedeRegistrar, rango = { desde: null, hasta: null }, tipoInicial = "todos" }: { fincaId: string; puedeRegistrar: boolean; rango?: { desde: string | null; hasta: string | null }; tipoInicial?: TipoEvento | "todos" }) {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoEvento | "todos">(tipoInicial);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);
  const hoy = hoyBogota();

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      let q = crearClienteNavegador().from("v_eventos_sanitarios").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (tipo !== "todos") q = q.eq("tipo", tipo);
      if (rango.desde) q = q.gte("fecha", rango.desde);
      if (rango.hasta) q = q.lte("fecha", rango.hasta);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) q = q.or(`producto_nombre.ilike.%${limpio}%,responsable.ilike.%${limpio}%,diagnostico.ilike.%${limpio}%`);
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as EventoResumen[], total: count ?? 0 };
    },
    [fincaId, busqueda, tipo, rango.desde, rango.hasta],
  );

  const hayFiltro = busqueda !== "" || tipo !== "todos" || Boolean(rango.desde || rango.hasta);

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar producto, responsable o diagnóstico" />
      <FilaTarjetas etiqueta="Tipo de tratamiento">
        <TarjetaOpcion escena={ESCENA_TODOS_TIPOS} titulo="Todo" activo={tipo === "todos"} onClick={() => setTipo("todos")} />
        {TIPOS_EVENTO.map((t) => (
          <TarjetaOpcion key={t} escena={ESCENA_EVENTO[t]} titulo={ETIQUETA_EVENTO[t]} activo={tipo === t} onClick={() => setTipo(t)} />
        ))}
      </FilaTarjetas>
      <ListaEscalable<EventoResumen>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${tipo}|${rango.desde}|${rango.hasta}`}
        cargar={cargar}
        clave={(e) => e.id ?? ""}
        fila={(e) => {
          const retiroLeche = e.fin_retiro_leche && (e.retiro_leche_dias ?? 0) > 0 && e.fin_retiro_leche >= hoy ? e.fin_retiro_leche : null;
          const retiroCarne = e.fin_retiro_carne && (e.retiro_carne_dias ?? 0) > 0 && e.fin_retiro_carne >= hoy ? e.fin_retiro_carne : null;
          const aQuien = (e.animales ?? 0) === 1 ? (e.primer_animal ?? "1 animal") : `${e.animales ?? 0} animales`;
          return (
            <Link href={`/sanidad/evento/${e.id}`} className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena transition active:scale-[0.99]">
              <IconoEvento tipo={e.tipo} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold [overflow-wrap:anywhere]">{nombreEvento(e)}</span>
                <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                  {e.tipo ? ETIQUETA_EVENTO[e.tipo] : ""} · {formatoFecha(e.fecha, { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="block text-sm text-humo [overflow-wrap:anywhere]">{aQuien}</span>
                {retiroLeche || retiroCarne || e.proxima_fecha ? (
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {retiroLeche ? <Insignia tono="aviso">Leche hasta {formatoFecha(retiroLeche, { day: "numeric", month: "short" })}</Insignia> : null}
                    {retiroCarne ? <Insignia tono="alerta">Carne hasta {formatoFecha(retiroCarne, { day: "numeric", month: "short" })}</Insignia> : null}
                    {e.proxima_fecha ? <Insignia>Próxima dosis {formatoFecha(e.proxima_fecha, { day: "numeric", month: "short" })}</Insignia> : null}
                  </span>
                ) : null}
              </span>
              <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} />
            </Link>
          );
        }}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<Syringe strokeWidth={1.5} />} titulo="Nada coincide" descripcion="Prueba con otro producto o quita el filtro." />
          ) : (
            <EstadoVacio icono={<Syringe strokeWidth={1.5} />} titulo="Aún no hay registros de sanidad" descripcion="Aquí queda cada vacuna, desparasitación o tratamiento que registres, con sus retiros y próximas dosis.">
              {puedeRegistrar ? <EnlaceBoton href="/hato?vista=sanidad">Ir a Hato → Sanidad</EnlaceBoton> : null}
            </EstadoVacio>
          )
        }
      />
    </div>
  );
}
