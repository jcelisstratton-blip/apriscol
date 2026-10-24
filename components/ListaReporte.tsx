"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { textoCelda } from "@/lib/reportes/formato";
import type { Columna, FilaReporte } from "@/lib/reportes/tipos";

/** Cuántas filas hacen falta para ofrecer el buscador (por debajo se ve todo de un vistazo). */
const MINIMO_BUSCADOR = 8;

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Una fila del reporte: el título (con su enlace) y la insignia arriba, y debajo todos sus datos, en el celular también. */
function FilaDeReporte({ fila, columnas }: { fila: FilaReporte; columnas: Columna[] }) {
  const insignia = columnas.find((c) => c.insignia);
  const textoInsignia = insignia ? fila.valores[insignia.clave] : null;
  // Solo lo que aplica a este registro: un aborto no tiene crías ni pesos, un macho no tiene lactancia. El Excel sí lleva todas las columnas.
  const datos = columnas.filter((c) => !c.soloExcel && !c.insignia && fila.valores[c.clave] !== null && fila.valores[c.clave] !== undefined && fila.valores[c.clave] !== "");
  return (
    <article className="min-w-0 rounded-2xl bg-papel p-3.5 ring-1 ring-arena">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {fila.href ? (
          <Link href={fila.href} className="min-w-0 font-semibold leading-snug underline-offset-4 [overflow-wrap:anywhere] hover:underline">
            {fila.titulo}
          </Link>
        ) : (
          <p className="min-w-0 font-semibold leading-snug [overflow-wrap:anywhere]">{fila.titulo}</p>
        )}
        {textoInsignia ? (
          <span className="min-w-0 max-w-full [&>span]:whitespace-normal [overflow-wrap:anywhere]">
            <Insignia tono={fila.tono ?? "neutro"}>{String(textoInsignia)}</Insignia>
          </span>
        ) : null}
      </div>
      {datos.length > 0 ? (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          {datos.map((c) => (
            <div key={c.clave} className="min-w-0">
              <dt className="text-xs text-humo">{c.titulo}</dt>
              <dd className="text-[0.9375rem] font-medium tabular-nums [overflow-wrap:anywhere]">{textoCelda(c, fila.valores[c.clave])}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

/**
 * Las filas de un reporte: buscador (si hay más de unas pocas) y lista que carga por tramos de 20 con «Mostrando X de N».
 * Las filas llegan ya calculadas del servidor; aquí solo se busca y se dibuja por partes.
 */
export function ListaReporte({ filas, columnas, vacio }: { filas: FilaReporte[]; columnas: Columna[]; vacio: React.ReactNode }) {
  const [texto, setTexto] = useState("");
  const alBuscar = useCallback((t: string) => setTexto(t), []);

  // Lo que se puede buscar de cada fila: su título y todos sus datos, sin tildes ni mayúsculas.
  const indice = useMemo(() => filas.map((f) => ({ f, texto: sinTildes([f.titulo, ...Object.values(f.valores)].filter((v) => v !== null && v !== "").join(" ")) })), [filas]);
  const encontradas = useMemo(() => {
    const q = sinTildes(texto);
    return q ? indice.filter((x) => x.texto.includes(q)).map((x) => x.f) : filas;
  }, [indice, filas, texto]);

  const cargar = useCallback(async (desde: number, cantidad: number) => ({ filas: encontradas.slice(desde, desde + cantidad), total: encontradas.length }), [encontradas]);

  return (
    <div className="space-y-3">
      {filas.length > MINIMO_BUSCADOR ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete, nombre o dato" /> : null}
      <ListaEscalable
        key={texto}
        cargar={cargar}
        clave={(f) => f.id}
        fila={(f) => <FilaDeReporte fila={f} columnas={columnas} />}
        vacio={texto ? <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Nada coincide" descripcion={`No hay filas con «${texto}». Prueba con otra palabra.`} /> : vacio}
      />
    </div>
  );
}
