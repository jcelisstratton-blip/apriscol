"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { crearFeria } from "@/app/(app)/ferias/actions";
import { DEPARTAMENTOS } from "@/lib/colombia";
import { ETIQUETA_NIVEL } from "@/lib/ferias";
import type { NivelFeria } from "@/lib/tipos";

const DETALLE_NIVEL: Record<NivelFeria, string> = {
  local: "Del municipio o la vereda",
  regional: "Del departamento o una región",
  nacional: "Con participantes de todo el país",
  internacional: "Con participantes de otros países",
};

export function FormFeria({ animalId }: { animalId?: string }) {
  const [estado, enviar, pendiente] = useActionState(crearFeria, undefined);
  const [nivel, setNivel] = useState<NivelFeria>("nacional");
  const [depto, setDepto] = useState<string>("");

  return (
    <form action={enviar} className="space-y-5">
      {animalId ? <input type="hidden" name="animal" value={animalId} /> : null}
      <Campo etiqueta="Nombre de la feria">
        {(id) => <input id={id} name="nombre" required minLength={2} maxLength={160} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. Feria Nacional Caprina" />}
      </Campo>

      <Campo etiqueta="Alcance">
        {(id) => (
          <Selector
            id={id}
            nombre="nivel"
            valor={nivel}
            onCambio={(v) => v && setNivel(v)}
            titulo="Alcance de la feria"
            opciones={(Object.keys(ETIQUETA_NIVEL) as NivelFeria[]).map((n) => ({ valor: n, etiqueta: ETIQUETA_NIVEL[n], detalle: DETALLE_NIVEL[n] }))}
          />
        )}
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
            permitirVacio
          />
        )}
      </Campo>

      <Campo etiqueta="Municipio">
        {(id) => <input id={id} name="municipio" maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2">
        <Campo etiqueta="Desde">
          {(id) => <input id={id} name="fecha_inicio" type="date" required className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Hasta" ayuda="Opcional.">
          {(id) => <input id={id} name="fecha_fin" type="date" className={CLASE_INPUT} />}
        </Campo>
      </div>

      <Campo etiqueta="Organizador" ayuda="Opcional.">
        {(id) => <input id={id} name="organizador" maxLength={160} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente} cargando="Guardando feria…">
        Guardar feria
      </Boton>
    </form>
  );
}
