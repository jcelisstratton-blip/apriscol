"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { editarMovimiento } from "@/app/(app)/hato/corrales/actions";
import { ETIQUETA_MOTIVO, ETIQUETA_TIPO_UBICACION, ETIQUETA_USO, MOTIVOS, textoOcupacion } from "@/lib/corrales";
import { formatoFecha } from "@/lib/fechas";
import type { MotivoMovimiento } from "@/lib/tipos";
import type { UbicacionOpcion } from "@/components/FormMover";

export type DatosMovimiento = { id: string; ubicacion_id: string; desde: string; hasta: string | null; motivo: MotivoMovimiento; observaciones: string | null };

/**
 * Corregir un movimiento de un animal (por ejemplo, lo pasaron a otro corral y se registró en el equivocado). Si el movimiento sigue abierto y se
 * cambia de instalación, el nuevo destino tiene que tener cupo; en uno que ya terminó es solo el historial y no cuenta el cupo.
 */
export function FormMovimiento({ movimiento, ubicaciones, hoy, volver, volverA }: { movimiento: DatosMovimiento; ubicaciones: UbicacionOpcion[]; hoy: string; volver: string; volverA?: string }) {
  const [estado, enviar, pendiente] = useActionState(editarMovimiento, undefined);
  const [, iniciar] = useTransition();
  const [destino, setDestino] = useState(movimiento.ubicacion_id);
  const [motivo, setMotivo] = useState<MotivoMovimiento>(movimiento.motivo);
  const abierto = movimiento.hasta === null;
  const elDestino = ubicaciones.find((u) => u.id === destino);
  const cambia = destino !== movimiento.ubicacion_id;
  const libres = elDestino?.capacidad ? Math.max(0, elDestino.capacidad - elDestino.ocupantes) : null;
  const sinCupo = abierto && cambia && libres !== null && libres < 1;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="movimiento_id" value={movimiento.id} />
      {volverA ? <input type="hidden" name="volver" value={volverA} /> : null}
      <input type="hidden" name="ubicacion_id" value={destino} />

      <Campo etiqueta="Instalación">
        {(id) => (
          <Selector
            id={id}
            valor={destino}
            onCambio={(v) => v && setDestino(String(v))}
            titulo="¿En qué instalación estuvo?"
            opciones={ubicaciones.map((u) => ({
              valor: u.id,
              etiqueta: u.nombre,
              detalle: `${ETIQUETA_TIPO_UBICACION[u.tipo]} · ${ETIQUETA_USO[u.uso]} · ${textoOcupacion(u.ocupantes, u.capacidad)}`,
            }))}
          />
        )}
      </Campo>
      {sinCupo && elDestino ? (
        <Aviso tipo="atencion">
          {elDestino.nombre} está llena: caben {elDestino.capacidad} animales y ya tiene {elDestino.ocupantes}. Elige otra instalación o saca a algunos antes.
        </Aviso>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Campo etiqueta="Entró el" ayuda={movimiento.hasta ? `Salió el ${formatoFecha(movimiento.hasta)}.` : "Sigue ahí."}>
          {(id) => <input id={id} name="desde" type="date" defaultValue={movimiento.desde} max={movimiento.hasta ?? hoy} required className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Motivo">
          {(id) => <Selector id={id} nombre="motivo" valor={motivo} onCambio={(v) => v && setMotivo(v)} titulo="Motivo" opciones={MOTIVOS.map((m) => ({ valor: m, etiqueta: ETIQUETA_MOTIVO[m] }))} />}
        </Campo>
      </div>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={movimiento.observaciones ?? ""} rows={2} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={sinCupo}>Guardar cambios</Boton>
        <Link href={volver} className={clasesBoton("fantasma")}>Cancelar</Link>
      </div>
    </form>
  );
}
