"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { crearServicio, editarServicio } from "@/app/(app)/reproduccion/actions";
import { formatoFecha, sumarDias } from "@/lib/fechas";
import { ESCENA_TIPO_SERVICIO } from "@/lib/escenas-forms-b-reproduccion";
import { ETIQUETA_SERVICIO, TIPOS_SERVICIO } from "@/lib/reproduccion";
import type { Especie, Servicio, TipoServicio } from "@/lib/tipos";

type Macho = { id: string; numero_arete: string; nombre: string | null };

/** Registrar o corregir un servicio (monta, inseminación o transferencia) de una hembra. Muestra la fecha prevista del parto. */
export function FormServicio({
  fincaId,
  hembraId,
  especie,
  gestacionDias,
  hoy,
  servicio,
  machoInicial,
  solicitud,
}: {
  fincaId: string;
  hembraId: string;
  especie: Especie;
  gestacionDias: number;
  hoy: string;
  servicio?: Servicio;
  machoInicial?: Macho | null;
  solicitud?: string;
}) {
  const editando = Boolean(servicio);
  const [estado, enviar, pendiente] = useActionState(editando ? editarServicio : crearServicio, undefined);
  const [, iniciar] = useTransition();
  const [fecha, setFecha] = useState(servicio?.fecha ?? hoy);
  const [tipo, setTipo] = useState<TipoServicio>(servicio?.tipo ?? "monta_natural");
  const [macho, setMacho] = useState<Macho | null>(machoInicial ?? null);
  const [externo, setExterno] = useState(Boolean(servicio?.macho_externo));
  const prevista = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? sumarDias(fecha, gestacionDias) : null;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="hembra_id" value={hembraId} />
      {servicio ? <input type="hidden" name="servicio_id" value={servicio.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Fecha del servicio">
        {(id) => <input id={id} name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Tipo de servicio">
        {(id) => <SelectorTarjetas id={id} nombre="tipo" valor={tipo} onCambio={(v) => v && setTipo(v)} titulo="¿Cómo fue el servicio?" opciones={TIPOS_SERVICIO.map((t) => ({ valor: t, etiqueta: ETIQUETA_SERVICIO[t], escena: ESCENA_TIPO_SERVICIO[t] }))} />}
      </Campo>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Reproductor</p>
        {externo ? (
          <Campo etiqueta="Macho de otra finca o semen" ayuda="Escribe su nombre o su código.">
            {(id) => <input id={id} name="macho_externo" defaultValue={servicio?.macho_externo ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
        ) : (
          <SelectorAnimal nombre="macho_id" fincaId={fincaId} sexo="macho" especie={especie} titulo="Reproductor de tu hato" valor={macho} onCambio={setMacho} vacio="Sin registrar" />
        )}
        <button type="button" onClick={() => { setExterno((x) => !x); setMacho(null); }} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
          {externo ? "Elegir un reproductor de mi hato" : "Es un macho de otra finca o semen"}
        </button>
      </div>

      {tipo !== "monta_natural" ? (
        <Campo etiqueta="Lote del semen" ayuda="Opcional.">
          {(id) => <input id={id} name="semen_lote" defaultValue={servicio?.semen_lote ?? ""} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <Campo etiqueta="Responsable" ayuda="Opcional. Quién hizo el servicio.">
        {(id) => <input id={id} name="responsable" defaultValue={servicio?.responsable ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      {prevista ? <Aviso tipo="info">Si queda gestante, el parto se espera hacia el {formatoFecha(prevista)} ({gestacionDias} días).</Aviso> : null}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={servicio?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar servicio"}
        </Boton>
        <Link href={`/hato/${hembraId}#reproduccion`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
