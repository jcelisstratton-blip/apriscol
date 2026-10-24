"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { AsistidoPor } from "@/components/AsistidoPor";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { crearParto, editarParto } from "@/app/(app)/reproduccion/actions";
import { formatoFecha } from "@/lib/fechas";
import { ESCENA_CAUSA_ABORTO, ESCENA_ESTADO_CRIA, ESCENA_TIPO_PARTO } from "@/lib/escenas-forms-b-reproduccion";
import { ESCENA_SEXO } from "@/lib/escenas-forms-b-hato";
import { CAUSAS_ABORTO, DETALLE_CAUSA, DETALLE_PARTO, ETIQUETA_CAUSA, ETIQUETA_PARTO, MAX_CRIAS, TIPOS_PARTO } from "@/lib/reproduccion";
import type { VeterinarioRef } from "@/lib/veterinarios";
import type { CausaAborto, Cria, Parto, TipoParto } from "@/lib/tipos";

type Fila = { sexo: "hembra" | "macho" | ""; vivo: boolean; peso: string; arete: string; nombre: string };
const NUEVA: Fila = { sexo: "", vivo: true, peso: "", arete: "", nombre: "" };

/**
 * Registrar el parto de una hembra. El formulario se adapta al tipo de evento: parto normal, crías (una fila por cría: gemelos y trillizos),
 * complicaciones y observaciones, sin asistencia; parto asistido y cesárea, lo mismo más «Asistido por» (el veterinario de la finca u otra persona; en la cesárea,
 * además, las complicaciones quirúrgicas y el protocolo posoperatorio); aborto, sin crías ni pesos: causa aparente, «Asistido por» si lo hubo, complicaciones y
 * observaciones clínicas. Una cría viva con arete se crea también como
 * animal del hato, con su madre y su padre. Al corregir un parto cambian la fecha, el tipo y los datos clínicos, y el sexo, el peso y el estado (viva o muerta) de las crías que aún no son animales del hato.
 */
export function FormParto({
  hembraId,
  hoy,
  servicio,
  parto,
  crias,
  veterinarios,
  puedeAgregarVeterinario,
  solicitud,
}: {
  hembraId: string;
  hoy: string;
  /** El servicio vigente de la hembra (el parto se liga a él). */
  servicio?: { id: string; fecha: string } | null;
  parto?: Parto;
  /** Al corregir: las crías que ya tiene (solo lectura). */
  crias?: Cria[];
  /** Los veterinarios del equipo: quien asiste un parto difícil suele ser uno de ellos. */
  veterinarios: VeterinarioRef[];
  puedeAgregarVeterinario: boolean;
  solicitud?: string;
}) {
  const editando = Boolean(parto);
  const [estado, enviar, pendiente] = useActionState(editando ? editarParto : crearParto, undefined);
  const [, iniciar] = useTransition();
  const [tipo, setTipo] = useState<TipoParto>(parto?.tipo ?? "normal");
  const [filas, setFilas] = useState<Fila[]>([{ ...NUEVA }]);
  // Al corregir: las crías que todavía no son un animal del hato se pueden corregir aquí (sexo, peso y si nació viva o muerta); las que ya son animal, en su ficha.
  const [edicion, setEdicion] = useState(() => (crias ?? []).map((c) => ({ id: c.id, animal: Boolean(c.animal_id), sexo: (c.sexo ?? "") as Fila["sexo"], vivo: c.vivo, peso: c.peso_nacer_kg == null ? "" : String(c.peso_nacer_kg).replace(".", ",") })));
  const cambiarEdicion = (i: number, cambio: Partial<(typeof edicion)[number]>) => setEdicion((f) => f.map((x, k) => (k === i ? { ...x, ...cambio } : x)));
  const [causa, setCausa] = useState<CausaAborto | "">(parto?.causa_aborto ?? "");
  const esAborto = tipo === "aborto";
  const esCesarea = tipo === "cesarea";
  // Al corregir, un aborto no se vuelve parto (ni al revés): se ofrecen solo los tipos de su grupo.
  const tiposOfrecidos = editando ? TIPOS_PARTO.filter((t) => (t === "aborto") === (parto?.tipo === "aborto")) : TIPOS_PARTO;

  const cambiar = (i: number, cambio: Partial<Fila>) => setFilas((f) => f.map((x, k) => (k === i ? { ...x, ...cambio } : x)));

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    if (!editando) {
      datos.set(
        "crias",
        JSON.stringify(
          filas.map((x) => ({ sexo: x.sexo || null, vivo: x.vivo, peso: x.peso.trim() || undefined, arete: x.arete.trim() || undefined, nombre: x.nombre.trim() || undefined })),
        ),
      );
    }
    if (editando && edicion.some((x) => !x.animal)) {
      datos.set("crias_edit", JSON.stringify(edicion.filter((x) => !x.animal).map((x) => ({ id: x.id, sexo: x.sexo || null, vivo: x.vivo, peso: x.peso.trim() || undefined }))));
    }
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="madre_id" value={hembraId} />
      {servicio ? <input type="hidden" name="servicio_id" value={servicio.id} /> : null}
      {parto ? <input type="hidden" name="parto_id" value={parto.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      {servicio && !editando ? <Aviso tipo="info">Se liga al servicio del {formatoFecha(servicio.fecha)}.</Aviso> : null}

      <Campo etiqueta="Fecha del parto">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={parto?.fecha ?? hoy} min={servicio?.fecha} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="¿Qué pasó?">
        {(id) => <SelectorTarjetas id={id} nombre="tipo" valor={tipo} onCambio={(v) => v && setTipo(v)} titulo="¿Qué pasó?" opciones={tiposOfrecidos.map((t) => ({ valor: t, etiqueta: ETIQUETA_PARTO[t], detalle: DETALLE_PARTO[t], escena: ESCENA_TIPO_PARTO[t] }))} />}
      </Campo>

      {!editando && !esAborto ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Crías ({filas.length})</legend>
          {filas.map((x, i) => (
            <div key={i} className="space-y-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">Cría {i + 1}</p>
                {filas.length > 1 ? (
                  <button type="button" onClick={() => setFilas((f) => f.filter((_, k) => k !== i))} aria-label={`Quitar la cría ${i + 1}`} className="grid size-11 place-items-center rounded-full text-humo hover:bg-arena hover:text-rojo">
                    <Trash2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <Campo etiqueta="Sexo">
                {(id) => (
                  <SelectorTarjetas id={id} valor={x.sexo} onCambio={(v) => cambiar(i, { sexo: v as Fila["sexo"] })} titulo="Sexo de la cría" opciones={[{ valor: "hembra", etiqueta: "Hembra", escena: ESCENA_SEXO.hembra }, { valor: "macho", etiqueta: "Macho", escena: ESCENA_SEXO.macho }]} />
                )}
              </Campo>
              <Campo etiqueta="Estado">
                {(id) => (
                  <SelectorTarjetas id={id} valor={x.vivo ? "viva" : "muerta"} onCambio={(v) => v && cambiar(i, { vivo: v === "viva", arete: v === "viva" ? x.arete : "", nombre: v === "viva" ? x.nombre : "" })} titulo="Estado de la cría" opciones={[{ valor: "viva", etiqueta: "Viva", escena: ESCENA_ESTADO_CRIA.viva }, { valor: "muerta", etiqueta: "Muerta", escena: ESCENA_ESTADO_CRIA.muerta }]} />
                )}
              </Campo>
              <Campo etiqueta="Peso al nacer (kg)" ayuda="Opcional.">
                {(id) => <input id={id} value={x.peso} onChange={(e) => cambiar(i, { peso: e.target.value })} inputMode="decimal" autoComplete="off" placeholder="Ej. 3,2" className={CLASE_INPUT} />}
              </Campo>
              {x.vivo ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo etiqueta="Arete" ayuda="Opcional. Si lo escribes, la cría se crea en tu hato.">
                    {(id) => <input id={id} value={x.arete} onChange={(e) => cambiar(i, { arete: e.target.value })} maxLength={40} autoComplete="off" className={CLASE_INPUT} />}
                  </Campo>
                  <Campo etiqueta="Nombre" ayuda="Opcional.">
                    {(id) => <input id={id} value={x.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
                  </Campo>
                </div>
              ) : null}
            </div>
          ))}
          {filas.length < MAX_CRIAS ? (
            <button type="button" onClick={() => setFilas((f) => [...f, { ...NUEVA }])} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" /> Agregar otra cría
            </button>
          ) : null}
        </fieldset>
      ) : null}

      {editando && crias && crias.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Crías de este parto ({crias.length})</legend>
          {crias.map((c, i) => {
            const x = edicion[i];
            return (
              <div key={c.id} className="space-y-3 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
                <p className="font-semibold">Cría {i + 1}</p>
                {c.animal_id ? (
                  <p className="text-[0.9375rem] text-humo">
                    {c.sexo === "hembra" ? "Hembra" : c.sexo === "macho" ? "Macho" : "Sexo sin registrar"} · {c.vivo ? "viva" : "muerta"}
                    {c.peso_nacer_kg != null ? ` · ${c.peso_nacer_kg.toLocaleString("es-CO")} kg` : ""} · ya está en tu hato: se corrige desde su ficha.
                  </p>
                ) : (
                  <>
                    <Campo etiqueta="Sexo">
                      {(id) => (
                        <SelectorTarjetas id={id} valor={x.sexo} onCambio={(v) => cambiarEdicion(i, { sexo: v as Fila["sexo"] })} titulo="Sexo de la cría" opciones={[{ valor: "hembra", etiqueta: "Hembra", escena: ESCENA_SEXO.hembra }, { valor: "macho", etiqueta: "Macho", escena: ESCENA_SEXO.macho }]} />
                      )}
                    </Campo>
                    <Campo etiqueta="Estado">
                      {(id) => (
                        <SelectorTarjetas id={id} valor={x.vivo ? "viva" : "muerta"} onCambio={(v) => v && cambiarEdicion(i, { vivo: v === "viva" })} titulo="Estado de la cría" opciones={[{ valor: "viva", etiqueta: "Viva", escena: ESCENA_ESTADO_CRIA.viva }, { valor: "muerta", etiqueta: "Muerta", escena: ESCENA_ESTADO_CRIA.muerta }]} />
                      )}
                    </Campo>
                    <Campo etiqueta="Peso al nacer (kg)" ayuda="Opcional.">
                      {(id) => <input id={id} value={x.peso} onChange={(e) => cambiarEdicion(i, { peso: e.target.value })} inputMode="decimal" autoComplete="off" placeholder="Ej. 3,2" className={CLASE_INPUT} />}
                    </Campo>
                  </>
                )}
              </div>
            );
          })}
        </fieldset>
      ) : null}

      {esAborto ? (
        <div className="space-y-3">
          <Campo etiqueta="Causa aparente" ayuda="Sirve para el control epidemiológico de tu hato.">
            {(id) => <SelectorTarjetas id={id} nombre="causa_aborto" valor={causa} onCambio={setCausa} titulo="Causa aparente del aborto" opciones={CAUSAS_ABORTO.map((c) => ({ valor: c, etiqueta: ETIQUETA_CAUSA[c], detalle: DETALLE_CAUSA[c], escena: ESCENA_CAUSA_ABORTO[c] }))} />}
          </Campo>
          {causa === "infecciosa" ? (
            <Aviso tipo="atencion">Si se sospecha una infección, aísla a la hembra, maneja el feto y la placenta con guantes (algunas causas, como la brucelosis, pasan a las personas) y avisa a tu veterinario.</Aviso>
          ) : null}
        </div>
      ) : null}

      {tipo !== "normal" ? (
        <AsistidoPor key={tipo} nombre="asistido_por" veterinarios={veterinarios} puedeAgregar={puedeAgregarVeterinario} inicial={parto?.asistido_por ?? parto?.responsable_quirurgico} requerido={tipo === "asistido" || tipo === "cesarea"} />
      ) : null}

      <Campo etiqueta={esCesarea ? "Complicaciones quirúrgicas" : "Complicaciones"} ayuda="Opcional.">
        {(id) => <textarea id={id} name="complicaciones" defaultValue={parto?.complicaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {esCesarea ? (
        <Campo etiqueta="Protocolo posoperatorio y fármacos administrados" ayuda="Opcional. Medicamentos, dosis y cuidados después de la cirugía.">
          {(id) => <textarea id={id} name="protocolo_posoperatorio" defaultValue={parto?.protocolo_posoperatorio ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
      ) : null}

      <Campo etiqueta={esAborto ? "Observaciones clínicas" : "Observaciones"} ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={parto?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar parto"}
        </Boton>
        <Link href={`/hato/${hembraId}#reproduccion`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
