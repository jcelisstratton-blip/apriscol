"use client";

import { useState } from "react";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CamposUbicacion } from "@/components/CamposUbicacion";
import { Selector } from "@/components/Selector";
import { ETIQUETA_NIVEL } from "@/lib/ferias";
import type { NivelFeria } from "@/lib/tipos";

const DETALLE_NIVEL: Record<NivelFeria, string> = {
  local: "Del municipio o la vereda",
  regional: "Del departamento o una región",
  nacional: "Con participantes de todo el país",
  internacional: "Con participantes de otros países",
};

export type DatosFeria = {
  nombre: string;
  nivel: NivelFeria;
  departamento: string | null;
  municipio: string | null;
  fecha_inicio: string;
};

/** Los datos de una feria que le sirven al productor: nombre, alcance, dónde y qué día. Se usa al registrar la feria sola y al crearla desde el premio. */
export function CamposFeria({ feria }: { feria?: DatosFeria }) {
  const [nivel, setNivel] = useState<NivelFeria>(feria?.nivel ?? "nacional");
  return (
    <>
      <Campo etiqueta="Nombre de la feria">
        {(id) => <input id={id} name="nombre" defaultValue={feria?.nombre} required minLength={2} maxLength={160} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. Feria Nacional Caprina" />}
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

      <CamposUbicacion departamentoInicial={feria?.departamento ?? ""} municipioInicial={feria?.municipio ?? ""} />

      <Campo etiqueta="Fecha de la feria">
        {(id) => <input id={id} name="fecha_inicio" type="date" defaultValue={feria?.fecha_inicio} required className={CLASE_INPUT} />}
      </Campo>
    </>
  );
}
