import Link from "next/link";
import { ArrowRight, Check, Lock } from "lucide-react";
import { clasesBoton } from "@/components/Boton";
import type { PasoMigracion } from "@/lib/migracion";

/** Un paso de «Migrar mi finca»: su estado real, lo que ya hay cargado y el botón que lleva a hacerlo. */
export function PasoMigrar({ p, numero }: { p: PasoMigracion; numero: number }) {
  const hecho = p.estado === "hecho";
  const bloqueado = p.estado === "bloqueado";
  return (
    <li className={`min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena ${bloqueado ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${hecho ? "bg-musgo text-sobre-musgo" : "bg-arena text-humo"}`} aria-hidden="true">
          {hecho ? <Check className="size-4" strokeWidth={2.6} /> : bloqueado ? <Lock className="size-3.5" strokeWidth={2.2} /> : numero}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="font-display text-lg font-semibold [overflow-wrap:anywhere]">{p.titulo}</h3>
            <span className="text-xs font-semibold text-humo">{hecho ? "Hecho" : p.opcional ? "Opcional" : "Pendiente"}</span>
          </div>
          {p.dato ? <p className="text-sm font-semibold text-musgo [overflow-wrap:anywhere]">{p.dato}</p> : null}
          <p className="text-sm text-humo [overflow-wrap:anywhere]">{p.detalle}</p>
          {bloqueado ? (
            <p className="text-sm font-semibold text-humo">{p.motivo}</p>
          ) : (
            <Link href={p.href} className={`${clasesBoton(hecho ? "secundario" : "primario", false)} mt-1`}>
              {p.accion} <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
