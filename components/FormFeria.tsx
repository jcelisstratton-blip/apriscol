"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { CamposUbicacion } from "@/components/CamposUbicacion";
import { Selector } from "@/components/Selector";
import { crearFeria, editarFeria } from "@/app/(app)/ferias/actions";
import { ETIQUETA_NIVEL } from "@/lib/ferias";
import type { NivelFeria } from "@/lib/tipos";

const DETALLE_NIVEL: Record<NivelFeria, string> = {
  local: "Del municipio o la vereda",
  regional: "Del departamento o una región",
  nacional: "Con participantes de todo el país",
  internacional: "Con participantes de otros países",
};

export type FeriaEditable = {
  id: string;
  nombre: string;
  nivel: NivelFeria;
  departamento: string | null;
  municipio: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  organizador: string | null;
};

/** Registrar una feria o corregir los datos de una ya registrada. */
export function FormFeria({ animalId, feria }: { animalId?: string; feria?: FeriaEditable }) {
  const editando = Boolean(feria);
  const [estado, enviar, pendiente] = useActionState(editando ? editarFeria : crearFeria, undefined);
  const [, iniciar] = useTransition();
  const [nivel, setNivel] = useState<NivelFeria>(feria?.nivel ?? "nacional");

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      {feria ? <input type="hidden" name="feria_id" value={feria.id} /> : null}
      {animalId ? <input type="hidden" name="animal" value={animalId} /> : null}
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

      <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2">
        <Campo etiqueta="Desde">
          {(id) => <input id={id} name="fecha_inicio" type="date" defaultValue={feria?.fecha_inicio} required className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Hasta" ayuda="Opcional.">
          {(id) => <input id={id} name="fecha_fin" type="date" defaultValue={feria?.fecha_fin ?? ""} className={CLASE_INPUT} />}
        </Campo>
      </div>

      <Campo etiqueta="Organizador" ayuda="Opcional.">
        {(id) => <input id={id} name="organizador" defaultValue={feria?.organizador ?? ""} maxLength={160} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando={editando ? "Guardando cambios…" : "Guardando feria…"}>
          {editando ? "Guardar cambios" : "Guardar feria"}
        </Boton>
        {feria ? (
          <Link href={`/ferias/${feria.id}`} className={clasesBoton("fantasma")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
