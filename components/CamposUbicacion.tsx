"use client";

import { useState } from "react";
import { Campo } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { DEPARTAMENTOS } from "@/lib/colombia";
import { municipiosDe } from "@/lib/municipios";

/**
 * Departamento y municipio: el municipio solo ofrece los del departamento elegido, y se vacía si se cambia a un departamento
 * donde ya no existe. Envía `departamento` y `municipio` con el formulario.
 */
export function CamposUbicacion({
  departamentoInicial = "",
  municipioInicial = "",
  etiquetaMunicipio = "Municipio",
}: {
  departamentoInicial?: string;
  municipioInicial?: string;
  etiquetaMunicipio?: string;
}) {
  const [depto, setDepto] = useState(departamentoInicial);
  const [mpio, setMpio] = useState(municipioInicial);

  const lista = municipiosDe(depto);
  // Un municipio escrito a mano antes de existir esta lista no se pierde: se ofrece como una opción más.
  const nombres = mpio && !lista.includes(mpio) ? [mpio, ...lista] : lista;

  const cambiarDepartamento = (nuevo: string) => {
    setDepto(nuevo);
    if (mpio && !municipiosDe(nuevo).includes(mpio)) setMpio("");
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Campo etiqueta="Departamento">
        {(id) => (
          <Selector
            id={id}
            nombre="departamento"
            valor={depto}
            opciones={DEPARTAMENTOS.map((d) => ({ valor: d, etiqueta: d }))}
            onCambio={(v) => cambiarDepartamento(String(v))}
            titulo="Departamento"
            placeholder="Sin especificar"
            permitirVacio
          />
        )}
      </Campo>
      <Campo etiqueta={etiquetaMunicipio} ayuda={depto ? undefined : "Elige primero el departamento."}>
        {(id) => (
          <Selector
            id={id}
            nombre="municipio"
            valor={mpio}
            opciones={nombres.map((m) => ({ valor: m, etiqueta: m }))}
            onCambio={(v) => setMpio(String(v))}
            titulo={`Municipio de ${depto || "…"}`}
            placeholder={depto ? "Sin especificar" : "Elige primero el departamento"}
            permitirVacio
            deshabilitado={!depto}
          />
        )}
      </Campo>
    </div>
  );
}
