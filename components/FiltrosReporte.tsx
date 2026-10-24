import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import type { FiltroDef } from "@/lib/reportes/tipos";

/** La dirección del reporte con un filtro cambiado; los demás filtros y el periodo se conservan. Lo que vuelve a su valor por defecto sale de la dirección. */
export function direccionReporte(id: string, filtros: FiltroDef[], valores: Record<string, string>, extra: Record<string, string | undefined>, cambio?: { clave: string; valor: string }): string {
  const q = new URLSearchParams();
  for (const f of filtros) {
    const v = cambio?.clave === f.clave ? cambio.valor : valores[f.clave];
    if (v && v !== f.opciones[0].valor) q.set(f.clave, v);
  }
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const t = q.toString();
  return t ? `/reportes/${id}?${t}` : `/reportes/${id}`;
}

/** Los filtros de un reporte como tarjetas (la elegida lleva el check). Cada una es un enlace: la elección vive en la dirección y se puede compartir. */
export function FiltrosReporte({ id, filtros, valores, extra }: { id: string; filtros: FiltroDef[]; valores: Record<string, string>; extra: Record<string, string | undefined> }) {
  return (
    <div className="space-y-3">
      {filtros.map((f) => (
        <div key={f.clave}>
          <p className="mb-1 text-sm font-semibold text-humo">{f.titulo}</p>
          <FilaTarjetas etiqueta={f.titulo}>
            {f.opciones.map((o) => (
              <TarjetaOpcion
                key={o.valor}
                escena={o.escena}
                titulo={o.etiqueta}
                detalle={o.detalle}
                activo={valores[f.clave] === o.valor}
                href={direccionReporte(id, filtros, valores, extra, { clave: f.clave, valor: o.valor })}
              />
            ))}
          </FilaTarjetas>
        </div>
      ))}
    </div>
  );
}
