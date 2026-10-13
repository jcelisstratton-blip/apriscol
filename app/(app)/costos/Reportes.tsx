import { Download } from "lucide-react";
import { TarjetaOpcion } from "@/components/TarjetaOpcion";
import { direccionExportar, REPORTES } from "@/lib/costos-reportes";
import { ESCENA_REPORTE } from "@/lib/escenas-costos";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { rangoPeriodo, type Periodo } from "@/lib/periodos";

/** Costos → Reportes: los seis reportes que se descargan en Excel, con el periodo elegido arriba. */
export function Reportes({ filtro }: { filtro: { periodo: Periodo; desde?: string; hasta?: string } }) {
  const rango = rangoPeriodo(filtro.periodo, hoyBogota(), filtro.desde, filtro.hasta);
  const texto =
    rango.desde && rango.hasta
      ? `del ${formatoFecha(rango.desde)} al ${formatoFecha(rango.hasta)}`
      : rango.desde
        ? `desde el ${formatoFecha(rango.desde)} hasta hoy`
        : rango.hasta
          ? `hasta el ${formatoFecha(rango.hasta)}`
          : "de todo el historial";
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-[0.9375rem] text-humo">
        <Download className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>
          Cada reporte se descarga en Excel con el nombre de la finca, el reporte y las fechas, <strong className="font-semibold text-tinta">{texto}</strong>. Cambia el periodo arriba para descargar otro.
        </span>
      </p>
      <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {REPORTES.map((r) => (
          <TarjetaOpcion key={r.id} tamano="normal" escena={ESCENA_REPORTE[r.id]} titulo={r.titulo} detalle={r.contiene} dato="Descargar Excel" href={direccionExportar(r.id, filtro)} descarga />
        ))}
      </div>
    </div>
  );
}
