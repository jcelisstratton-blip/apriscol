"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { RutasEndogamia } from "@/components/RutasEndogamia";
import { Tarjeta } from "@/components/Tarjeta";
import { consultarCruza, type ResultadoSimulacion } from "@/lib/cruza-cliente";
import { nivelEndogamia, pedigriTexto, porcentaje, recomendacionCruza } from "@/lib/endogamia";

/**
 * La endogamia que tendría la cría del servicio, calculada al elegir el macho: porcentaje, nivel frente al umbral de la finca, recomendación,
 * qué tan completo es cada pedigrí y de dónde viene. Usa los mismos cálculos del simulador de cruza. En una transferencia de embrión la pareja
 * es la madre genética (no la receptora). Con un macho o una hembra de otra finca no hay pedigrí en el sistema y se dice sin inventar un 0 %.
 */
export function EndogamiaServicio({
  umbral,
  machoId,
  parejaId,
  parejaEs,
  sinPedigri,
}: {
  umbral: number;
  machoId: string | null;
  parejaId: string | null;
  /** Quién es la pareja de la cría en este servicio: «la hembra» o «la madre genética». */
  parejaEs: "la hembra" | "la madre genética";
  /** Si el macho o la hembra son de otra finca, quién (no hay genealogía que calcular). */
  sinPedigri: string | null;
}) {
  // El resultado se guarda con la pareja a la que corresponde: si la pareja cambia, el anterior ya no vale y se vuelve a calcular.
  const clave = machoId && parejaId ? `${machoId}|${parejaId}` : null;
  const [respuesta, setRespuesta] = useState<{ clave: string; resultado: ResultadoSimulacion | null } | null>(null);
  const [verOrigen, setVerOrigen] = useState(false);

  useEffect(() => {
    if (!machoId || !parejaId || !clave) return;
    let vigente = true;
    consultarCruza(machoId, parejaId)
      .then((resultado) => vigente && setRespuesta({ clave, resultado }))
      .catch(() => vigente && setRespuesta({ clave, resultado: null }));
    return () => {
      vigente = false;
    };
  }, [machoId, parejaId, clave]);

  const calculando = clave !== null && respuesta?.clave !== clave;
  const resultado = respuesta?.clave === clave ? respuesta.resultado : null;
  const fallo = clave !== null && respuesta?.clave === clave && respuesta.resultado === null;

  if (sinPedigri) {
    return <Aviso tipo="info">Sin dato de endogamia: {sinPedigri} es de otra finca y no tenemos su pedigrí, así que no se puede calcular.</Aviso>;
  }
  if (!clave) return null;
  if (calculando) return <Cargando texto="Calculando la endogamia…" />;
  if (fallo) return <Aviso tipo="info">No pudimos calcular la endogamia de esta pareja. El servicio se puede guardar igual.</Aviso>;
  if (!resultado) return null;

  const nivel = nivelEndogamia(resultado.f, umbral);
  const pedigriMin = Math.min(resultado.pedigriMacho, resultado.pedigriHembra);
  return (
    <Tarjeta titulo="Endogamia de la cría">
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-4xl font-semibold leading-none tabular-nums">{porcentaje(resultado.f)}</p>
        <NivelEndogamia f={resultado.f} umbral={umbral} />
      </div>
      <Aviso tipo={nivel === "bajo" ? "exito" : nivel === "vigilar" ? "info" : "atencion"} className="mt-3.5">
        {recomendacionCruza(nivel)}
      </Aviso>
      {pedigriMin < 0.5 ? (
        <Aviso tipo="info" className="mt-3">
          El macho o {parejaEs} tienen pocos ancestros registrados ({pedigriTexto(resultado.pedigriMacho).toLowerCase()} el macho, {pedigriTexto(resultado.pedigriHembra).toLowerCase()} {parejaEs}): la endogamia real puede ser mayor.
        </Aviso>
      ) : null}
      <button type="button" onClick={() => setVerOrigen((v) => !v)} aria-expanded={verOrigen} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">
        {verOrigen ? "Ocultar de dónde viene" : "Ver de dónde viene"}
      </button>
      {verOrigen ? (
        resultado.origen.length === 0 ? (
          <p className="text-[0.9375rem] text-humo">No comparten ancestros conocidos, por eso la endogamia es {resultado.f === 0 ? "nula" : "baja"}.</p>
        ) : (
          <RutasEndogamia filas={resultado.origen} rotuloPadre="Por el macho" rotuloMadre={parejaEs === "la hembra" ? "Por la hembra" : "Por la madre genética"} cruza />
        )
      ) : null}
    </Tarjeta>
  );
}
