"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { crearCanal, editarCanal } from "@/app/(app)/carne/actions";
import { CONFORMACIONES, ENGRASAMIENTOS, ETIQUETA_CONFORMACION, ETIQUETA_ENGRASAMIENTO, ETIQUETA_GRASA_VISCERAL, GRASAS_VISCERALES, pctUno } from "@/lib/carne";
import { leerNumero } from "@/lib/numeros";
import type { Canal, Conformacion, GrasaVisceral } from "@/lib/tipos";

const coma = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/**
 * Registrar o corregir la canal de un animal sacrificado: pesos (vivo, canal caliente y fría) y la tipificación (conformación, grasa).
 * Con los pesos se calcula el rendimiento en canal, que es lo que dice qué tan bien rinde cada animal.
 */
export function FormCanal({
  animalId,
  hoy,
  canal,
  fechaBaja,
  pesoVivoInicial,
  plantaInicial,
  solicitud,
}: {
  animalId: string;
  hoy: string;
  canal?: Canal;
  /** Fecha del sacrificio registrada en la baja: es la que se propone. */
  fechaBaja?: string;
  /** Peso en vivo que quedó en la salida del animal, para no escribirlo dos veces. */
  pesoVivoInicial?: number | null;
  plantaInicial?: string | null;
  solicitud?: string;
}) {
  const editando = Boolean(canal);
  const [estado, enviar, pendiente] = useActionState(editando ? editarCanal : crearCanal, undefined);
  const [, iniciar] = useTransition();
  const [vivo, setVivo] = useState(coma(canal?.peso_vivo_kg ?? pesoVivoInicial));
  const [caliente, setCaliente] = useState(coma(canal?.peso_canal_caliente_kg));
  const [fria, setFria] = useState(coma(canal?.peso_canal_fria_kg));
  const [conformacion, setConformacion] = useState<Conformacion | "">(canal?.conformacion ?? "");
  const [engrasamiento, setEngrasamiento] = useState<string>(canal?.engrasamiento ? String(canal.engrasamiento) : "");
  const [visceral, setVisceral] = useState<GrasaVisceral | "">(canal?.grasa_visceral ?? "");

  const nVivo = leerNumero(vivo);
  const nCaliente = leerNumero(caliente);
  const nFria = leerNumero(fria);
  const rendimiento = nVivo && nCaliente && nVivo > 0 ? (nCaliente * 100) / nVivo : null;
  const rendimientoFrio = nVivo && nFria && nVivo > 0 ? (nFria * 100) / nVivo : null;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="animal_id" value={animalId} />
      {canal ? <input type="hidden" name="canal_id" value={canal.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Fecha del beneficio">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={canal?.fecha ?? fechaBaja ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Peso en vivo (kg)" ayuda="Lo que pesó el animal antes del sacrificio. Con él se calcula el rendimiento.">
        {(id) => <input id={id} name="peso_vivo_kg" value={vivo} onChange={(e) => setVivo(e.target.value)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 36,5" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Peso de la canal caliente (kg)" ayuda="La canal recién sacrificada, antes de enfriarse.">
        {(id) => <input id={id} name="peso_canal_caliente_kg" value={caliente} onChange={(e) => setCaliente(e.target.value)} inputMode="decimal" autoComplete="off" enterKeyHint="next" required placeholder="Ej. 17,8" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Peso de la canal fría (kg)" ayuda="Opcional. Después de oreo o refrigeración (unas 24 horas).">
        {(id) => <input id={id} name="peso_canal_fria_kg" value={fria} onChange={(e) => setFria(e.target.value)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 17,3" className={CLASE_INPUT} />}
      </Campo>

      {rendimiento !== null || rendimientoFrio !== null ? (
        <p className="-mt-2 text-sm font-semibold">
          {rendimiento !== null ? `Rendimiento en canal caliente: ${pctUno(Math.round(rendimiento * 10) / 10)}` : ""}
          {rendimiento !== null && rendimientoFrio !== null ? " · " : ""}
          {rendimientoFrio !== null ? `en frío: ${pctUno(Math.round(rendimientoFrio * 10) / 10)}` : ""}
        </p>
      ) : null}

      <Campo etiqueta="Conformación" ayuda="Opcional. Qué tan musculosa es la canal (escala EUROP).">
        {(id) => (
          <Selector id={id} nombre="conformacion" valor={conformacion} onCambio={setConformacion} titulo="Conformación de la canal" placeholder="Sin especificar" permitirVacio opciones={CONFORMACIONES.map((c) => ({ valor: c, etiqueta: ETIQUETA_CONFORMACION[c] }))} />
        )}
      </Campo>

      <Campo etiqueta="Engrasamiento" ayuda="Opcional. Cuánta grasa cubre la canal: lo ideal es media, sin excesos.">
        {(id) => (
          <Selector id={id} nombre="engrasamiento" valor={engrasamiento} onCambio={(v) => setEngrasamiento(String(v))} titulo="Engrasamiento de la canal" placeholder="Sin especificar" permitirVacio opciones={ENGRASAMIENTOS.map((n) => ({ valor: String(n), etiqueta: ETIQUETA_ENGRASAMIENTO[n] }))} />
        )}
      </Campo>

      <Campo etiqueta="Grasa dorsal (mm)" ayuda="Opcional. El espesor de la grasa sobre el lomo.">
        {(id) => <input id={id} name="grasa_dorsal_mm" defaultValue={coma(canal?.grasa_dorsal_mm)} inputMode="decimal" autoComplete="off" enterKeyHint="next" placeholder="Ej. 4,5" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Grasa visceral" ayuda="Opcional. La grasa de las vísceras; mucha le resta valor.">
        {(id) => (
          <Selector id={id} nombre="grasa_visceral" valor={visceral} onCambio={setVisceral} titulo="Grasa visceral" placeholder="Sin especificar" permitirVacio opciones={GRASAS_VISCERALES.map((g) => ({ valor: g, etiqueta: ETIQUETA_GRASA_VISCERAL[g] }))} />
        )}
      </Campo>

      <Campo etiqueta="Planta o lugar del beneficio" ayuda="Opcional.">
        {(id) => <input id={id} name="planta" defaultValue={canal?.planta ?? plantaInicial ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={canal?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar canal"}
        </Boton>
        <Link href={`/hato/${animalId}#salida`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
