"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CamposFeria } from "@/components/CamposFeria";
import { FotoPremio } from "@/components/FotoPremio";
import { Selector } from "@/components/Selector";
import { crearParticipacion, editarParticipacion } from "@/app/(app)/ferias/actions";
import { ETIQUETA_RESULTADO, RESULTADOS } from "@/lib/ferias";
import { formatoFecha } from "@/lib/fechas";
import type { ResultadoFeria } from "@/lib/tipos";

type Ref = { id: string; numero_arete: string; nombre: string | null };
type FeriaOpcion = { id: string; nombre: string; fecha_inicio: string };

/** Un premio ya registrado, para corregirlo. */
export type ParticipacionEditable = {
  id: string;
  feria_id: string;
  categoria: string;
  resultado: ResultadoFeria;
  puesto: number | null;
  puntaje: number | null;
  premio_descripcion: string | null;
  premio_en_dinero: number | null;
  foto: { path: string; url: string } | null;
  observaciones: string | null;
};

const NUEVA = "nueva";
const coma = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** El premio siempre es de un animal: se llega desde su ficha y el animal viene fijo (no se elige aquí). */
export function FormParticipacion({
  ferias,
  animal,
  solicitud,
  participacion,
}: {
  ferias: FeriaOpcion[];
  animal: Ref;
  /** Solo al crear: identifica la apertura del formulario para ignorar un doble toque. */
  solicitud?: string;
  /** Si viene, el formulario corrige este premio en lugar de crear uno nuevo. */
  participacion?: ParticipacionEditable;
}) {
  const editando = Boolean(participacion);
  const [estado, enviar, pendiente] = useActionState(editando ? editarParticipacion : crearParticipacion, undefined);
  const [, iniciar] = useTransition();
  // Sin ferias registradas (o si la persona lo pide) la feria se crea aquí mismo, junto con el premio.
  const [feria, setFeria] = useState<string>(participacion?.feria_id ?? (ferias.length === 0 ? NUEVA : ""));
  const [resultado, setResultado] = useState<ResultadoFeria>(participacion?.resultado ?? "participacion");
  const [subiendo, setSubiendo] = useState(false);

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="animal_id" value={animal.id} />
      {participacion ? <input type="hidden" name="participacion_id" value={participacion.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <div className="space-y-2">
        <span className="block text-sm font-semibold">Foto del premio</span>
        <FotoPremio nombre="foto_path" onEstado={setSubiendo} inicial={participacion?.foto ?? null} />
      </div>

      <Campo etiqueta="Resultado">
        {(id) => (
          <Selector
            id={id}
            nombre="resultado"
            valor={resultado}
            onCambio={(v) => v && setResultado(v)}
            titulo="Resultado del jurado"
            opciones={RESULTADOS.map((r) => ({ valor: r, etiqueta: ETIQUETA_RESULTADO[r] }))}
          />
        )}
      </Campo>

      <Campo etiqueta="Premio recibido" ayuda="Trofeo, copa, banda, placa… Opcional.">
        {(id) => <input id={id} name="premio_descripcion" defaultValue={participacion?.premio_descripcion ?? ""} maxLength={200} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>
      <Campo etiqueta="Premio en dinero" ayuda="Opcional, en pesos.">
        {(id) => <input id={id} name="premio_en_dinero" defaultValue={participacion?.premio_en_dinero ?? ""} inputMode="numeric" autoComplete="off" className={CLASE_INPUT} placeholder="0" />}
      </Campo>

      <Campo etiqueta="Categoría" ayuda="Tal como la publicó la feria.">
        {(id) => <input id={id} name="categoria" defaultValue={participacion?.categoria} required maxLength={160} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. Hembra joven en leche" />}
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Puesto" ayuda="Opcional.">
          {(id) => <input id={id} name="puesto" defaultValue={participacion?.puesto ?? ""} inputMode="numeric" pattern="[0-9]*" maxLength={2} autoComplete="off" className={CLASE_INPUT} placeholder="1" />}
        </Campo>
        <Campo etiqueta="Puntaje" ayuda="Opcional.">
          {(id) => <input id={id} name="puntaje" defaultValue={coma(participacion?.puntaje ?? null)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="92,5" />}
        </Campo>
      </div>

      <Campo etiqueta="Feria">
        {(id) => (
          <Selector
            id={id}
            nombre="feria_id"
            valor={feria}
            onCambio={(v) => setFeria(String(v))}
            titulo="¿En qué feria?"
            placeholder="Elegir feria"
            opciones={[
              ...(editando ? [] : [{ valor: NUEVA, etiqueta: "Registrar una feria nueva", detalle: "Si no está en la lista" }]),
              ...ferias.map((f) => ({ valor: f.id, etiqueta: f.nombre, detalle: formatoFecha(f.fecha_inicio) })),
            ]}
          />
        )}
      </Campo>

      {feria === NUEVA ? (
        <div className="space-y-5 rounded-3xl border border-arena p-4">
          <CamposFeria />
        </div>
      ) : null}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={participacion?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={subiendo || !feria}>
          {subiendo ? "Esperando la foto…" : editando ? "Guardar cambios" : "Guardar participación"}
        </Boton>
        {participacion ? (
          <Link href={`/hato/${animal.id}`} className={clasesBoton("fantasma")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
