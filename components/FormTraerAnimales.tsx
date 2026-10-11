"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { traerAnimales } from "@/app/(app)/libro/actions";

export function FormTraerAnimales() {
  const [estado, enviar, pendiente] = useActionState(traerAnimales, undefined);
  const r = estado?.resultado;

  return (
    <form action={enviar} className="space-y-4">
      <Campo etiqueta="Tu número de documento" ayuda="Cédula o NIT del propietario registrado. Si es NIT, sirve con o sin el dígito de verificación.">
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

      <Campo
        etiqueta="Microchip de uno de tus animales"
        ayuda="Es el número del arete o microchip de cualquiera de tus animales registrados. Lo pedimos para confirmar que son tuyos."
      >
        {(id) => (
          <input
            id={id}
            name="chip"
            autoComplete="off"
            autoCapitalize="characters"
            required
            maxLength={30}
            className={CLASE_INPUT}
            placeholder="Como aparece en el arete"
          />
        )}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {r && !r.encontrado ? (
        <Aviso tipo="atencion">No pudimos confirmar tus animales con esos datos. Revisa el documento y el microchip e inténtalo de nuevo.</Aviso>
      ) : null}
      {r && r.encontrado && r.importados === 0 ? (
        <Aviso tipo="info">Los animales de ese documento ya están en una finca.</Aviso>
      ) : null}
      {r && r.encontrado && r.importados > 0 ? (
        <Aviso tipo="exito">
          Listo: trajimos {r.importados} {r.importados === 1 ? "animal" : "animales"} a tu finca.{" "}
          <Link href="/hato" className="font-semibold underline underline-offset-2">Ver mi hato</Link>
        </Aviso>
      ) : null}

      <Boton type="submit" pendiente={pendiente} cargando="Trayendo animales…">
        Traer mis animales
      </Boton>
    </form>
  );
}
