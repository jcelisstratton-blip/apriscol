import Link from "next/link";
import { ClipboardList, SlidersHorizontal } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { clasesBoton } from "@/components/Boton";
import { EliminarRegistro } from "@/components/EliminarRegistro";
import { FormPresentacion } from "@/components/FormPresentacion";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import { formatoFecha } from "@/lib/fechas";
import {
  DETALLE_ESTADO_STOCK,
  ETIQUETA_ESTADO_STOCK,
  ETIQUETA_MOTIVO_AJUSTE,
  estadoStock,
  estadoVencimiento,
  faltaParaMinimo,
  pasosInventario,
  textoStock,
  type EstadoStock,
  type FilaInventario,
  type FilaLote,
} from "@/lib/inventario";
import { eliminarConteo } from "@/app/(app)/inventario/actions";
import type { InventarioMovimiento } from "@/lib/tipos";

const TONO_ESTADO: Record<EstadoStock, "neutro" | "ok" | "alerta" | "aviso"> = { sin_contar: "neutro", negativo: "alerta", agotado: "alerta", bajo: "aviso", ok: "ok" };
const corta = { day: "numeric", month: "short", year: "numeric" } as const;

/** La ficha de un producto del inventario: existencias, lotes, presentación y conteos. Solo dibuja; la página trae los datos (y así se puede recorrer con datos de ejemplo). */
export function FichaInventario({ f, lotes, conteos, puedeMover, hoy }: { f: FilaInventario; lotes: FilaLote[]; conteos: InventarioMovimiento[]; puedeMover: boolean; hoy: string }) {
  const id = f.producto_id;
  const estado = estadoStock(f);
  const filasLote = lotes.filter((l) => l.lote !== null || Math.abs(l.stock) > 0.004);
  const falta = faltaParaMinimo(f);
  const sinLote = filasLote.find((l) => l.lote === null);
  const queHacer = pasosInventario(f, lotes, hoy);
  return (
      <div className="grid grid-cols-1 gap-4 lg:max-w-4xl">
        {queHacer.length > 0 ? (
          <Tarjeta titulo="Qué hacer">
            <ol className="space-y-4">
              {queHacer.map((p) => (
                <li key={p.clave} className="space-y-1">
                  <p className="font-semibold [overflow-wrap:anywhere]">{p.titulo}</p>
                  <ul className="list-disc space-y-1 pl-5 text-[0.9375rem] [overflow-wrap:anywhere]">
                    {p.pasos.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  {p.accion && puedeMover ? (
                    <Link href={p.accion.href} className={`${clasesBoton("primario")} mt-2`}>
                      {p.accion.texto}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          </Tarjeta>
        ) : null}
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
                  <p className="px-1 text-sm text-humo">Cuando lo que contaste no coincide con la app, o para dar de baja lo vencido, perdido o dañado.</p>
                  <Link href={`/inventario/${id}/apertura`} className={clasesBoton("secundario")}>
                    <ClipboardList className="size-5" strokeWidth={2} aria-hidden="true" /> Corregir el conteo de apertura
                  </Link>
                  <p className="px-1 text-sm text-humo">Solo si te equivocaste en el primer conteo (cantidad, lote o fecha de vencimiento).</p>
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
            {sinLote && sinLote.stock < 0 ? <p className="mt-2 text-sm text-humo">«Sin lote» en negativo son aplicaciones que no dijeron de qué lote salieron: no es un error por sí solo, el total del producto es el que cuenta. Para que no se repita, elige el lote al registrar cada aplicación.</p> : null}
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
          {conteos.length === 0 ? (
            <p className="text-[0.9375rem] text-humo">Todavía no hay conteos de este producto.</p>
          ) : (
            <ul className="divide-y divide-arena">
              {conteos.map((m) => (
                <li key={m.id} className="space-y-1 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                      {m.tipo === "apertura" ? "Conteo de apertura" : (ETIQUETA_MOTIVO_AJUSTE[m.motivo ?? "otro"] ?? "Ajuste")}
                      {m.lote ? ` · Lote ${m.lote}` : ""}
                    </p>
                    <p className="shrink-0 font-semibold">
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
  );
}
