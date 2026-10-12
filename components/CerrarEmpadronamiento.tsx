"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Segmentado } from "@/components/Segmentado";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { cerrarEmpadronamiento } from "@/app/(app)/reproduccion/empadronamiento/actions";
import { formatoFecha, sumarDias } from "@/lib/fechas";

/**
 * Cerrar la temporada de monta. Cada hembra queda servida por su semental en la fecha base y desde ahí se cuenta la gestación
 * (ovinos 147 días, caprinos 150). Por omisión la base es el cierre: el parto más tardío que se puede esperar.
 */
export function CerrarEmpadronamiento({
  loteId,
  inicio,
  hoy,
  hembras,
  gestacionDias,
  especie,
}: {
  loteId: string;
  inicio: string;
  hoy: string;
  hembras: number;
  gestacionDias: number;
  especie: "caprino" | "ovino";
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierta, setAbierta] = useState(false);
  const [cierre, setCierre] = useState(hoy);
  const [modo, setModo] = useState<"cierre" | "otra">("cierre");
  const [otra, setOtra] = useState(cierre);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const base = modo === "cierre" ? cierre : otra;
  const baseValida = /^\d{4}-\d{2}-\d{2}$/.test(base) && base >= inicio && base <= cierre;
  const prevista = baseValida ? sumarDias(base, gestacionDias) : null;

  const cerrar = () =>
    iniciar(async () => {
      setError(null);
      const r = await cerrarEmpadronamiento({ loteId, cierre, base: modo === "cierre" ? null : otra });
      if (!r.ok) return setError(r.error);
      toast.exito(`Temporada cerrada: ${r.servicios} ${r.servicios === 1 ? "hembra pasó" : "hembras pasaron"} a servida`);
      setAbierta(false);
      router.refresh();
    });

  return (
    <>
      <Boton onClick={() => setAbierta(true)} disabled={hembras === 0}>
        <Flag className="size-5" strokeWidth={2} aria-hidden="true" /> Cerrar la temporada
      </Boton>
      {hembras === 0 ? <p className="mt-1.5 text-center text-sm text-humo">Agrega al menos una hembra para poder cerrarla.</p> : null}
      <Sheet
        abierta={abierta}
        onCerrar={() => (pendiente ? undefined : setAbierta(false))}
        titulo="Cerrar la temporada"
        pie={
          <Boton onClick={cerrar} pendiente={pendiente} cargando="Cerrando…" disabled={!baseValida || !/^\d{4}-\d{2}-\d{2}$/.test(cierre) || cierre < inicio || cierre > hoy}>
            Cerrar y pasar a gestación
          </Boton>
        }
      >
        <div className="space-y-4">
          <p className="text-[0.9375rem]">
            Las {hembras} {hembras === 1 ? "hembra" : "hembras"} quedan <strong>servidas</strong> por su semental, con su fecha prevista de parto.
            Cuando confirmes con un diagnóstico, pasan a gestantes.
          </p>
          <Campo etiqueta="¿Cuándo terminó la temporada?">
            {(id) => <input id={id} type="date" value={cierre} min={inicio} max={hoy} onChange={(e) => setCierre(e.target.value)} className={CLASE_INPUT} />}
          </Campo>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Contar la gestación desde</p>
            <Segmentado<"cierre" | "otra"> etiqueta="Fecha base" valor={modo} onCambio={setModo} opciones={[{ valor: "cierre", etiqueta: "El cierre" }, { valor: "otra", etiqueta: "Otra fecha" }]} />
            {modo === "otra" ? (
              <input type="date" value={otra} min={inicio} max={cierre} onChange={(e) => setOtra(e.target.value)} aria-label="Fecha base" className={CLASE_INPUT} />
            ) : null}
            <p className="text-[0.8125rem] text-humo">
              En monta en grupo no se sabe qué día quedó cada hembra. Contar desde el cierre da el parto más tardío posible; si viste la monta, elige otra fecha.
              Cada hembra puede corregirse después desde su ficha.
            </p>
          </div>
          {prevista ? (
            <Aviso tipo="info">
              {gestacionDias} días de gestación ({especie === "ovino" ? "ovinos" : "caprinos"}): los partos se esperan hacia el {formatoFecha(prevista)}.
            </Aviso>
          ) : (
            <Aviso tipo="atencion">La fecha base debe estar entre el inicio de la temporada y el cierre.</Aviso>
          )}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}
