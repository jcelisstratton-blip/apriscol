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
import { ESCENA_TECNICA_INSEMINACION, ESCENA_TIPO_SERVICIO, ESCENA_TIPO_TRANSFERENCIA } from "@/lib/escenas-forms-b-reproduccion";
import { DETALLE_TECNICA, DETALLE_TRANSFERENCIA, ETIQUETA_SERVICIO, ETIQUETA_TECNICA, ETIQUETA_TRANSFERENCIA, TECNICAS_INSEMINACION, TIPOS_SERVICIO, TIPOS_TRANSFERENCIA } from "@/lib/reproduccion";
import type { Especie, Servicio, TecnicaInseminacion, TipoServicio, TipoTransferencia } from "@/lib/tipos";

type Macho = { id: string; numero_arete: string; nombre: string | null };

/**
 * Registrar o corregir un servicio de una hembra. Cada tipo pide lo suyo: la monta, el reproductor; la inseminación, la pajilla, el donante y la técnica;
 * la transferencia de embrión, el embrión, el padre y la madre genéticos y su tipo (la hembra es la receptora). Muestra la fecha prevista del parto.
 */
export function FormServicio({
  fincaId,
  hembraId,
  especie,
  gestacionDias,
  hoy,
  servicio,
  machoInicial,
  madreInicial,
  solicitud,
}: {
  fincaId: string;
  hembraId: string;
  especie: Especie;
  gestacionDias: number;
  hoy: string;
  servicio?: Servicio;
  machoInicial?: Macho | null;
  madreInicial?: Macho | null;
  solicitud?: string;
}) {
  const editando = Boolean(servicio);
  const [estado, enviar, pendiente] = useActionState(editando ? editarServicio : crearServicio, undefined);
  const [, iniciar] = useTransition();
  const [fecha, setFecha] = useState(servicio?.fecha ?? hoy);
  const [tipo, setTipo] = useState<TipoServicio>(servicio?.tipo ?? "monta_natural");
  const [macho, setMacho] = useState<Macho | null>(machoInicial ?? null);
  const [externo, setExterno] = useState(Boolean(servicio?.macho_externo));
  const [madre, setMadre] = useState<Macho | null>(madreInicial ?? null);
  const [madreExterna, setMadreExterna] = useState(Boolean(servicio?.madre_genetica_externa));
  const [tecnica, setTecnica] = useState<TecnicaInseminacion | "">(servicio?.tecnica_inseminacion ?? "");
  const [transferencia, setTransferencia] = useState<TipoTransferencia | "">(servicio?.tipo_transferencia ?? "");
  const esIA = tipo === "inseminacion";
  const esET = tipo === "transferencia_embrionaria";
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
        <p className="text-sm font-semibold">{esET ? "Padre genético (semental donante)" : esIA ? "Reproductor donante (padre)" : "Reproductor"}</p>
        {externo ? (
          <Campo etiqueta={tipo === "monta_natural" ? "Macho de otra finca" : "Macho de otra finca o banco"} ayuda="Escribe su nombre o su código.">
            {(id) => <input id={id} name="macho_externo" defaultValue={servicio?.macho_externo ?? ""} maxLength={80} autoComplete="off" required className={CLASE_INPUT} />}
          </Campo>
        ) : (
          <SelectorAnimal nombre="macho_id" fincaId={fincaId} sexo="macho" especie={especie} titulo={esET ? "Padre genético de tu hato" : "Reproductor de tu hato"} valor={macho} onCambio={setMacho} vacio="Elegir un macho" />
        )}
        <button type="button" onClick={() => { setExterno((x) => !x); setMacho(null); }} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
          {externo ? "Elegir un reproductor de mi hato" : tipo === "monta_natural" ? "Es un macho de otra finca" : "Es un macho de otra finca o de un banco"}
        </button>
      </div>

      {esIA ? (
        <>
          <Campo etiqueta="Código o banco de la pajilla / lote del semen">
            {(id) => <input id={id} name="semen_lote" defaultValue={servicio?.semen_lote ?? ""} maxLength={60} autoComplete="off" required className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Tipo de inseminación">
            {(id) => <SelectorTarjetas id={id} nombre="tecnica_inseminacion" valor={tecnica} onCambio={setTecnica} titulo="¿Cómo fue la inseminación?" opciones={TECNICAS_INSEMINACION.map((t) => ({ valor: t, etiqueta: ETIQUETA_TECNICA[t], detalle: DETALLE_TECNICA[t], escena: ESCENA_TECNICA_INSEMINACION[t] }))} />}
          </Campo>
        </>
      ) : null}

      {esET ? (
        <>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Madre genética (donante del óvulo)</p>
            {madreExterna ? (
              <Campo etiqueta="Hembra de otra finca" ayuda="Escribe su nombre o su código.">
                {(id) => <input id={id} name="madre_genetica_externa" defaultValue={servicio?.madre_genetica_externa ?? ""} maxLength={80} autoComplete="off" required className={CLASE_INPUT} />}
              </Campo>
            ) : (
              <SelectorAnimal nombre="madre_genetica_id" fincaId={fincaId} sexo="hembra" especie={especie} titulo="Madre genética de tu hato" valor={madre} onCambio={setMadre} excluir={hembraId} incluirInactivos vacio="Elegir una hembra" />
            )}
            <button type="button" onClick={() => { setMadreExterna((x) => !x); setMadre(null); }} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              {madreExterna ? "Elegir una hembra de mi hato" : "Es una hembra de otra finca"}
            </button>
            <p className="text-sm text-humo">La hembra a la que se le hace el servicio es la receptora, la que gesta.</p>
          </div>
          <Campo etiqueta="Identificación del embrión / lote" ayuda="Código del embrión, fresco o congelado.">
            {(id) => <input id={id} name="embrion_codigo" defaultValue={servicio?.embrion_codigo ?? ""} maxLength={60} autoComplete="off" required className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Tipo de transferencia">
            {(id) => <SelectorTarjetas id={id} nombre="tipo_transferencia" valor={transferencia} onCambio={setTransferencia} titulo="¿Cómo estaba el embrión?" opciones={TIPOS_TRANSFERENCIA.map((t) => ({ valor: t, etiqueta: ETIQUETA_TRANSFERENCIA[t], detalle: DETALLE_TRANSFERENCIA[t], escena: ESCENA_TIPO_TRANSFERENCIA[t] }))} />}
          </Campo>
        </>
      ) : null}

      <Campo etiqueta={esIA ? "Técnico o inseminador" : esET ? "Técnico" : "Responsable"} ayuda={esIA || esET ? "Opcional. Quién hizo el procedimiento." : "Opcional. Quién hizo el servicio."}>
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
