"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { traerAnimales } from "@/app/(app)/libro/actions";

/** Paso único de «traer mis animales». `alFinalizar` cierra el paso (terminar u omitir) y lleva al panel. */
export function FormTraerAnimales({ alFinalizar }: { alFinalizar: () => Promise<void> }) {
  const [estado, enviar, pendiente] = useActionState(traerAnimales, undefined);
  const r = estado?.resultado;
  const trajo = Boolean(r && r.encontrado && r.importados > 0);

  return (
    <div className="space-y-5">
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
            Listo: trajimos {r.importados} {r.importados === 1 ? "animal" : "animales"} a tu finca. Si tienes más a nombre de otro documento (una empresa, por
            ejemplo), escríbelo y vuelve a traer; si no, continúa.
          </Aviso>
        ) : null}

        <Boton type="submit" pendiente={pendiente} cargando="Trayendo animales…" variante={trajo ? "secundario" : "primario"}>
          Traer mis animales
        </Boton>
      </form>
      <form action={alFinalizar}>
        <Boton type="submit" variante={trajo ? "primario" : "fantasma"}>
          {trajo ? "Continuar" : "Omitir: registraré mis animales yo"}
        </Boton>
      </form>
      {trajo ? null : (
        <p className="text-center text-sm text-humo">Esta opción es de una sola vez. Si omites, los animales nuevos los registras tú desde el hato.</p>
      )}
    </div>
  );
}
