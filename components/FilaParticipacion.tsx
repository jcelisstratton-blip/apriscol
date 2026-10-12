import Link from "next/link";
import { Pencil } from "lucide-react";
import { Insignia } from "@/components/Insignia";
import { VisorFoto } from "@/components/VisorFoto";
import { formatoFecha, litros } from "@/lib/fechas";
import { ETIQUETA_RESULTADO, pesos, TONO_RESULTADO } from "@/lib/ferias";
import type { ResultadoFeria } from "@/lib/tipos";

export type DatosParticipacion = {
  id: string;
  categoria: string;
  resultado: ResultadoFeria;
  puesto: number | null;
  puntaje: number | null;
  premio_descripcion: string | null;
  premio_en_dinero: number | null;
};

/** Una participación con su premio. `titulo` es el animal (en la feria) o la feria (en la ficha del animal). */
export function FilaParticipacion({
  p,
  titulo,
  enlace,
  detalle,
  fotoUrl,
  editar,
}: {
  p: DatosParticipacion;
  titulo: string;
  enlace?: string;
  detalle?: string;
  fotoUrl?: string;
  /** Dirección de la pantalla para corregir este premio (solo quien puede editar ferias). */
  editar?: string;
}) {
  const cuerpo = (
    <span className="block min-w-0">
      <span className="block font-bold [overflow-wrap:anywhere]">{titulo}</span>
      {detalle ? <span className="block text-sm text-humo">{detalle}</span> : null}
      <span className="block text-sm text-humo [overflow-wrap:anywhere]">{p.categoria}</span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Insignia tono={TONO_RESULTADO[p.resultado]}>{ETIQUETA_RESULTADO[p.resultado]}</Insignia>
        {p.puesto ? <Insignia>{p.puesto}.º puesto</Insignia> : null}
        {p.puntaje != null ? <Insignia>{litros(p.puntaje)} pts</Insignia> : null}
      </span>
      {p.premio_descripcion || p.premio_en_dinero ? (
        <span className="mt-1.5 block text-sm">
          {p.premio_descripcion}
          {p.premio_descripcion && p.premio_en_dinero ? " · " : ""}
          {p.premio_en_dinero ? <span className="font-semibold">{pesos(p.premio_en_dinero)}</span> : null}
        </span>
      ) : null}
    </span>
  );

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
      <div className="min-w-0 flex-1">
        {enlace ? (
          <Link href={enlace} className="block">
            {cuerpo}
          </Link>
        ) : (
          cuerpo
        )}
        {editar ? (
          <Link href={editar} className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
            <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
          </Link>
        ) : null}
      </div>
      {fotoUrl ? <VisorFoto url={fotoUrl} titulo={`${titulo} · ${p.categoria}`} /> : null}
    </div>
  );
}

export function rangoFechas(inicio: string, fin: string | null): string {
  if (!fin || fin === inicio) return formatoFecha(inicio);
  return `${formatoFecha(inicio, { day: "numeric", month: "short" })} – ${formatoFecha(fin)}`;
}
