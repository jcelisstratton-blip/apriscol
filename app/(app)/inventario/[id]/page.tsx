import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ClipboardList, SlidersHorizontal } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { clasesBoton } from "@/components/Boton";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { Encabezado } from "@/components/Encabezado";
import { FormPresentacion } from "@/components/FormPresentacion";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { ETIQUETA_PRODUCTO } from "@/lib/sanidad";
import {
  DETALLE_ESTADO_STOCK,
  ETIQUETA_ESTADO_STOCK,
  ETIQUETA_MOTIVO_AJUSTE,
  estadoStock,
  estadoVencimiento,
  faltaParaMinimo,
  textoStock,
  type EstadoStock,
  type FilaInventario,
  type FilaLote,
} from "@/lib/inventario";
import { eliminarConteo } from "@/app/(app)/inventario/actions";

export const metadata: Metadata = { title: "Inventario del producto" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONO_ESTADO: Record<EstadoStock, "neutro" | "ok" | "alerta" | "aviso"> = { sin_contar: "neutro", negativo: "alerta", agotado: "alerta", bajo: "aviso", ok: "ok" };
const corta = { day: "numeric", month: "short", year: "numeric" } as const;

/** Lo que queda de un producto: el total, los lotes con su vencimiento, cómo viene, y el registro de conteos y ajustes. */
export default async function DetalleInventario({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const { guardado } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "inventario", finca.plan)) redirect("/");
  const supabase = await crearClienteServidor();
  const [productos, lotes, conteos] = await Promise.all([
    supabase.rpc("inventario_productos", { p_finca: finca.id }),
    supabase.rpc("inventario_lotes", { p_finca: finca.id, p_producto: id }),
    supabase.from("inventario_movimientos").select("*").eq("finca_id", finca.id).eq("producto_vet_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false }).limit(50),
  ]);
  if (productos.error) return <Aviso tipo="error">{mensajeAmigable(productos.error.message)}</Aviso>;
  const f = ((productos.data ?? []) as FilaInventario[]).find((p) => p.producto_id === id);
  if (!f) notFound();
  const hoy = hoyBogota();
  const puedeMover = puedeEscribir(rol, "inventario", finca.plan);
  const estado = estadoStock(f);
  const filasLote = ((lotes.data ?? []) as FilaLote[]).filter((l) => l.lote !== null || Math.abs(l.stock) > 0.004);
  const falta = faltaParaMinimo(f);
  const sinLote = filasLote.find((l) => l.lote === null);

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <Link href="/inventario" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Inventario
      </Link>
      <Encabezado titulo={f.nombre} subtitulo={ETIQUETA_PRODUCTO[f.tipo as keyof typeof ETIQUETA_PRODUCTO] ?? f.tipo} />

      <div className="grid grid-cols-1 gap-4 lg:max-w-4xl">
        <Tarjeta titulo="Existencias">
          {f.desde && f.stock !== null ? (
            <div className="space-y-3">
              <p className="font-display text-3xl font-semibold [overflow-wrap:anywhere]">{textoStock(f, f.stock)}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Insignia tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO_STOCK[estado]}</Insignia>
                <span className="text-sm text-humo">{DETALLE_ESTADO_STOCK[estado]}</span>
              </div>
              <p className="text-sm text-humo">Contando desde el {formatoFecha(f.desde, corta)}.</p>
              {f.stock_minimo !== null ? (
                <p className="text-sm text-humo">
                  Se avisa desde {textoStock(f, f.stock_minimo)}.{falta !== null ? ` Para volver al mínimo faltan ${textoStock(f, falta)}.` : ""}
                </p>
              ) : null}
              {f.compras_sin_calcular > 0 ? (
                <Aviso tipo="atencion">
                  {f.compras_sin_calcular === 1 ? "Una compra de este producto no se pudo sumar" : `${f.compras_sin_calcular} compras de este producto no se pudieron sumar`}: no dicen cuántos {f.presentacion ? `${f.presentacion}s` : "envases"} entraron
                  {f.presentacion ? "" : " o falta definir cómo viene el producto (abajo, «Presentación»)"}. Corrígelas en Compras para que el inventario cuadre.
                </Aviso>
              ) : null}
              {f.aplicaciones_sin_dosis > 0 ? (
                <Aviso tipo="info">
                  {f.aplicaciones_sin_dosis === 1 ? "Una aplicación" : `${f.aplicaciones_sin_dosis} aplicaciones`} de este producto no tiene dosis y no descuenta del inventario.
                </Aviso>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <Insignia tono="neutro">{ETIQUETA_ESTADO_STOCK.sin_contar}</Insignia>
              <p className="text-[0.9375rem] text-humo">Este producto todavía no se cuenta. Haz el conteo de apertura (cuánto hay hoy en la bodega) y desde ese día la app suma las compras y resta las aplicaciones.</p>
            </div>
          )}
          {puedeMover ? (
            <div className="mt-4 space-y-2">
              {f.desde ? (
                <>
                  <Link href={`/inventario/${id}/ajustar`} className={clasesBoton("primario")}>
                    <SlidersHorizontal className="size-5" strokeWidth={2} aria-hidden="true" /> Ajustar existencias
                  </Link>
                  <Link href={`/inventario/${id}/apertura`} className={clasesBoton("secundario")}>
                    <ClipboardList className="size-5" strokeWidth={2} aria-hidden="true" /> Corregir el conteo de apertura
                  </Link>
                </>
              ) : (
                <Link href={`/inventario/${id}/apertura`} className={clasesBoton("primario")}>
                  <ClipboardList className="size-5" strokeWidth={2} aria-hidden="true" /> Hacer el conteo de apertura
                </Link>
              )}
            </div>
          ) : null}
        </Tarjeta>

        {f.desde ? (
          <Tarjeta titulo="Lotes">
            {filasLote.length === 0 ? (
              <p className="text-[0.9375rem] text-humo">No hay lotes con existencias.</p>
            ) : (
              <ul className="divide-y divide-arena">
                {filasLote.map((l) => {
                  const venc = estadoVencimiento(l.vencimiento, hoy);
                  return (
                    <li key={l.lote ?? "sin-lote"} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-semibold [overflow-wrap:anywhere]">{l.lote ?? "Sin lote"}</p>
                        <p className="text-sm text-humo">{l.vencimiento ? `Vence el ${formatoFecha(l.vencimiento, corta)}` : "Sin fecha de vencimiento"}</p>
                        {venc === "vencido" ? <Insignia tono="alerta">Vencido</Insignia> : venc === "pronto" ? <Insignia tono="aviso">Vence pronto</Insignia> : null}
                      </div>
                      <p className={`shrink-0 text-right font-semibold ${l.stock < 0 ? "text-rojo" : ""}`}>{textoStock(f, l.stock)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
            {sinLote && sinLote.stock < 0 ? <p className="mt-2 text-sm text-humo">«Sin lote» en negativo son aplicaciones que no dijeron de qué lote salieron. El total del producto es el que cuenta.</p> : null}
          </Tarjeta>
        ) : null}

        <Tarjeta titulo="Presentación y mínimo">
          {puedeMover ? (
            <FormPresentacion productoId={id} unidad={f.unidad} presentacion={f.presentacion} contenido={f.contenido_presentacion} minimo={f.stock_minimo} />
          ) : (
            <p className="text-[0.9375rem] text-humo">
              {f.presentacion && f.contenido_presentacion ? `Viene en ${f.presentacion} de ${f.contenido_presentacion} ${f.unidad ?? "unidades"}.` : "Todavía no se definió cómo viene este producto."}
            </p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Conteos y ajustes">
          {conteos.error ? (
            <Aviso tipo="error">{mensajeAmigable(conteos.error.message)}</Aviso>
          ) : (conteos.data ?? []).length === 0 ? (
            <p className="text-[0.9375rem] text-humo">Todavía no hay conteos de este producto.</p>
          ) : (
            <ul className="divide-y divide-arena">
              {(conteos.data ?? []).map((m) => (
                <li key={m.id} className="space-y-1 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                      {m.tipo === "apertura" ? "Conteo de apertura" : (ETIQUETA_MOTIVO_AJUSTE[m.motivo ?? "otro"] ?? "Ajuste")}
                      {m.lote ? ` · Lote ${m.lote}` : ""}
                    </p>
                    <p className={`shrink-0 font-semibold ${m.cantidad < 0 ? "text-rojo" : ""}`}>
                      {m.tipo === "ajuste" && m.cantidad > 0 ? "+" : ""}
                      {textoStock(f, m.cantidad)}
                    </p>
                  </div>
                  <p className="text-sm text-humo">{formatoFecha(m.fecha, corta)}</p>
                  {m.observaciones ? <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{m.observaciones}</p> : null}
                  {puedeMover ? (
                    <EliminarRegistro
                      etiqueta={m.tipo === "apertura" ? "Eliminar este lote del conteo" : "Eliminar este ajuste"}
                      resumen={m.tipo === "apertura" ? `el conteo de apertura${m.lote ? ` del lote ${m.lote}` : ""}` : `el ajuste del ${formatoFecha(m.fecha, corta)}`}
                      consecuencia={m.tipo === "apertura" ? "Si era el único, el producto vuelve a «Por contar»" : undefined}
                      accion={eliminarConteo.bind(null, m.id)}
                      destino={`/inventario/${id}`}
                      mensaje="Conteo eliminado"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
