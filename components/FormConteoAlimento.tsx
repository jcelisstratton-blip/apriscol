"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { guardarConteoAlimento } from "@/app/(app)/inventario/alimento/actions";
import { ESCENA_MOTIVO_AJUSTE } from "@/lib/escenas-inventario";
import { DETALLE_MOTIVO_AJUSTE, ETIQUETA_MOTIVO_AJUSTE, cambioDeAjuste } from "@/lib/inventario";
import { MOTIVOS_AJUSTE_ALIMENTO, aKg, singular, textoKg, unidadesDeCantidad, type FilaAlimento, type MotivoAjusteAlimento } from "@/lib/inventario-alimento";
import { leerNumero } from "@/lib/numeros";

/**
 * El conteo de un alimento. La primera vez es la apertura (cuánto hay hoy); después, un ajuste: lo que contaste frente a lo que decía la app, o una baja por
 * pérdida o daño. Se cuenta en kg o, si se sabe cuánto pesa cada bulto o paca, en esas unidades.
 */
export function FormConteoAlimento({ alimento, hoy }: { alimento: FilaAlimento; hoy: string }) {
  const apertura = alimento.desde === null;
  const [estado, enviar, pendiente] = useActionState(guardarConteoAlimento, undefined);
  const [, iniciar] = useTransition();
  const [motivo, setMotivo] = useState<MotivoAjusteAlimento>("conteo");
  const [unidad, setUnidad] = useState("kg");
  const [cantidad, setCantidad] = useState("");
  const unidades = unidadesDeCantidad(alimento);
  const actual = unidades.find((u) => u.valor === unidad) ?? unidades[0];
  const n = cantidad.trim() ? leerNumero(cantidad) : null;
  const cambio = !apertura && n !== null && n >= 0 ? cambioDeAjuste(motivo, aKg(n, actual.factor), alimento.stock_kg ?? 0) : null;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="producto_id" value={alimento.producto_id} />
      <input type="hidden" name="motivo" value={apertura ? "conteo" : motivo} />
      <input type="hidden" name="unidad" value={unidad} />

      {!apertura ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">¿Por qué ajustas?</p>
          <SelectorTarjetas<MotivoAjusteAlimento>
            valor={motivo}
            onCambio={(v) => v && setMotivo(v)}
            titulo="¿Por qué ajustas?"
            opciones={MOTIVOS_AJUSTE_ALIMENTO.map((m) => ({ valor: m, etiqueta: ETIQUETA_MOTIVO_AJUSTE[m], detalle: DETALLE_MOTIVO_AJUSTE[m], escena: ESCENA_MOTIVO_AJUSTE[m] }))}
          />
        </div>
      ) : (
        <Aviso tipo="info">Cuenta lo que hay hoy en la bodega. Desde este día la app suma las compras y resta lo que se dé de comer.</Aviso>
      )}

      <div className="space-y-2">
        {unidades.length > 1 ? (
          <FilaDesplazable>
            {unidades.map((u) => (
              <Chip key={u.valor} activo={unidad === u.valor} onClick={() => setUnidad(u.valor)}>
                En {u.nombre}
              </Chip>
            ))}
          </FilaDesplazable>
        ) : null}
        <Campo
          etiqueta={apertura ? `¿Cuántos ${actual.nombre} hay?` : motivo === "conteo" ? `¿Cuántos ${actual.nombre} contaste?` : `¿Cuántos ${actual.nombre} se descartan?`}
          ayuda={actual.factor !== 1 ? `Cada ${singular(actual.nombre)} pesa ${actual.factor} kg. Puedes escribir decimales: 2,5.` : apertura ? "Puede ser 0 si no hay." : undefined}
        >
          {(id) => <input id={id} name="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" autoComplete="off" required className={CLASE_INPUT} placeholder="Ej. 400" />}
        </Campo>
      </div>

      {!apertura && n !== null && n >= 0 ? (
        <div aria-live="polite">
          {cambio === null ? (
            <Aviso tipo="info">Coincide con lo que dice la app: no hay nada que ajustar.</Aviso>
          ) : (
            <Aviso tipo={cambio < 0 ? "atencion" : "info"}>
              La app decía {textoKg(alimento, alimento.stock_kg ?? 0)}. El inventario {cambio < 0 ? "baja" : "sube"} {textoKg(alimento, Math.abs(cambio))}.
            </Aviso>
          )}
        </div>
      ) : null}

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>
      <Campo etiqueta="Observaciones" ayuda={!apertura && motivo === "otro" ? "Cuéntanos el motivo." : "Opcional."}>
        {(id) => <textarea id={id} name="observaciones" rows={2} maxLength={300} required={!apertura && motivo === "otro"} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={!cantidad.trim()}>
          {apertura ? "Guardar conteo de apertura" : "Guardar ajuste"}
        </Boton>
        <Link href={`/inventario/alimento/${alimento.producto_id}`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
