"use client";

import { useState, useSyncExternalStore } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { RecuadroTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { escena } from "@/lib/escenas";
import { TEXTO_TARJETAS, type PasoId } from "@/lib/migracion";

const CLAVE = (fincaId: string) => `apriscol:migracion-oculta:${fincaId}`;
const EVENTO = "apriscol:migracion-oculta";

/**
 * El aviso de Hoy mientras la finca se está migrando: cuántos pasos de «Migrar mi finca» van y un botón (una tarjeta) para seguir con el que toca. Se puede ocultar
 * (queda en este navegador, por finca); en Hoy solo se ofrece durante el primer mes de la finca.
 */
export function AvisoMigracion({ fincaId, hechos, total, siguiente }: { fincaId: string; hechos: number; total: number; siguiente: { id: PasoId; accion: string; titulo: string; href: string } }) {
  const clave = CLAVE(fincaId);
  // Lo oculto vive en el navegador (por finca); sin almacenamiento, el aviso se oculta solo en esta visita.
  const guardada = useSyncExternalStore(
    (avisar) => {
      window.addEventListener(EVENTO, avisar);
      return () => window.removeEventListener(EVENTO, avisar);
    },
    () => {
      try {
        return localStorage.getItem(clave) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const [soloAhora, setSoloAhora] = useState(false);
  if (guardada || soloAhora) return null;
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;

  const ocultar = () => {
    setSoloAhora(true);
    try {
      localStorage.setItem(clave, "1");
      window.dispatchEvent(new Event(EVENTO));
    } catch {
      /* sin almacenamiento: se oculta solo en esta visita */
    }
  };

  return (
    <section aria-label="Migración de tu finca" className="mb-4 space-y-2.5 lg:max-w-xl">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">Trae tu finca a Apriscol</h2>
          <p className="text-sm text-humo">Migración: {hechos} de {total} {total === 1 ? "paso" : "pasos"}</p>
        </div>
        <button type="button" onClick={ocultar} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-humo underline-offset-4 hover:underline">
          Ocultar
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-arena" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la migración">
        <div className="h-full rounded-full bg-musgo" style={{ width: `${pct}%` }} />
      </div>
      <RecuadroTarjetas compacto>
        <div className="grid grid-cols-1 gap-2.5">
          <TarjetaOpcion tamano="normal" destacada escena={escena(FileSpreadsheet, "musgo", Upload)} titulo={`Seguir: ${siguiente.titulo}`} detalle={TEXTO_TARJETAS[siguiente.id].cargar} href={siguiente.href} />
        </div>
      </RecuadroTarjetas>
    </section>
  );
}
