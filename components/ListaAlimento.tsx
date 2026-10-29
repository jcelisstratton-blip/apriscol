"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, WheatOff } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_ATENCION_INVENTARIO, ESCENA_ESTADO_ALIMENTO, ESCENA_TODOS_ALIMENTO } from "@/lib/escenas-inventario";
import { ETIQUETA_ESTADO_ALIMENTO, alimentoPideAtencion, autonomiaDias, diasTexto, estadoAlimento, textoKg, type EstadoAlimento, type FilaAlimento } from "@/lib/inventario-alimento";
import { sinTildes } from "@/lib/texto";

type Filtro = "todos" | "atencion" | "sin_contar" | "ok";
const TONO_ESTADO: Record<EstadoAlimento, "neutro" | "ok" | "alerta" | "aviso"> = { sin_contar: "neutro", negativo: "alerta", agotado: "alerta", critico: "alerta", bajo: "aviso", ok: "ok", sin_datos: "neutro" };

/** Los alimentos de la finca con lo que queda de cada uno y para cuántos días alcanza. Los datos vienen calculados de la base; aquí solo se busca y se filtra. */
export function ListaAlimento({ filas, plazoDias, hoy }: { filas: FilaAlimento[]; plazoDias: number; hoy: string }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const conteos = useMemo(() => {
    const c = { todos: filas.length, atencion: 0, sin_contar: 0, ok: 0 };
    for (const f of filas) {
      if (estadoAlimento(f, plazoDias, hoy) === "sin_contar") c.sin_contar++;
      else if (alimentoPideAtencion(f, plazoDias, hoy)) c.atencion++;
      else c.ok++;
    }
    return c;
  }, [filas, plazoDias, hoy]);

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda);
    return filas.filter((f) => {
      if (q && !sinTildes(f.nombre).includes(q)) return false;
      const sinContar = estadoAlimento(f, plazoDias, hoy) === "sin_contar";
      if (filtro === "sin_contar") return sinContar;
      if (filtro === "atencion") return !sinContar && alimentoPideAtencion(f, plazoDias, hoy);
      if (filtro === "ok") return !sinContar && !alimentoPideAtencion(f, plazoDias, hoy);
      return true;
    });
  }, [filas, busqueda, filtro, plazoDias, hoy]);

  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: visibles.slice(desde, desde + cantidad), total: visibles.length }), [visibles]);

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar un alimento" />
      <FilaTarjetas etiqueta="Qué alimentos ver">
        <TarjetaOpcion escena={ESCENA_TODOS_ALIMENTO} titulo="Todos" dato={String(conteos.todos)} activo={filtro === "todos"} onClick={() => setFiltro("todos")} />
        <TarjetaOpcion escena={ESCENA_ATENCION_INVENTARIO} titulo="Piden atención" detalle="Alcanzan poco o se agotaron" dato={String(conteos.atencion)} activo={filtro === "atencion"} onClick={() => setFiltro("atencion")} />
        <TarjetaOpcion escena={ESCENA_ESTADO_ALIMENTO.sin_contar} titulo="Por contar" detalle="Sin conteo de apertura" dato={String(conteos.sin_contar)} activo={filtro === "sin_contar"} onClick={() => setFiltro("sin_contar")} />
        <TarjetaOpcion escena={ESCENA_ESTADO_ALIMENTO.ok} titulo="Al día" dato={String(conteos.ok)} activo={filtro === "ok"} onClick={() => setFiltro("ok")} />
      </FilaTarjetas>
      <ListaEscalable<FilaAlimento>
        key={`${busqueda}|${filtro}`}
        rejilla="grid-cols-1 lg:grid-cols-2"
        cargar={cargar}
        clave={(f) => f.producto_id}
        fila={(f) => {
          const estado = estadoAlimento(f, plazoDias, hoy);
          const dias = autonomiaDias(f, hoy);
          return (
            <Link href={`/inventario/alimento/${f.producto_id}`} className="flex min-h-14 items-center gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena hover:bg-lana">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-bold [overflow-wrap:anywhere]">{f.nombre}</p>
                <p className="text-sm text-humo [overflow-wrap:anywhere]">
                  {f.stock_kg !== null ? `Quedan ${textoKg(f, f.stock_kg)}` : "Todavía sin contar"}
                  {dias !== null ? ` · alcanza ${diasTexto(dias)}` : ""}
                </p>
                <Insignia tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO_ALIMENTO[estado]}</Insignia>
              </div>
              <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={2} aria-hidden="true" />
            </Link>
          );
        }}
        vacio={
          <EstadoVacio
            icono={<WheatOff strokeWidth={1.5} />}
            titulo={busqueda || filtro !== "todos" ? "Ningún alimento coincide" : "Todavía no hay alimentos"}
            descripcion={busqueda || filtro !== "todos" ? "Prueba con otro nombre o cambia el filtro." : "Los alimentos salen de tu catálogo de compras (concentrado, forraje, sales y suplementos, leche maternizada)."}
          />
        }
      />
    </div>
  );
}
