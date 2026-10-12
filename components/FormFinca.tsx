"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { Segmentado } from "@/components/Segmentado";
import { DEPARTAMENTOS } from "@/lib/colombia";
import type { Especie, Vocacion } from "@/lib/tipos";
import { crearFinca, editarFinca } from "@/app/onboarding/actions";

export type FincaEditable = {
  nombre: string;
  departamento: string | null;
  municipio: string | null;
  proposito: Vocacion;
  especies: Especie[];
};

/** Crear una finca (al registrarse o al agregar otra) o corregir los datos de la finca activa. */
export function FormFinca({ finca, especiesEnUso = [] }: { finca?: FincaEditable; especiesEnUso?: Especie[] }) {
  const editando = Boolean(finca);
  const [estado, enviar, pendiente] = useActionState(editando ? editarFinca : crearFinca, undefined);
  const [, iniciar] = useTransition();
  const [depto, setDepto] = useState<string>(finca ? (finca.departamento ?? "") : "Antioquia");
  const [proposito, setProposito] = useState<Vocacion>(finca?.proposito ?? "leche");
  const [especies, setEspecies] = useState<Especie[]>(finca?.especies ?? ["caprino"]);

  const alternar = (e: Especie) =>
    setEspecies((previas) => (previas.includes(e) ? previas.filter((x) => x !== e) : [...previas, e]));

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <Campo etiqueta="Nombre de la finca">
        {(id) => <input id={id} name="nombre" defaultValue={finca?.nombre} required minLength={2} maxLength={120} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. El Mirador" />}
      </Campo>

      <Campo etiqueta="Departamento">
        {(id) => (
          <Selector
            id={id}
            nombre="departamento"
            valor={depto}
            opciones={DEPARTAMENTOS.map((d) => ({ valor: d, etiqueta: d }))}
            onCambio={(v) => setDepto(String(v))}
            titulo="Departamento"
            placeholder="Sin especificar"
            permitirVacio={editando}
          />
        )}
      </Campo>

      <Campo etiqueta="Municipio o vereda" ayuda="Opcional.">
        {(id) => <input id={id} name="municipio" defaultValue={finca?.municipio ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">¿Qué animales tienes?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["caprino", "ovino"] as const).map((e) => {
            const activo = especies.includes(e);
            const enUso = editando && especiesEnUso.includes(e);
            return (
              <button
                key={e}
                type="button"
                aria-pressed={activo}
                disabled={enUso}
                onClick={() => alternar(e)}
                className={`min-h-14 rounded-2xl border-2 px-3 text-base font-semibold transition disabled:cursor-not-allowed ${
                  activo ? "border-musgo bg-musgo/10 text-musgo-osc" : "border-arena bg-papel text-humo"
                }`}
              >
                {e === "caprino" ? "Cabras" : "Ovejas"}
              </button>
            );
          })}
        </div>
        {editando && especiesEnUso.length > 0 ? (
          <p className="text-[0.8125rem] text-humo">Una especie con animales registrados no se puede quitar.</p>
        ) : null}
        {especies.map((e) => (
          <input key={e} type="hidden" name="especies" value={e} />
        ))}
      </fieldset>

      <div className="space-y-2">
        <span className="block text-sm font-semibold">¿Para qué las manejas?</span>
        <Segmentado
          etiqueta="Propósito"
          nombre="proposito"
          valor={proposito}
          onCambio={setProposito}
          opciones={[
            { valor: "leche", etiqueta: "Leche" },
            { valor: "carne", etiqueta: "Carne" },
            { valor: "doble", etiqueta: "Ambos" },
          ]}
        />
      </div>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}

      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando={editando ? "Guardando cambios…" : "Creando tu finca…"} disabled={especies.length === 0}>
          {editando ? "Guardar cambios" : "Crear finca"}
        </Boton>
        {editando ? (
          <Link href="/mas" className={clasesBoton("fantasma")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
