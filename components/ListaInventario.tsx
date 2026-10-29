"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, PackageSearch } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_ATENCION_INVENTARIO, ESCENA_ESTADO_STOCK, ESCENA_TODOS_INVENTARIO } from "@/lib/escenas-inventario";
import { ETIQUETA_ESTADO_STOCK, estadoStock, estadoVencimiento, pideAtencion, textoStock, type EstadoStock, type FilaInventario } from "@/lib/inventario";
import { formatoFecha } from "@/lib/fechas";
import { sinTildes } from "@/lib/texto";
import { ETIQUETA_PRODUCTO } from "@/lib/sanidad";

type Filtro = "todos" | "atencion" | "sin_contar" | "ok";
const TONO_ESTADO: Record<EstadoStock, "neutro" | "ok" | "alerta" | "aviso"> = { sin_contar: "neutro", negativo: "alerta", agotado: "alerta", bajo: "aviso", ok: "ok" };

/** Los medicamentos y vacunas de la finca con lo que queda de cada uno. Los datos vienen calculados de la base; aquí solo se busca y se filtra. */
export function ListaInventario({ filas, hoy }: { filas: FilaInventario[]; hoy: string }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const conteos = useMemo(() => {
    const c = { todos: filas.length, atencion: 0, sin_contar: 0, ok: 0 };
    for (const f of filas) {
      if (estadoStock(f) === "sin_contar") c.sin_contar++;
      else if (pideAtencion(f, hoy)) c.atencion++;
      else c.ok++;
    }
    return c;
  }, [filas, hoy]);

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda);
    return filas.filter((f) => {
      if (q && !sinTildes(f.nombre).includes(q)) return false;
      if (filtro === "sin_contar") return estadoStock(f) === "sin_contar";
      if (filtro === "atencion") return estadoStock(f) !== "sin_contar" && pideAtencion(f, hoy);
      if (filtro === "ok") return estadoStock(f) !== "sin_contar" && !pideAtencion(f, hoy);
      return true;
    });
  }, [filas, busqueda, filtro, hoy]);

  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: visibles.slice(desde, desde + cantidad), total: visibles.length }), [visibles]);

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar un medicamento o vacuna" />
      <FilaTarjetas etiqueta="Qué productos ver">
        <TarjetaOpcion escena={ESCENA_TODOS_INVENTARIO} titulo="Todos" dato={String(conteos.todos)} activo={filtro === "todos"} onClick={() => setFiltro("todos")} />
        <TarjetaOpcion escena={ESCENA_ATENCION_INVENTARIO} titulo="Piden atención" detalle="Poco, agotado o por vencer" dato={String(conteos.atencion)} activo={filtro === "atencion"} onClick={() => setFiltro("atencion")} />
        <TarjetaOpcion escena={ESCENA_ESTADO_STOCK.sin_contar} titulo="Por contar" detalle="Sin conteo de apertura" dato={String(conteos.sin_contar)} activo={filtro === "sin_contar"} onClick={() => setFiltro("sin_contar")} />
        <TarjetaOpcion escena={ESCENA_ESTADO_STOCK.ok} titulo="Al día" dato={String(conteos.ok)} activo={filtro === "ok"} onClick={() => setFiltro("ok")} />
      </FilaTarjetas>
      <ListaEscalable<FilaInventario>
        key={`${busqueda}|${filtro}`}
        rejilla="grid-cols-1 lg:grid-cols-2"
        cargar={cargar}
        clave={(f) => f.producto_id}
        fila={(f) => {
          const estado = estadoStock(f);
          const venc = estadoVencimiento(f.vence_pronto, hoy);
          return (
            <Link href={`/inventario/${f.producto_id}`} className="flex min-h-14 items-center gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena hover:bg-lana">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-bold [overflow-wrap:anywhere]">{f.nombre}</p>
                <p className="text-sm text-humo [overflow-wrap:anywhere]">
                  {ETIQUETA_PRODUCTO[f.tipo as keyof typeof ETIQUETA_PRODUCTO] ?? f.tipo}
                  {f.stock !== null ? ` · Quedan ${textoStock(f, f.stock)}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Insignia tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO_STOCK[estado]}</Insignia>
                  {venc === "vencido" && f.vence_pronto ? <Insignia tono="alerta">Lote vencido el {formatoFecha(f.vence_pronto, { day: "numeric", month: "short" })}</Insignia> : null}
                  {venc === "pronto" && f.vence_pronto ? <Insignia tono="aviso">Vence el {formatoFecha(f.vence_pronto, { day: "numeric", month: "short" })}</Insignia> : null}
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={2} aria-hidden="true" />
            </Link>
          );
        }}
        vacio={
          <EstadoVacio
            icono={<PackageSearch strokeWidth={1.5} />}
            titulo={busqueda || filtro !== "todos" ? "Ningún producto coincide" : "Todavía no hay productos"}
            descripcion={busqueda || filtro !== "todos" ? "Prueba con otro nombre o cambia el filtro." : "Cuando registres medicamentos y vacunas en Sanidad, aparecerán aquí con lo que queda de cada uno."}
          />
        }
      />
    </div>
  );
}
