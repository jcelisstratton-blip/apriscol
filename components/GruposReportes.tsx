import { TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_REPORTE } from "@/lib/escenas-reportes";
import { GRUPOS_REPORTE } from "@/lib/reportes/catalogo";
import type { ReporteDef, ReporteId } from "@/lib/reportes/tipos";

const REJILLA = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4";

/** Las tarjetas de la pantalla de Reportes, agrupadas por área de trabajo. Cada una lleva directo a su reporte; `datos` pone un conteo en las que lo tienen. */
export function GruposReportes({ reportes, datos, conCostos }: { reportes: ReporteDef[]; datos: Partial<Record<ReporteId, string>>; conCostos: boolean }) {
  return (
    <div className="space-y-6">
      {GRUPOS_REPORTE.map((g) => {
        const delGrupo = reportes.filter((r) => r.grupo === g.id);
        if (delGrupo.length === 0) return null;
        return (
          <section key={g.id} aria-labelledby={`grupo-${g.id}`}>
            <h2 id={`grupo-${g.id}`} className="font-display text-xl font-semibold tracking-tight">{g.titulo}</h2>
            <p className="mb-2.5 text-sm text-humo">{g.detalle}</p>
            <div className={REJILLA}>
              {delGrupo.map((r) => (
                <TarjetaOpcion key={r.id} tamano="normal" escena={ESCENA_REPORTE[r.id]} titulo={r.titulo} detalle={r.detalle} dato={datos[r.id]} href={`/reportes/${r.id}`} />
              ))}
            </div>
          </section>
        );
      })}
      {conCostos ? (
        <section aria-labelledby="grupo-dinero">
          <h2 id="grupo-dinero" className="font-display text-xl font-semibold tracking-tight">Dinero</h2>
          <p className="mb-2.5 text-sm text-humo">Lo que cuesta y lo que deja el aprisco</p>
          <div className={REJILLA}>
            <TarjetaOpcion tamano="normal" escena={ESCENA_REPORTE.costos} titulo="Costos y ventas" detalle="Costo por litro, por animal y resultado, con Excel" href="/costos" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
