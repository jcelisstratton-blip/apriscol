"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { guardarAjuste } from "@/app/(app)/inventario/actions";
import { ESCENA_MOTIVO_AJUSTE } from "@/lib/escenas-inventario";
import { DETALLE_MOTIVO_AJUSTE, ETIQUETA_MOTIVO_AJUSTE, MOTIVOS_AJUSTE, aUnidades, cambioDeAjuste, plural, textoStock, unidadDeConteo, type FilaInventario, type FilaLote, type MotivoAjuste } from "@/lib/inventario";
import { leerNumero } from "@/lib/numeros";
import { formatoFecha } from "@/lib/fechas";

const SIN_LOTE = "__sin_lote__";

/** Corregir las existencias de un producto: lo que contaste frente a lo que decía la app, o dar de baja lo vencido, perdido o dañado. */
export function FormAjuste({ producto, lotes, hoy, inicial }: { producto: Pick<FilaInventario, "producto_id" | "unidad" | "presentacion" | "contenido_presentacion">; lotes: FilaLote[]; hoy: string; /** Lo que ya se sabe al venir de un aviso: motivo, lote y cantidad. */ inicial?: { motivo: MotivoAjuste; lote: string | null; cantidad: string } | null }) {
  const u = unidadDeConteo(producto);
  const [estado, enviar, pendiente] = useActionState(guardarAjuste, undefined);
  const [, iniciar] = useTransition();
  const [motivo, setMotivo] = useState<MotivoAjuste>(inicial?.motivo ?? "conteo");
  // «Sin lote» es un lote más (las aplicaciones sin lote restan ahí); se distingue de «no he elegido» con un valor propio.
  const clave = (l: FilaLote) => l.lote ?? SIN_LOTE;
  const [lote, setLote] = useState<string>(inicial ? (inicial.lote ?? SIN_LOTE) : lotes.length === 1 ? clave(lotes[0]) : "");
  const [cantidad, setCantidad] = useState(inicial?.cantidad ?? "");

  const elegido = lotes.find((l) => clave(l) === lote);
  const n = cantidad.trim() ? leerNumero(cantidad) : null;
  const cambio = n !== null && n >= 0 && elegido ? cambioDeAjuste(motivo, aUnidades(n, u.factor), elegido.stock) : null;
  const hayLoteElegible = lotes.length > 0;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="producto_id" value={producto.producto_id} />
      <input type="hidden" name="motivo" value={motivo} />
      <input type="hidden" name="lote" value={lote === SIN_LOTE ? "" : lote} />

      {inicial && elegido ? (
        <Aviso tipo="atencion">
          Vas a dar de baja el lote {elegido.lote ?? "sin nombre"}
          {elegido.vencimiento ? `, vencido el ${formatoFecha(elegido.vencimiento, { day: "numeric", month: "short", year: "numeric" })}` : ""}: quedan {textoStock(producto, elegido.stock)}. Ya está todo elegido; revisa la cantidad y guarda.
        </Aviso>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-semibold">¿Por qué ajustas?</p>
        <SelectorTarjetas<MotivoAjuste>
          valor={motivo}
          onCambio={(v) => v && setMotivo(v)}
          titulo="¿Por qué ajustas?"
          opciones={MOTIVOS_AJUSTE.map((m) => ({ valor: m, etiqueta: ETIQUETA_MOTIVO_AJUSTE[m], detalle: DETALLE_MOTIVO_AJUSTE[m], escena: ESCENA_MOTIVO_AJUSTE[m] }))}
        />
      </div>

      {hayLoteElegible ? (
        <Campo etiqueta="Lote" ayuda="El lote que estás contando o dando de baja.">
          {(id) => (
            <Selector
              id={id}
              valor={lote}
              onCambio={(v) => setLote(String(v))}
              titulo="¿De qué lote?"
              placeholder="Elegir lote"
              opciones={lotes.map((l) => ({
                valor: clave(l),
                etiqueta: l.lote ?? "Sin lote",
                detalle: `Quedan ${textoStock(producto, l.stock)}${l.vencimiento ? ` · vence el ${formatoFecha(l.vencimiento, { day: "numeric", month: "short", year: "numeric" })}` : ""}`,
              }))}
            />
          )}
        </Campo>
      ) : null}

      <Campo
        etiqueta={motivo === "conteo" ? `¿Cuántos ${plural(u.nombre, 2)} contaste?` : `¿Cuántos ${plural(u.nombre, 2)} se descartan?`}
        ayuda={motivo === "conteo" ? "Lo que hay físicamente ahora en ese lote." : "Lo que sale del inventario."}
      >
        {(id) => <input id={id} name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" autoComplete="off" required className={CLASE_INPUT} placeholder="Ej. 2" />}
      </Campo>

      {elegido && n !== null && n >= 0 ? (
        <div aria-live="polite">
          {cambio === null ? (
            <Aviso tipo="info">Coincide con lo que dice la app: no hay nada que ajustar.</Aviso>
          ) : (
            <Aviso tipo={cambio < 0 ? "atencion" : "info"}>
              La app decía {textoStock(producto, elegido.stock)}. El inventario {cambio < 0 ? "baja" : "sube"} {textoStock(producto, Math.abs(cambio))}.
            </Aviso>
          )}
        </div>
      ) : null}

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>
      <Campo etiqueta="Observaciones" ayuda={motivo === "otro" ? "Cuéntanos el motivo." : "Opcional."}>
        {(id) => <textarea id={id} name="observaciones" rows={2} maxLength={300} required={motivo === "otro"} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={!cantidad.trim() || (hayLoteElegible && !elegido)}>
          Guardar ajuste
        </Boton>
        <Link href={`/inventario/${producto.producto_id}`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
