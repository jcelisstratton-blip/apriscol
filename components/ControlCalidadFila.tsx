"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, X } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Insignia } from "@/components/Insignia";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SubirSoporte } from "@/components/SubirSoporte";
import { useToast } from "@/components/Toast";
import { guardarControl } from "@/app/(app)/controles";
import { INFO_CONTROL, VALORES_CONDICION } from "@/lib/controles";
import { ESCENA_INSPECCION } from "@/lib/escenas-forms-a-leche";
import { formatoFecha } from "@/lib/fechas";
import { direccionSoporte } from "@/lib/soportes";
import type { ControlCalidad, ResultadoControl, TipoControl } from "@/lib/tipos";

/** Un análisis de Calidad que puede respaldar un control de leche. */
export type CandidatoAnalisis = { id: string; fecha: string; resumen: string; soporte: string };

type Respuesta = "si" | "no" | "";

/**
 * Un control de calidad: qué es, cómo se mide y en qué estado está (realizado con su respaldo, no realizado con su constancia, o sin
 * responder). Quien puede escribir lo responde aquí: «Sí lo hice» pide el respaldo; «No lo hice» deja constancia de que no se hizo.
 */
export function ControlCalidadFila({
  ambito,
  id,
  tipo,
  control,
  respaldoActual,
  candidatos = [],
  nuevoAnalisis,
  fechaSugerida,
  hoy,
  puedeEditar,
  inicialAbierto = false,
}: {
  ambito: "despacho" | "animal";
  id: string;
  tipo: TipoControl;
  control: ControlCalidad | null;
  /** Control de leche ya realizado: el análisis que lo respalda. */
  respaldoActual?: CandidatoAnalisis | null;
  /** Control de leche: los análisis recientes que puede usar. */
  candidatos?: CandidatoAnalisis[];
  /** Control de leche: dirección para registrar el análisis que falta. */
  nuevoAnalisis?: string;
  fechaSugerida: string;
  hoy: string;
  puedeEditar: boolean;
  inicialAbierto?: boolean;
}) {
  const info = INFO_CONTROL[tipo];
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(inicialAbierto && !control);
  const [respuesta, setRespuesta] = useState<Respuesta>(control ? (control.estado === "realizado" ? "si" : "no") : "");
  const [analisis, setAnalisis] = useState(control?.analisis_id ?? "");
  const [fecha, setFecha] = useState(control?.fecha ?? fechaSugerida);
  const [valor, setValor] = useState(control?.valor != null ? String(control.valor) : "");
  const [resultado, setResultado] = useState<ResultadoControl | "">(control?.resultado ?? "");
  const [detalle, setDetalle] = useState(control?.detalle ?? "");
  const [motivo, setMotivo] = useState(control?.motivo ?? "");
  const [soporte, setSoporte] = useState(control?.soporte_path ?? "");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const esLeche = ambito === "despacho";
  const guardar = () => {
    if (!respuesta) return setError("Elige si lo hiciste o no.");
    setError(null);
    iniciar(async () => {
      const r = await guardarControl(
        respuesta === "no"
          ? { ambito, id, tipo, estado: "no_realizado", motivo }
          : esLeche
            ? { ambito, id, tipo, estado: "realizado", analisisId: analisis }
            : tipo === "condicion_corporal"
              ? { ambito, id, tipo, estado: "realizado", fecha, valor: valor ? Number(valor) : undefined, detalle }
              : { ambito, id, tipo, estado: "realizado", fecha, resultado: resultado || undefined, detalle, soportePath: soporte },
      );
      if (!r.ok) return setError(r.error);
      toast.exito(respuesta === "no" ? "Quedó la constancia de que no se hizo" : "Control guardado");
      setAbierto(false);
      router.refresh();
    });
  };

  const estado = control ? (control.estado === "realizado" ? { tono: "ok" as const, texto: "Realizado" } : { tono: "neutro" as const, texto: "No realizado" }) : { tono: "aviso" as const, texto: "Sin responder" };

  return (
    <section className="min-w-0 space-y-3 rounded-3xl bg-papel p-4 ring-1 ring-arena" aria-label={info.titulo}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-bold">{info.titulo}</h3>
        <Insignia tono={estado.tono}>{estado.texto}</Insignia>
      </div>
      <p className="text-[0.9375rem] text-humo">{info.comoSeMide}</p>

      {control?.estado === "realizado" && !abierto ? (
        <div className="space-y-1 text-[0.9375rem]">
          {esLeche && respaldoActual ? (
            <p className="[overflow-wrap:anywhere]">
              Análisis del {formatoFecha(respaldoActual.fecha)} · {respaldoActual.resumen}
            </p>
          ) : (
            <p>
              Hecho el {formatoFecha(control.fecha)}
              {control.valor != null ? ` · condición corporal ${control.valor.toLocaleString("es-CO")}` : ""}
              {control.resultado ? ` · ${control.resultado === "conforme" ? "sin hallazgos" : "con hallazgos"}` : ""}
            </p>
          )}
          {control.resultado === "no_conforme" && esLeche ? <Insignia tono="alerta">Resultado fuera de lo esperado</Insignia> : null}
          {control.detalle ? <p className="text-humo [overflow-wrap:anywhere]">{control.detalle}</p> : null}
          {(respaldoActual?.soporte ?? control.soporte_path) ? (
            <a href={direccionSoporte((respaldoActual?.soporte ?? control.soporte_path)!)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-musgo underline-offset-4 hover:underline">
              <FileText className="size-4" strokeWidth={2} aria-hidden="true" /> Ver documento
            </a>
          ) : null}
        </div>
      ) : null}

      {control?.estado === "no_realizado" && !abierto ? (
        <div className="space-y-1 text-[0.9375rem]">
          <p className="font-semibold">Constancia: este control no se hizo.</p>
          {control.motivo ? <p className="text-humo [overflow-wrap:anywhere]">Motivo: {control.motivo}</p> : null}
          <p className="text-sm text-humo">Registrado el {formatoFecha(control.updated_at.slice(0, 10))}.</p>
        </div>
      ) : null}

      {!control && !abierto ? <p className="text-[0.9375rem] text-humo">Responde si lo hiciste o no. Si no lo respondes, el control queda pendiente.</p> : null}

      {puedeEditar && !abierto ? (
        <Boton variante={control ? "secundario" : "primario"} ancho={false} onClick={() => setAbierto(true)}>
          {control ? "Cambiar respuesta" : "Responder"}
        </Boton>
      ) : null}

      {abierto ? (
        <div className="space-y-4 border-t border-arena pt-3">
          <div role="radiogroup" aria-label="¿Hiciste este control?" className="grid grid-cols-2 gap-2">
            {(
              [
                ["si", "Sí lo hice", Check],
                ["no", "No lo hice", X],
              ] as const
            ).map(([valorR, texto, Icono]) => (
              <button
                key={valorR}
                type="button"
                role="radio"
                aria-checked={respuesta === valorR}
                onClick={() => setRespuesta(valorR)}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 font-semibold ring-1 transition active:scale-[0.99] ${respuesta === valorR ? "bg-musgo/10 ring-2 ring-musgo" : "bg-papel ring-arena hover:bg-arena/40"}`}
              >
                <Icono className="size-5" strokeWidth={2.2} aria-hidden="true" /> {texto}
              </button>
            ))}
          </div>

          {respuesta === "si" && esLeche ? (
            candidatos.length > 0 ? (
              <div role="radiogroup" aria-label="Análisis que lo respalda" className="space-y-2">
                <p className="text-sm font-semibold">¿Con qué análisis?</p>
                {candidatos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={analisis === c.id}
                    onClick={() => setAnalisis(c.id)}
                    className={`block w-full min-w-0 rounded-2xl px-3.5 py-2.5 text-left ring-1 transition ${analisis === c.id ? "bg-musgo/10 ring-2 ring-musgo" : "bg-papel ring-arena hover:bg-arena/40"}`}
                  >
                    <span className="block font-semibold">{formatoFecha(c.fecha)}</span>
                    <span className="block text-sm text-humo [overflow-wrap:anywhere]">{c.resumen}</span>
                  </button>
                ))}
                {nuevoAnalisis ? (
                  <Link href={nuevoAnalisis} className="inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    Registrar otro análisis
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <Aviso tipo="atencion">
                  No tienes un análisis reciente con este resultado y su documento. Regístralo en Calidad (con el informe adjunto) y vuelve a responder.
                </Aviso>
                {nuevoAnalisis ? (
                  <Link href={nuevoAnalisis} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-musgo px-5 font-semibold text-sobre-musgo">
                    Registrar el análisis
                  </Link>
                ) : null}
              </div>
            )
          ) : null}

          {respuesta === "si" && !esLeche ? (
            <div className="space-y-4">
              <Campo etiqueta="¿Cuándo se hizo?">
                {(idC) => <input id={idC} type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className={CLASE_INPUT} />}
              </Campo>
              {tipo === "condicion_corporal" ? (
                <Campo etiqueta="Condición corporal" ayuda="1 es muy flaco y 5 es muy gordo; lo ideal para salir está cerca de 3 o 4.">
                  {(idC) => <Selector id={idC} valor={valor} onCambio={(v) => setValor(String(v))} titulo="Condición corporal" placeholder="Elegir…" opciones={VALORES_CONDICION.map((n) => ({ valor: String(n), etiqueta: n.toLocaleString("es-CO") }))} />}
                </Campo>
              ) : (
                <>
                  <Campo etiqueta="Resultado de la inspección">
                    {(idC) => (
                      <SelectorTarjetas
                        id={idC}
                        valor={resultado}
                        onCambio={setResultado}
                        titulo="Resultado de la inspección"
                        opciones={[
                          { valor: "conforme", etiqueta: "Sin hallazgos", escena: ESCENA_INSPECCION.conforme },
                          { valor: "no_conforme", etiqueta: "Con hallazgos o decomisos", escena: ESCENA_INSPECCION.no_conforme },
                        ]}
                      />
                    )}
                  </Campo>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold">Acta o certificado de la inspección (obligatorio)</p>
                    <SubirSoporte nombre="soporte_acta" carpeta="carne" etiqueta="Acta de la inspección" inicial={control?.soporte_path} onEstado={setSubiendo} onCambio={setSoporte} />
                  </div>
                </>
              )}
              <Campo etiqueta="Notas" ayuda="Opcional.">
                {(idC) => <textarea id={idC} value={detalle} maxLength={500} rows={2} onChange={(e) => setDetalle(e.target.value)} className={`${CLASE_INPUT} py-3`} />}
              </Campo>
            </div>
          ) : null}

          {respuesta === "no" ? (
            <div className="space-y-3">
              <Aviso tipo="atencion">
                Quedará constancia en el sistema de que este control no se hizo. Si un cliente, una quesería o una autoridad pregunta, el registro dirá que no se realizó.
              </Aviso>
              <Campo etiqueta="¿Por qué no se hizo?" ayuda="Opcional.">
                {(idC) => <textarea id={idC} value={motivo} maxLength={300} rows={2} onChange={(e) => setMotivo(e.target.value)} className={`${CLASE_INPUT} py-3`} />}
              </Campo>
            </div>
          ) : null}

          {error ? <Aviso tipo="error">{error}</Aviso> : null}
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => { setAbierto(false); setError(null); }} disabled={pendiente}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} pendiente={pendiente} cargando="Guardando…" disabled={!respuesta || subiendo || (respuesta === "si" && esLeche && !analisis)}>
              {respuesta === "no" ? "Dejar constancia" : "Guardar"}
            </Boton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
