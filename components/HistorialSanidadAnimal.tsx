"use client";

import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import { IconoEvento } from "@/components/IconoEvento";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { formatoFecha } from "@/lib/fechas";
import { FAMACHA } from "@/lib/famacha";
import { TarjetasExamen } from "@/components/TarjetasExamen";
import type { MomentoCoprologico, TecnicaCoprologico } from "@/lib/coprologico";
import { ETIQUETA_EVENTO, ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, TONO_RESULTADO_PRUEBA, nombreEvento } from "@/lib/sanidad";
import type { ResultadoPrueba, TipoEvento, TipoPrueba } from "@/lib/tipos";

export type EventoFila = {
  clave: string;
  fecha: string;
  tipo: TipoEvento | null;
  producto_nombre: string | null;
  lote_producto: string | null;
  evento_id: string;
  retiro_leche_hasta: string | null;
  retiro_carne_hasta: string | null;
};
export type PruebaFila = { clave: string; fecha: string; prueba: TipoPrueba; resultado: ResultadoPrueba; laboratorio: string | null; id: string };
export type FamachaFila = { clave: string; id: string; fecha: string; puntaje: number; observaciones: string | null };
export type CoprologicoFila = { clave: string; id: string; fecha: string; hpg: number | null; opg: number | null; momento: MomentoCoprologico; tecnica: TecnicaCoprologico; observaciones: string | null; otros_parasitos: string[]; laboratorio: string | null; tipo_muestra: "limpia" | "contaminada" | null; tomada_por: string | null };
type Fila = ({ clase: "evento" } & EventoFila) | ({ clase: "prueba" } & PruebaFila) | ({ clase: "famacha" } & FamachaFila) | ({ clase: "coprologico" } & CoprologicoFila);

/** Todo lo sanitario de un animal en una sola línea de tiempo (vacunas, tratamientos y pruebas), lo más reciente primero. */
export function HistorialSanidadAnimal({ eventos, pruebas, famacha = [], coprologicos = [], puedeEditar }: { eventos: EventoFila[]; pruebas: PruebaFila[]; famacha?: FamachaFila[]; coprologicos?: CoprologicoFila[]; puedeEditar: boolean }) {
  const filas: Fila[] = [
    ...eventos.map((e) => ({ clase: "evento" as const, ...e })),
    ...pruebas.map((p) => ({ clase: "prueba" as const, ...p })),
    ...famacha.map((f) => ({ clase: "famacha" as const, ...f })),
    ...coprologicos.map((c) => ({ clase: "coprologico" as const, ...c })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <ListaPorTramos
      items={filas}
      clave={(f) => f.clave}
      tramo={10}
      fila={(f) =>
        f.clase === "evento" ? (
          <Link href={`/sanidad/evento/${f.evento_id}`} className="flex min-h-[4rem] items-center gap-3 rounded-2xl bg-lana px-3 py-2.5">
            <IconoEvento tipo={f.tipo} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold [overflow-wrap:anywhere]">{nombreEvento(f)}</span>
              <span className="block text-sm text-humo">
                {f.tipo ? ETIQUETA_EVENTO[f.tipo] : ""} · {formatoFecha(f.fecha, { day: "numeric", month: "short", year: "numeric" })}
                {f.lote_producto ? ` · Lote ${f.lote_producto}` : ""}
              </span>
              {f.retiro_leche_hasta || f.retiro_carne_hasta ? (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {f.retiro_leche_hasta ? <Insignia tono="aviso">Leche hasta {formatoFecha(f.retiro_leche_hasta, { day: "numeric", month: "short" })}</Insignia> : null}
                  {f.retiro_carne_hasta ? <Insignia tono="alerta">Carne hasta {formatoFecha(f.retiro_carne_hasta, { day: "numeric", month: "short" })}</Insignia> : null}
                </span>
              ) : null}
            </span>
            <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} />
          </Link>
        ) : f.clase === "famacha" ? (
          <div className="flex min-h-[4rem] items-start justify-between gap-3 rounded-2xl bg-lana px-3 py-2.5">
            <span className="min-w-0">
              <span className="block font-semibold">FAMACHA {f.puntaje}</span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                {FAMACHA[f.puntaje].color} · {formatoFecha(f.fecha, { day: "numeric", month: "short", year: "numeric" })}
                {f.observaciones ? ` · ${f.observaciones}` : ""}
              </span>
              <span className="mt-1 block">
                <Insignia tono={FAMACHA[f.puntaje].tono}>{FAMACHA[f.puntaje].texto}</Insignia>
              </span>
            </span>
            {puedeEditar ? (
              <Link href={`/hato/sanidad/famacha/${f.id}/editar`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        ) : f.clase === "coprologico" ? (
          <div className="space-y-2 rounded-2xl bg-papel px-3 py-2.5 ring-1 ring-arena">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/sanidad/coprologico/${f.id}`} className="inline-flex min-h-11 items-center font-semibold hover:underline">
                Examen coprológico · {formatoFecha(f.fecha, { day: "numeric", month: "short", year: "numeric" })}
              </Link>
              {puedeEditar ? (
                <Link href={`/hato/sanidad/coprologico/${f.id}/editar`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                  <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
                </Link>
              ) : null}
            </div>
            <TarjetasExamen x={{ ...f, otros_parasitos: f.otros_parasitos, laboratorio: f.laboratorio }} compacta />
          </div>
        ) : (
          <div className="flex min-h-[4rem] items-start justify-between gap-3 rounded-2xl bg-lana px-3 py-2.5">
            <span className="min-w-0">
              <span className="block font-semibold">{ETIQUETA_PRUEBA_CORTA[f.prueba]}</span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                Prueba · {formatoFecha(f.fecha, { day: "numeric", month: "short", year: "numeric" })}
                {f.laboratorio ? ` · ${f.laboratorio}` : ""}
              </span>
              <span className="mt-1 block">
                <Insignia tono={TONO_RESULTADO_PRUEBA[f.resultado]}>{ETIQUETA_RESULTADO_PRUEBA[f.resultado]}</Insignia>
              </span>
            </span>
            {puedeEditar ? (
              <Link href={`/sanidad/pruebas/${f.id}/editar`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        )
      }
    />
  );
}
