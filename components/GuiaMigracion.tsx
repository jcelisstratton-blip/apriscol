import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";
import { clasesBoton } from "@/components/Boton";
import { PasoMigrar } from "@/components/PasoMigrar";
import { Tarjeta } from "@/components/Tarjeta";
import { avanceMigracion, etapasMigracion, siguientePaso, type PasoMigracion } from "@/lib/migracion";

/**
 * La guía de «Migrar mi finca»: el avance, el paso que sigue (resaltado, como en las listas de configuración de Wix, Klaviyo o Square) y los pasos agrupados por
 * etapas, cada uno en su tarjeta con su texto. Solo dibuja: los pasos ya vienen con su estado real.
 */
export function GuiaMigracion({ pasos }: { pasos: PasoMigracion[] }) {
  const etapas = etapasMigracion(pasos);
  const { hechos, total } = avanceMigracion(pasos);
  const siguiente = siguientePaso(pasos);
  const porcentaje = total > 0 ? Math.round((hechos / total) * 100) : 0;
  return (
    <>
        <Tarjeta>
          <div className="space-y-3.5">
            <p className="text-[0.9375rem] leading-relaxed text-humo">
              Trae tu finca a Apriscol paso a paso, con los Excel que ya tienes. Cada cargue se revisa antes de guardarse y, si algo no queda bien, lo puedes deshacer.
            </p>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {hechos} de {total} pasos hechos
                </p>
                <p className="font-mono text-xs tabular-nums text-humo">{porcentaje} %</p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-arena" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={hechos} aria-label="Avance de la migración">
                <div className="h-full rounded-full bg-musgo transition-all" style={{ width: `${porcentaje}%` }} />
              </div>
            </div>
            {siguiente ? (
              <div className="flex flex-col gap-2.5 rounded-2xl bg-lana p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
                  <span className="text-humo">Sigue: </span>
                  <span className="font-semibold">{siguiente.titulo}</span>
                </p>
                <Link href={siguiente.href} className={clasesBoton("primario", false)}>
                  {siguiente.accion} <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl bg-musgo/10 p-3.5">
                <PartyPopper className="mt-0.5 size-5 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
                <p className="text-sm [overflow-wrap:anywhere]">
                  <span className="font-semibold">Tu finca ya tiene sus datos.</span> <span className="text-humo">Revisa los semáforos y el hato para confirmar que todo cuadra.</span>
                </p>
              </div>
            )}
          </div>
        </Tarjeta>

        {etapas.map((e, i) => (
          <section key={e.id} aria-labelledby={`etapa-${e.id}`} className="space-y-3">
            <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-humo">Etapa {i + 1}</p>
                <h2 id={`etapa-${e.id}`} className="font-display text-xl font-semibold leading-tight">
                  {e.titulo}
                </h2>
                <p className="mt-0.5 text-sm text-humo [overflow-wrap:anywhere]">{e.detalle}</p>
              </div>
              {e.total > 0 ? (
                <span className="shrink-0 rounded-full bg-arena px-2.5 py-0.5 text-xs font-semibold text-humo">
                  {e.hechos} de {e.total}
                </span>
              ) : null}
            </header>
            <ol className="grid grid-cols-1 gap-3">
              {e.pasos.map((p) => (
                <PasoMigrar key={p.id} p={p} siguiente={siguiente?.id === p.id} principal={siguiente?.id === p.id || (!siguiente && p.id === "revision")} />
              ))}
            </ol>
          </section>
        ))}
    </>
  );
}
