"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { solicitarReclamo } from "@/app/(app)/libro/actions";

type Tipo = "CC" | "CE" | "NIT";

export function FormReclamo() {
  const [estado, enviar, pendiente] = useActionState(solicitarReclamo, undefined);
  const [tipo, setTipo] = useState<Tipo>("CC");
  const r = estado?.resultado;

  return (
    <form action={enviar} className="space-y-4">
      <Campo etiqueta="Tipo de documento">
        {(id) => (
          <Selector
            id={id}
            nombre="tipo"
            valor={tipo}
            onCambio={(v) => v && setTipo(v as Tipo)}
            titulo="Tipo de documento"
            opciones={[
              { valor: "CC", etiqueta: "Cédula de ciudadanía" },
              { valor: "CE", etiqueta: "Cédula de extranjería" },
              { valor: "NIT", etiqueta: "NIT (empresa)", detalle: "Con o sin el dígito de verificación" },
            ]}
          />
        )}
      </Campo>

      <Campo etiqueta="Número de documento" ayuda="Es el que quedó registrado como propietario en el libro genealógico.">
        {(id) => (
          <input
            id={id}
            name="documento"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={20}
            className={CLASE_INPUT}
            placeholder="Solo números"
          />
        )}
      </Campo>

      <Campo etiqueta="Mensaje para el administrador" ayuda="Opcional. Por ejemplo, el nombre del criadero.">
        {(id) => <textarea id={id} name="mensaje" rows={2} maxLength={500} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {r && !r.encontrado ? (
        <Aviso tipo="atencion">
          No encontramos animales registrados con ese documento. Revisa el número; si es un NIT, prueba con y sin el dígito de verificación.
        </Aviso>
      ) : null}
      {r && r.encontrado && r.animales === 0 ? (
        <Aviso tipo="info">Todos los animales de ese documento ya están en una finca.</Aviso>
      ) : null}
      {r && r.encontrado && r.animales > 0 ? (
        <Aviso tipo="exito">
          Solicitud enviada. Cuando el administrador la apruebe, {r.animales} {r.animales === 1 ? "animal pasará" : "animales pasarán"} a tu finca
          {typeof r.vivos === "number" ? ` (${r.vivos} ${r.vivos === 1 ? "vivo" : "vivos"})` : ""}, con su pedigrí.
        </Aviso>
      ) : null}

      <Boton type="submit" pendiente={pendiente} cargando="Buscando…">
        Enviar solicitud
      </Boton>
    </form>
  );
}
