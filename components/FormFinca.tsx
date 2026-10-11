"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { Segmentado } from "@/components/Segmentado";
import { DEPARTAMENTOS } from "@/lib/colombia";
import type { Especie, Vocacion } from "@/lib/tipos";
import { crearFinca } from "@/app/onboarding/actions";

export function FormFinca() {
  const [estado, enviar, pendiente] = useActionState(crearFinca, undefined);
  const [depto, setDepto] = useState<string>("Antioquia");
  const [proposito, setProposito] = useState<Vocacion>("leche");
  const [especies, setEspecies] = useState<Especie[]>(["caprino"]);

  const alternar = (e: Especie) =>
    setEspecies((previas) => (previas.includes(e) ? previas.filter((x) => x !== e) : [...previas, e]));

  return (
    <form action={enviar} className="space-y-5">
      <Campo etiqueta="Nombre de la finca">
        {(id) => <input id={id} name="nombre" required minLength={2} maxLength={120} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. El Mirador" />}
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
          />
        )}
      </Campo>

      <Campo etiqueta="Municipio o vereda" ayuda="Opcional.">
        {(id) => <input id={id} name="municipio" maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">¿Qué animales tienes?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["caprino", "ovino"] as const).map((e) => {
            const activo = especies.includes(e);
            return (
              <button
                key={e}
                type="button"
                aria-pressed={activo}
                onClick={() => alternar(e)}
                className={`min-h-14 rounded-2xl border-2 px-3 text-base font-semibold transition ${
                  activo ? "border-musgo bg-musgo/10 text-musgo-osc" : "border-arena bg-papel text-humo"
                }`}
              >
                {e === "caprino" ? "Cabras" : "Ovejas"}
              </button>
            );
          })}
        </div>
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

      <Boton type="submit" pendiente={pendiente} cargando="Creando tu finca…" disabled={especies.length === 0}>
        Crear finca
      </Boton>
    </form>
  );
}
