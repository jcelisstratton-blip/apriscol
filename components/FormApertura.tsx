"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { guardarApertura } from "@/app/(app)/inventario/actions";
import { plural, unidadDeConteo, type FilaInventario } from "@/lib/inventario";

type FilaLote = { id: string; lote: string; vencimiento: string; cantidad: string };
const coma = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * El conteo de apertura de un producto: cuánto hay hoy en la bodega, por lote y con su vencimiento. Se cuenta en presentaciones (frascos) si el producto tiene una
 * definida; si no, en la unidad de la dosis. Con un conteo ya hecho, las filas vienen cargadas y se corrigen.
 */
export function FormApertura({
  producto,
  hoy,
  fecha,
  filas,
}: {
  producto: Pick<FilaInventario, "producto_id" | "unidad" | "presentacion" | "contenido_presentacion">;
  hoy: string;
  fecha?: string;
  filas?: { id: string; lote: string | null; vencimiento: string | null; cantidad: number }[];
}) {
  const editando = Boolean(filas && filas.length > 0);
  const u = unidadDeConteo(producto);
  const [estado, enviar, pendiente] = useActionState(guardarApertura, undefined);
  const [, iniciar] = useTransition();
  const [lineas, setLineas] = useState<FilaLote[]>(
    filas && filas.length > 0 ? filas.map((f) => ({ id: f.id, lote: f.lote ?? "", vencimiento: f.vencimiento ?? "", cantidad: coma(f.cantidad / u.factor) })) : [{ id: "", lote: "", vencimiento: "", cantidad: "" }],
  );
  const cambiar = (i: number, parte: Partial<FilaLote>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...parte } : l)));
  const completo = lineas.every((l) => l.cantidad.trim() !== "");

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="producto_id" value={producto.producto_id} />
      <Campo etiqueta="Fecha del conteo" ayuda="Desde este día la app suma las compras y resta las aplicaciones. Lo anterior no cuenta.">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Lo que hay, por lote</p>
        {lineas.map((l, i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-papel p-3 ring-1 ring-arena">
            <input type="hidden" name="id" value={l.id} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-humo">Lote {i + 1}</p>
              {!l.id && lineas.length > 1 ? (
                <button type="button" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-rojo">
                  <X className="size-4" strokeWidth={2} aria-hidden="true" /> Quitar
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <Campo etiqueta="Número de lote" ayuda="Opcional. Está en la etiqueta.">
                {(id) => <input id={id} name="lote" value={l.lote} onChange={(e) => cambiar(i, { lote: e.target.value })} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
              </Campo>
              <Campo etiqueta="Vence" ayuda="Opcional.">
                {(id) => <input id={id} name="vencimiento" type="date" value={l.vencimiento} onChange={(e) => cambiar(i, { vencimiento: e.target.value })} className={CLASE_INPUT} />}
              </Campo>
            </div>
            <Campo etiqueta={`¿Cuántos ${plural(u.nombre, 2)} hay?`} ayuda={u.factor !== 1 ? `Cada ${u.nombre} trae ${coma(u.factor)} ${producto.unidad ?? "unidades"}. Puedes escribir decimales: 2,5.` : "Puede ser 0 si no hay."}>
              {(id) => <input id={id} name="cantidad" value={l.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value })} inputMode="decimal" autoComplete="off" required className={CLASE_INPUT} placeholder="Ej. 3" />}
            </Campo>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLineas((ls) => [...ls, { id: "", lote: "", vencimiento: "", cantidad: "" }])}
          className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" /> Agregar otro lote
        </button>
      </div>

      {!completo ? <Aviso tipo="atencion">Escribe cuánto hay en cada lote (puede ser 0).</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={!completo}>
          {editando ? "Guardar cambios" : "Guardar conteo de apertura"}
        </Boton>
        <Link href={`/inventario/${producto.producto_id}`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
