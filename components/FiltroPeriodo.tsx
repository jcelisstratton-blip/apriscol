import { ChipEnlace } from "@/components/ChipEnlace";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { formatoFecha, hoyBogota } from "@/lib/fechas";
import { PERIODOS, rangoPeriodo, type Periodo } from "@/lib/periodos";

export type FiltroFechas = { periodo: Periodo; desde?: string; hasta?: string };

/**
 * El filtro por fechas de un menú: Todo, Este año, 12, 6 o 3 meses, o «Entre fechas» (con dos campos de fecha). Vive en la dirección
 * (`periodo`, `desde`, `hasta`) para que se pueda compartir y recargar; los demás parámetros de la pantalla (`fijos`) se conservan.
 */
export function FiltroPeriodo({
  ruta,
  fijos = {},
  filtro,
  etiquetaRango = "Del",
}: {
  /** La ruta del menú, por ejemplo `/sanidad`. */
  ruta: string;
  /** Parámetros que se mantienen al cambiar de periodo (la pestaña, el tipo…). */
  fijos?: Record<string, string>;
  filtro: FiltroFechas;
  etiquetaRango?: string;
}) {
  const direccion = (periodo: Periodo) => {
    const q = new URLSearchParams(fijos);
    if (periodo !== "todo") q.set("periodo", periodo);
    if (periodo === "rango") {
      if (filtro.desde) q.set("desde", filtro.desde);
      if (filtro.hasta) q.set("hasta", filtro.hasta);
    }
    const t = q.toString();
    return t ? `${ruta}?${t}` : ruta;
  };
  const rango = rangoPeriodo(filtro.periodo, hoyBogota(), filtro.desde, filtro.hasta);

  return (
    <div className="space-y-2">
      <FilaDesplazable>
        {PERIODOS.map((p) => (
          <ChipEnlace key={p.valor} href={direccion(p.valor)} activo={filtro.periodo === p.valor}>
            {p.etiqueta}
          </ChipEnlace>
        ))}
      </FilaDesplazable>
      {filtro.periodo === "rango" ? (
        <form method="get" action={ruta} className="flex flex-wrap items-end gap-2 rounded-2xl bg-lana p-3">
          {Object.entries(fijos).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="periodo" value="rango" />
          <label className="min-w-0 flex-1 text-sm font-semibold">
            Desde
            <input type="date" name="desde" defaultValue={filtro.desde ?? ""} className="mt-1 min-h-12 w-full rounded-2xl border border-arena bg-papel px-3 text-base" />
          </label>
          <label className="min-w-0 flex-1 text-sm font-semibold">
            Hasta
            <input type="date" name="hasta" defaultValue={filtro.hasta ?? ""} className="mt-1 min-h-12 w-full rounded-2xl border border-arena bg-papel px-3 text-base" />
          </label>
          <button type="submit" className="min-h-12 rounded-2xl bg-musgo px-5 text-base font-semibold text-sobre-musgo">
            Aplicar
          </button>
        </form>
      ) : null}
      {rango.desde || rango.hasta ? (
        <p className="text-sm text-humo">
          {etiquetaRango} {rango.desde ? `${formatoFecha(rango.desde)}` : "el inicio"} {rango.hasta ? `al ${formatoFecha(rango.hasta)}` : "a hoy"}.
        </p>
      ) : null}
    </div>
  );
}
