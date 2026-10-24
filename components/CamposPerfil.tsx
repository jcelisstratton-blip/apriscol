"use client";

import { useState } from "react";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { SelectorTarjetasMultiple } from "@/components/SelectorTarjetasMultiple";
import {
  DETALLE_ESPECIALIDAD, DETALLE_FORMACION, DETALLE_LABOR, DETALLE_TIPO_CONTADOR, DETALLE_TIPO_ORDENO, DETALLE_TURNO, ESPECIALIDADES, ETIQUETA_ESPECIALIDAD, ETIQUETA_FORMACION,
  ETIQUETA_LABOR, ETIQUETA_TIPO_CONTADOR, ETIQUETA_TIPO_ORDENO, ETIQUETA_TURNO, FORMACIONES, LABORES, TIPOS_CONTADOR, TIPOS_ORDENO, TURNOS,
  type Especialidad, type Formacion, type Labor, type PerfilEquipo, type TipoContador, type TipoOrdeno, type Turno,
} from "@/lib/perfil-personal";
import { ESCENA_ESPECIALIDAD, ESCENA_FORMACION, ESCENA_LABOR, ESCENA_SI_NO, ESCENA_TIPO_CONTADOR, ESCENA_TIPO_ORDENO, ESCENA_TURNO } from "@/lib/escenas-perfil-personal";
import type { Persona } from "@/lib/tipos";

const TITULO: Record<PerfilEquipo, string> = {
  veterinario: "Datos del veterinario",
  ordenador: "Datos del ordeñador",
  administrador: "Datos del administrador",
  contador: "Datos del contador",
  ninguno: "Datos de su trabajo",
};

/**
 * Lo que de verdad importa saber de cada perfil: del veterinario, su tarjeta profesional, especialidades y teléfono; del ordeñador, turno, tipo de ordeño y
 * curso de manipulación de alimentos; del administrador, su formación; del contador, si es público (con tarjeta) o auxiliar; de quien trabaja sin acceso a la app,
 * su labor. Con el perfil elegido se abre su bloque; el servidor guarda solo lo del perfil. No se pide documento de identidad.
 */
export function CamposPerfil({ rol, persona }: { rol: PerfilEquipo; persona?: Persona }) {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>((persona?.especialidades ?? []) as Especialidad[]);
  const [formacion, setFormacion] = useState<Formacion | "">((persona?.formacion as Formacion | null) ?? "");
  const [turno, setTurno] = useState<Turno | "">((persona?.turno_ordeno as Turno | null) ?? "");
  const [tipoOrdeno, setTipoOrdeno] = useState<TipoOrdeno | "">((persona?.tipo_ordeno as TipoOrdeno | null) ?? "");
  const [curso, setCurso] = useState<"si" | "no" | "">(persona?.curso_manipulacion == null ? "" : persona.curso_manipulacion ? "si" : "no");
  const [tipoContador, setTipoContador] = useState<TipoContador | "">((persona?.tipo_contador as TipoContador | null) ?? "");
  const [labor, setLabor] = useState<Labor | "">((persona?.labor_principal as Labor | null) ?? "");

  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-sm font-semibold">{TITULO[rol]}</legend>

      {rol === "veterinario" ? (
        <>
          <Campo etiqueta="Tarjeta profesional" ayuda="El número de su registro como médico veterinario. Solo lo ven quienes gestionan el equipo y las cuentas.">
            {(id) => <input id={id} name="tarjeta_profesional" defaultValue={persona?.tarjeta_profesional ?? ""} required={!persona} maxLength={40} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Teléfono" ayuda="Es a quien se llama en una urgencia.">
            {(id) => <input id={id} name="telefono" type="tel" inputMode="tel" defaultValue={persona?.telefono ?? ""} required={!persona} maxLength={20} autoComplete="off" placeholder="Ej. 300 123 4567" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Especialidades" ayuda="Opcional. Puedes elegir varias.">
            {(id) => (
              <SelectorTarjetasMultiple id={id} nombre="especialidades" valor={especialidades} onCambio={setEspecialidades} titulo="Especialidades"
                opciones={ESPECIALIDADES.map((e) => ({ valor: e, etiqueta: ETIQUETA_ESPECIALIDAD[e], detalle: DETALLE_ESPECIALIDAD[e], escena: ESCENA_ESPECIALIDAD[e] }))} />
            )}
          </Campo>
          <Campo etiqueta="Años de experiencia" ayuda="Opcional.">
            {(id) => <input id={id} name="experiencia_anios" inputMode="numeric" defaultValue={persona?.experiencia_anios ?? ""} maxLength={2} autoComplete="off" placeholder="Ej. 8" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Acreditaciones" ayuda="Opcional. Por ejemplo, su acreditación ante el ICA u otras certificaciones.">
            {(id) => <input id={id} name="acreditaciones" defaultValue={persona?.acreditaciones ?? ""} maxLength={200} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}

      {rol === "ordenador" ? (
        <>
          <Campo etiqueta="Turno de ordeño">
            {(id) => <SelectorTarjetas id={id} nombre="turno_ordeno" valor={turno} onCambio={setTurno} titulo="Turno de ordeño" opciones={TURNOS.map((t) => ({ valor: t, etiqueta: ETIQUETA_TURNO[t], detalle: DETALLE_TURNO[t], escena: ESCENA_TURNO[t] }))} />}
          </Campo>
          <Campo etiqueta="Tipo de ordeño que maneja">
            {(id) => <SelectorTarjetas id={id} nombre="tipo_ordeno" valor={tipoOrdeno} onCambio={setTipoOrdeno} titulo="Tipo de ordeño" opciones={TIPOS_ORDENO.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_ORDENO[t], detalle: DETALLE_TIPO_ORDENO[t], escena: ESCENA_TIPO_ORDENO[t] }))} />}
          </Campo>
          <Campo etiqueta="Curso de manipulación de alimentos" ayuda="Quien toca la leche debe tenerlo vigente.">
            {(id) => (
              <SelectorTarjetas id={id} nombre="curso_manipulacion" valor={curso} onCambio={setCurso} titulo="Curso de manipulación de alimentos" permitirVacio etiquetaVacio="Sin saber"
                opciones={[{ valor: "si", etiqueta: "Lo tiene", escena: ESCENA_SI_NO.si }, { valor: "no", etiqueta: "No lo tiene", escena: ESCENA_SI_NO.no }]} />
            )}
          </Campo>
          {curso === "si" ? (
            <Campo etiqueta="Vence el" ayuda="Opcional. Para saber cuándo renovarlo.">
              {(id) => <input id={id} name="curso_manipulacion_vence" type="date" defaultValue={persona?.curso_manipulacion_vence ?? ""} className={CLASE_INPUT} />}
            </Campo>
          ) : null}
          <Campo etiqueta="Años de experiencia" ayuda="Opcional.">
            {(id) => <input id={id} name="experiencia_anios" inputMode="numeric" defaultValue={persona?.experiencia_anios ?? ""} maxLength={2} autoComplete="off" placeholder="Ej. 3" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Teléfono" ayuda="Opcional.">
            {(id) => <input id={id} name="telefono" type="tel" inputMode="tel" defaultValue={persona?.telefono ?? ""} maxLength={20} autoComplete="off" placeholder="Ej. 300 123 4567" className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}

      {rol === "administrador" ? (
        <>
          <Campo etiqueta="Formación" ayuda="Opcional.">
            {(id) => <SelectorTarjetas id={id} nombre="formacion" valor={formacion} onCambio={setFormacion} titulo="Formación" permitirVacio opciones={FORMACIONES.map((f) => ({ valor: f, etiqueta: ETIQUETA_FORMACION[f], detalle: DETALLE_FORMACION[f], escena: ESCENA_FORMACION[f] }))} />}
          </Campo>
          <Campo etiqueta="Años de experiencia" ayuda="Opcional.">
            {(id) => <input id={id} name="experiencia_anios" inputMode="numeric" defaultValue={persona?.experiencia_anios ?? ""} maxLength={2} autoComplete="off" placeholder="Ej. 5" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Teléfono" ayuda="Opcional.">
            {(id) => <input id={id} name="telefono" type="tel" inputMode="tel" defaultValue={persona?.telefono ?? ""} maxLength={20} autoComplete="off" placeholder="Ej. 300 123 4567" className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}

      {rol === "contador" ? (
        <>
          <Campo etiqueta="Tipo de contador">
            {(id) => <SelectorTarjetas id={id} nombre="tipo_contador" valor={tipoContador} onCambio={setTipoContador} titulo="Tipo de contador" opciones={TIPOS_CONTADOR.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_CONTADOR[t], detalle: DETALLE_TIPO_CONTADOR[t], escena: ESCENA_TIPO_CONTADOR[t] }))} />}
          </Campo>
          {tipoContador === "publico" ? (
            <Campo etiqueta="Tarjeta profesional" ayuda="El número de su tarjeta de contador público. Solo lo ven quienes gestionan el equipo y las cuentas.">
              {(id) => <input id={id} name="tarjeta_profesional" defaultValue={persona?.tarjeta_profesional ?? ""} required={!persona} maxLength={40} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          ) : null}
          <Campo etiqueta="Años de experiencia" ayuda="Opcional.">
            {(id) => <input id={id} name="experiencia_anios" inputMode="numeric" defaultValue={persona?.experiencia_anios ?? ""} maxLength={2} autoComplete="off" placeholder="Ej. 6" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Teléfono" ayuda="Opcional.">
            {(id) => <input id={id} name="telefono" type="tel" inputMode="tel" defaultValue={persona?.telefono ?? ""} maxLength={20} autoComplete="off" placeholder="Ej. 300 123 4567" className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}

      {rol === "ninguno" ? (
        <>
          <Campo etiqueta="Labor principal">
            {(id) => <SelectorTarjetas id={id} nombre="labor_principal" valor={labor} onCambio={setLabor} titulo="Labor principal" opciones={LABORES.map((l) => ({ valor: l, etiqueta: ETIQUETA_LABOR[l], detalle: DETALLE_LABOR[l], escena: ESCENA_LABOR[l] }))} />}
          </Campo>
          {labor === "otra" ? (
            <Campo etiqueta="¿Qué labor hace?">
              {(id) => <input id={id} name="cargo" defaultValue={persona?.labor_principal === "otra" ? (persona?.cargo ?? "") : ""} required maxLength={60} autoComplete="off" placeholder="Ej. Esquilador" className={CLASE_INPUT} />}
            </Campo>
          ) : null}
          <Campo etiqueta="Años de experiencia" ayuda="Opcional.">
            {(id) => <input id={id} name="experiencia_anios" inputMode="numeric" defaultValue={persona?.experiencia_anios ?? ""} maxLength={2} autoComplete="off" placeholder="Ej. 2" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Teléfono" ayuda="Opcional.">
            {(id) => <input id={id} name="telefono" type="tel" inputMode="tel" defaultValue={persona?.telefono ?? ""} maxLength={20} autoComplete="off" placeholder="Ej. 300 123 4567" className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}
    </fieldset>
  );
}
