"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { solicitarRenovacion, type ResultadoRenovacion } from "@/app/plan-vencido/actions";

/** Dos botones: renovar un mes o un año. Pide la renovación; el equipo la activa al confirmar el pago. */
export function SolicitarRenovacion({
  textoMes,
  textoAnio,
  pendiente,
  solicitar = solicitarRenovacion,
}: {
  textoMes: string;
  textoAnio: string;
  /** Periodo de la solicitud que ya está hecha, si la hay. */
  pendiente: "mensual" | "anual" | null;
  solicitar?: (periodo: string) => Promise<ResultadoRenovacion>;
}) {
  const [enviada, setEnviada] = useState<"mensual" | "anual" | null>(pendiente);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();
  const [cual, setCual] = useState<"mensual" | "anual" | null>(null);

  const pedir = (periodo: "mensual" | "anual") => {
    setError(null);
    setCual(periodo);
    iniciar(async () => {
      const r = await solicitar(periodo);
      if (r.ok) setEnviada(periodo);
      else setError(r.error);
    });
  };

  return (
    <div className="space-y-3">
      {enviada ? (
        <Aviso tipo="exito">
          Pediste renovar {enviada === "anual" ? "por un año" : "por un mes"}. El equipo de Apriscol te confirma cómo pagar y activa tu plan apenas se confirme el pago.
        </Aviso>
      ) : null}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Boton type="button" variante={enviada === "mensual" ? "secundario" : "primario"} onClick={() => pedir("mensual")} pendiente={trabajando && cual === "mensual"} cargando="Enviando…">
          {textoMes}
        </Boton>
        <Boton type="button" variante={enviada === "anual" ? "secundario" : "primario"} onClick={() => pedir("anual")} pendiente={trabajando && cual === "anual"} cargando="Enviando…">
          {textoAnio}
        </Boton>
      </div>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
