"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { crearParto, editarParto } from "@/app/(app)/reproduccion/actions";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_PARTO, MAX_CRIAS, TIPOS_PARTO } from "@/lib/reproduccion";
import type { Cria, Parto, TipoParto } from "@/lib/tipos";

type Fila = { sexo: "hembra" | "macho" | ""; vivo: boolean; peso: string; arete: string; nombre: string };
const NUEVA: Fila = { sexo: "", vivo: true, peso: "", arete: "", nombre: "" };

/**
 * Registrar el parto de una hembra con sus crías (una fila por cría: gemelos y trillizos). Una cría viva con arete se crea también como
 * animal del hato, con su madre y su padre. Al corregir un parto solo cambian la fecha, el tipo y las complicaciones.
 */
export function FormParto({
  hembraId,
  hoy,
  servicio,
  parto,
  crias,
  solicitud,
}: {
  hembraId: string;
  hoy: string;
  /** El servicio vigente de la hembra (el parto se liga a él). */
  servicio?: { id: string; fecha: string } | null;
  parto?: Parto;
  /** Al corregir: las crías que ya tiene (solo lectura). */
  crias?: Cria[];
  solicitud?: string;
}) {
  const editando = Boolean(parto);
  const [estado, enviar, pendiente] = useActionState(editando ? editarParto : crearParto, undefined);
  const [, iniciar] = useTransition();
  const [tipo, setTipo] = useState<TipoParto>(parto?.tipo ?? "normal");
  const [filas, setFilas] = useState<Fila[]>([{ ...NUEVA }]);
  const esAborto = tipo === "aborto";

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
        {(id) => <Selector id={id} nombre="tipo" valor={tipo} onCambio={(v) => v && setTipo(v)} titulo="¿Qué pasó?" opciones={TIPOS_PARTO.map((t) => ({ valor: t, etiqueta: ETIQUETA_PARTO[t] }))} />}
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
                  <Selector id={id} valor={x.sexo} onCambio={(v) => cambiar(i, { sexo: v as Fila["sexo"] })} titulo="Sexo de la cría" placeholder="Elegir…" opciones={[{ valor: "hembra", etiqueta: "Hembra" }, { valor: "macho", etiqueta: "Macho" }]} />
                )}
              </Campo>
              <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
                <input type="checkbox" checked={x.vivo} onChange={(e) => cambiar(i, { vivo: e.target.checked, arete: e.target.checked ? x.arete : "" })} className="size-5 accent-[var(--musgo)]" />
                Nació viva
              </label>
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
        <div className="space-y-1 rounded-2xl bg-papel p-3.5 text-[0.9375rem] ring-1 ring-arena">
          <p className="font-semibold">Crías de este parto</p>
          {crias.map((c, i) => (
            <p key={c.id} className="text-humo">
              {i + 1}. {c.sexo === "hembra" ? "Hembra" : c.sexo === "macho" ? "Macho" : "Sexo sin registrar"} · {c.vivo ? "viva" : "no viva"}
              {c.peso_nacer_kg != null ? ` · ${c.peso_nacer_kg.toLocaleString("es-CO")} kg` : ""}
              {c.animal_id ? " · en el hato" : ""}
            </p>
          ))}
          <p className="text-sm text-humo">Las crías se corrigen desde su propia ficha.</p>
        </div>
      ) : null}

      <Campo etiqueta="Complicaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="complicaciones" defaultValue={parto?.complicaciones ?? ""} rows={3} maxLength={500} className={`${CLASE_INPUT} py-3`} />}
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
