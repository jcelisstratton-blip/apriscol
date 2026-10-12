"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Insignia } from "@/components/Insignia";
import { Selector } from "@/components/Selector";
import { useToast } from "@/components/Toast";
import { definirUsoMacho, posponerCeba, quitarAplazamientoCeba } from "@/app/(app)/carne/ceba-actions";
import { ETIQUETA_NIVEL, type TextoAdvertencia } from "@/lib/ceba-candidatos";
import { formatoFecha } from "@/lib/fechas";
import type { NivelCeba, SexoAnimal, UsoMacho } from "@/lib/tipos";

const TONO = { aviso: "text-ambar", alerta: "text-rojo", neutro: "text-humo" } as const;
const PLAZOS = [
  { valor: "1", etiqueta: "En 1 mes" },
  { valor: "3", etiqueta: "En 3 meses" },
  { valor: "6", etiqueta: "En 6 meses" },
];

/**
 * En la ficha, dentro de «Peso y ceba»: este animal conviene pasarlo a ceba (o está por llegar). Dice por qué, qué tener en cuenta y deja
 * decidir: elegir el lote (más abajo en la misma tarjeta), definir el uso de un macho o recordárselo después.
 */
export function CandidatoCeba({
  animalId,
  sexo,
  usoMacho,
  nivel,
  motivos,
  advertencias,
  puedeEditar,
}: {
  animalId: string;
  sexo: SexoAnimal;
  usoMacho: UsoMacho | null;
  nivel: NivelCeba;
  motivos: string[];
  advertencias: TextoAdvertencia[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [plazo, setPlazo] = useState("");

  const aplazar = (v: string) => {
    setPlazo(v);
    iniciar(async () => {
      setError(null);
      const r = await posponerCeba({ animalId, meses: Number(v) as 1 | 3 | 6 });
      setPlazo("");
      if (!r.ok) return setError(r.error);
      toast.exito(r.hasta ? `Te lo recordamos el ${formatoFecha(r.hasta, { day: "numeric", month: "long" })}` : "Aviso aplazado");
      router.refresh();
    });
  };

  const definir = (uso: "reproductor" | "carne") =>
    iniciar(async () => {
      setError(null);
      const r = await definirUsoMacho({ animalId, uso });
      if (!r.ok) return setError(r.error);
      toast.exito(uso === "carne" ? "Queda como macho de carne" : "Queda como reproductor");
      router.refresh();
    });

  return (
    <div className="mb-3 space-y-2.5 rounded-2xl bg-lana p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">
          {nivel === "toca" ? "Conviene" : "Pronto conviene"} {sexo === "hembra" ? "pasarla" : "pasarlo"} a ceba
        </p>
        <span className="shrink-0 whitespace-nowrap">
          <Insignia tono={nivel === "toca" ? "alerta" : "aviso"}>{ETIQUETA_NIVEL[nivel]}</Insignia>
        </span>
      </div>
      {motivos.map((m) => (
        <p key={m} className="text-[0.9375rem] [overflow-wrap:anywhere]">{m}</p>
      ))}
      {advertencias.map((a) => (
        <p key={a.codigo} className={`flex items-start gap-1.5 text-sm ${TONO[a.tono]}`}>
          {a.tono === "neutro" ? null : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
          <span className="min-w-0 [overflow-wrap:anywhere]">{a.texto}</span>
        </p>
      ))}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {puedeEditar ? (
        <div className="space-y-2 pt-1">
          <p className="text-sm text-humo">Para pasar a ceba, elige su lote más abajo.</p>
          {sexo === "macho" && usoMacho !== "carne" ? (
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {usoMacho !== "reproductor" ? (
                <Boton type="button" variante="secundario" onClick={() => definir("reproductor")} disabled={pendiente}>
                  Será reproductor
                </Boton>
              ) : null}
              <Boton type="button" variante="secundario" onClick={() => definir("carne")} disabled={pendiente}>
                Será de carne
              </Boton>
            </div>
          ) : null}
          <Selector valor={plazo} onCambio={(v) => v && aplazar(String(v))} titulo="Recordármelo después" placeholder="Recordármelo después…" opciones={PLAZOS} deshabilitado={pendiente} />
        </div>
      ) : null}
    </div>
  );
}

/** Si el aviso de ceba de este animal está aplazado: hasta cuándo y cómo volver a verlo. */
export function AplazadoCeba({ animalId, hasta, puedeEditar }: { animalId: string; hasta: string; puedeEditar: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const quitar = () =>
    iniciar(async () => {
      setError(null);
      const r = await quitarAplazamientoCeba(animalId);
      if (!r.ok) return setError(r.error);
      toast.exito("Volverá a avisarte si corresponde");
      router.refresh();
    });

  return (
    <div className="mb-3 space-y-1 text-sm text-humo">
      <p>
        Aviso de ceba aplazado hasta el {formatoFecha(hasta, { day: "numeric", month: "long", year: "numeric" })}.
        {puedeEditar ? (
          <>
            {" "}
            <button type="button" onClick={quitar} disabled={pendiente} className="font-semibold text-musgo underline-offset-4 hover:underline disabled:opacity-60">
              Quitar el aplazamiento
            </button>
          </>
        ) : null}
      </p>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
