"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { ListaEscalable } from "@/components/ListaEscalable";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { deshacerGrupoImportacion, deshacerImportacion } from "@/app/(app)/hato/importar/actions";
import { agruparTramos, type CargueVista } from "@/lib/cargues";

export type { CargueVista } from "@/lib/cargues";

const MODO: Record<CargueVista["modo"], string> = { nuevos: "Solo los nuevos", completar: "Nuevos y completar", corregir: "Nuevos y corregir" };
const REGISTRO = { animales: ["animal nuevo", "animales nuevos"], pesajes: ["peso cargado", "pesos cargados"], ordenos: ["ordeño cargado", "ordeños cargados"], sanidad: ["registro de sanidad", "registros de sanidad"] } as const;
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Los últimos cargues de Excel de la finca; el propietario y los administradores pueden deshacer los que aún se pueden. */
export function HistorialImportaciones({ cargues: tramos, puedeDeshacer }: { cargues: CargueVista[]; puedeDeshacer: boolean }) {
  const cargues = agruparTramos(tramos);
  const router = useRouter();
  const toast = useToast();
  const [elegido, setElegido] = useState<CargueVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deshaciendo, iniciar] = useTransition();

  const deshacer = () => {
    if (!elegido) return;
    setError(null);
    iniciar(async () => {
      try {
        const r = elegido.grupo ? await deshacerGrupoImportacion(elegido.grupo) : await deshacerImportacion(elegido.id);
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setElegido(null);
        toast.exito("Cargue deshecho");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo deshacer el cargue.");
      }
    });
  };

  return (
    <>
      <ListaEscalable<CargueVista>
        cargar={async (desde, cantidad) => ({ filas: cargues.slice(desde, desde + cantidad), total: cargues.length })}
        clave={(c) => c.id}
        vacio={null}
        tramo={10}
        fila={(c) => (
          <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-papel p-3 ring-1 ring-arena">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold [overflow-wrap:anywhere]">{c.archivo ?? "Archivo de Excel"}</p>
              <p className="text-xs text-humo">
                {fecha(c.created_at)}
                {c.tipo === "animales" ? ` · ${MODO[c.modo]}` : ""}
              </p>
              <p className="mt-0.5 text-sm [overflow-wrap:anywhere]">
                {[c.creados > 0 ? plural(c.creados, REGISTRO[c.tipo][0], REGISTRO[c.tipo][1]) : null, c.actualizados > 0 ? plural(c.actualizados, "actualizado", "actualizados") : null].filter(Boolean).join(" · ") || "Sin cambios"}
              </p>
              {c.estado === "deshecha" ? <p className="mt-0.5 text-xs font-semibold text-humo">Deshecho</p> : null}
            </div>
            {puedeDeshacer && c.estado === "aplicada" && (c.creados > 0 || c.actualizados > 0) ? (
              <button type="button" onClick={() => (setError(null), setElegido(c))} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-musgo hover:bg-arena/60">
                <Undo2 className="size-4" strokeWidth={1.75} aria-hidden="true" /> Deshacer
              </button>
            ) : null}
          </div>
        )}
      />
      <Sheet
        abierta={!!elegido}
        onCerrar={() => (deshaciendo ? undefined : setElegido(null))}
        titulo="¿Deshacer este cargue?"
        pie={
          <Boton variante="peligro" pendiente={deshaciendo} cargando="Deshaciendo…" onClick={deshacer}>
            Sí, deshacer el cargue
          </Boton>
        }
      >
        <div className="space-y-3">
          <p className="text-[0.9375rem] text-humo">
            Se quitarán los animales que creó «{elegido?.archivo ?? "este cargue"}», con su genealogía, servicios y corral, y se devolverán los datos que cambió en los que ya existían. Si alguno ya tiene registros (ordeños, pesajes, sanidad…) o se editó después, no se podrá deshacer.
          </p>
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
        </div>
      </Sheet>
    </>
  );
}
