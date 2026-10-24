"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { escena } from "@/lib/escenas";
import { ESCENA_ROL } from "@/lib/escenas-forms-a-hato";
import { eleccionInicialResponsable, nombreResponsable, OTRA_PERSONA, type VeterinarioRef } from "@/lib/veterinarios";

const ESCENA_OTRA = escena(User, "grafito");

/**
 * Quién hizo el procedimiento: los veterinarios de la finca como tarjetas (con uno solo, ya viene elegido) y «Otra persona», que abre el campo para escribir
 * su nombre. Sin veterinarios en el equipo, solo el campo de texto. Manda un único valor con el nombre, que se copia en el registro: si cambia el equipo, el
 * historial sigue diciendo quién lo hizo en su momento.
 */
export function ResponsableProcedimiento({
  nombre,
  etiqueta,
  ayuda,
  veterinarios,
  inicial,
  requerido = false,
}: {
  /** Nombre del campo que recibe el servidor (`responsable`, `responsable_quirurgico`). */
  nombre: string;
  etiqueta: string;
  ayuda?: string;
  veterinarios: VeterinarioRef[];
  /** El nombre ya guardado, al corregir. */
  inicial?: string | null;
  requerido?: boolean;
}) {
  const [eleccion, setEleccion] = useState(() => eleccionInicialResponsable(veterinarios, inicial));
  const [escrito, setEscrito] = useState(() => (eleccionInicialResponsable(veterinarios, inicial) === OTRA_PERSONA ? (inicial ?? "") : ""));
  const valor = nombreResponsable(veterinarios, eleccion, escrito);

  if (veterinarios.length === 0) {
    return (
      <Campo etiqueta={etiqueta} ayuda={ayuda}>
        {(id) => <input id={id} name={nombre} value={escrito} onChange={(e) => setEscrito(e.target.value)} required={requerido} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>
    );
  }
  return (
    <div className="space-y-3">
      <input type="hidden" name={nombre} value={valor} />
      <Campo etiqueta={etiqueta} ayuda={ayuda}>
        {(id) => (
          <SelectorTarjetas
            id={id}
            valor={eleccion}
            onCambio={(v) => setEleccion(v)}
            titulo={etiqueta}
            opciones={[
              ...veterinarios.map((v) => ({ valor: v.id, etiqueta: v.nombre, detalle: v.tarjeta_profesional ? `Veterinario · T.P. ${v.tarjeta_profesional}` : "Veterinario de la finca", escena: ESCENA_ROL.veterinario })),
              { valor: OTRA_PERSONA, etiqueta: "Otra persona", detalle: "Escribe su nombre", escena: ESCENA_OTRA },
            ]}
          />
        )}
      </Campo>
      {eleccion === OTRA_PERSONA ? (
        <Campo etiqueta="Nombre de quien lo hizo">
          {(id) => <input id={id} value={escrito} onChange={(e) => setEscrito(e.target.value)} required={requerido} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
      ) : null}
    </div>
  );
}
