import { describirParentesco, etiquetaLinaje, porcentaje, puestoLinaje, type AncestroEndogamia, type NodoLinaje } from "@/lib/endogamia";

type Grupo = { chip: string; nombre: string | null; sexo: "macho" | "hembra"; total: number; rutas: AncestroEndogamia[] };

function agrupar(filas: AncestroEndogamia[]): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const f of filas) {
    const k = `${f.ancestro_chip}|${f.ancestro_nombre ?? ""}`;
    const g = mapa.get(k) ?? { chip: f.ancestro_chip, nombre: f.ancestro_nombre, sexo: f.ancestro_sexo, total: 0, rutas: [] };
    g.total += f.aporte;
    g.rutas.push(f);
    mapa.set(k, g);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

function Linea({ titulo, nodos }: { titulo: string; nodos: NodoLinaje[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-humo">{titulo}</p>
      <ol className="space-y-2 border-l-2 border-arena pl-3">
        {nodos.map((n, i) => {
          const ultimo = i === nodos.length - 1;
          return (
            <li key={`${n.c}-${i}`} className="relative min-w-0">
              <span
                aria-hidden="true"
                className={`absolute -left-[1.1875rem] top-1.5 size-2.5 rounded-full ring-2 ring-lana ${ultimo ? "bg-ocre" : "bg-humo/50"}`}
              />
              <span className="block text-xs text-humo">{ultimo ? `${puestoLinaje(i + 1, n.s)} · ancestro repetido` : puestoLinaje(i + 1, n.s)}</span>
              <span className={`block text-[0.9375rem] [overflow-wrap:anywhere] ${ultimo ? "font-bold" : "font-semibold"}`}>{etiquetaLinaje(n)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Por qué hay endogamia: cada ancestro que aparece por el lado del padre y por el de la madre, cuánto aporta y la ruta
 * (identificador original y nombre de cada animal) desde el padre y desde la madre hasta él.
 */
export function RutasEndogamia({
  filas,
  rotuloPadre = "Por el padre",
  rotuloMadre = "Por la madre",
  cruza = false,
}: {
  filas: AncestroEndogamia[];
  rotuloPadre?: string;
  rotuloMadre?: string;
  /** true cuando se explica una cruza simulada (macho y hembra) y no un animal ya nacido. */
  cruza?: boolean;
}) {
  const parentesco = describirParentesco(filas);
  const grupos = agrupar(filas).slice(0, 6);
  if (grupos.length === 0) {
    return <p className="text-[0.9375rem] text-humo">No encontramos ancestros repetidos en el pedigrí registrado.</p>;
  }
  return (
    <div className="space-y-3">
      {parentesco ? (
        <p className="text-[0.9375rem] leading-snug [overflow-wrap:anywhere]">
          {cruza ? "El macho " : "Sus padres, "}
          <strong>{etiquetaLinaje(parentesco.padre)}</strong> y {cruza ? "la hembra " : ""}
          <strong>{etiquetaLinaje(parentesco.madre)}</strong>
          {cruza ? " son " : ", son "}
          <strong>{parentesco.relacion}</strong>
          {parentesco.via ? `: ${parentesco.via}` : ""}.
          {parentesco.otros > 0 ? ` Además comparten ${parentesco.otros} ${parentesco.otros === 1 ? "ancestro más" : "ancestros más"}.` : ""}
        </p>
      ) : null}
    <ul className="grid grid-cols-1 gap-3">
      {grupos.map((g) => (
        <li key={`${g.chip}|${g.nombre}`} className="min-w-0 rounded-2xl bg-lana p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-humo">Ancestro repetido</p>
              <p className="font-bold [overflow-wrap:anywhere]">{etiquetaLinaje({ c: g.chip, n: g.nombre })}</p>
            </div>
            <p className="shrink-0 text-right">
              <span className="block font-display text-xl font-semibold tabular-nums">{porcentaje(g.total)}</span>
              <span className="block text-xs text-humo">de la endogamia</span>
            </p>
          </div>
          <div className="mt-3 space-y-4">
            {g.rutas.slice(0, 3).map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Linea titulo={rotuloPadre} nodos={r.ruta_padre} />
                <Linea titulo={rotuloMadre} nodos={r.ruta_madre} />
              </div>
            ))}
            {g.rutas.length > 3 ? <p className="text-sm text-humo">y {g.rutas.length - 3} rutas más por este mismo ancestro.</p> : null}
          </div>
        </li>
      ))}
    </ul>
    </div>
  );
}
