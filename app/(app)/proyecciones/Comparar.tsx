"use client";

import { useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Tarjeta } from "@/components/Tarjeta";
import { correr, totales, type Entrada } from "@/lib/proyeccion/analisis";
import type { EscenarioGuardado } from "@/lib/proyeccion/escenarios";
import { aplicarAjustes, type Ajustes, type Supuestos } from "@/lib/proyeccion/supuestos";
import { FILAS_COMPARACION, ganadores } from "@/lib/proyeccion/comparacion";
import { formatear } from "@/lib/proyeccion/vista";

/** Un escenario para comparar: los guardados y, aparte, lo que se ve ahora en pantalla (que puede tener cambios sin guardar). */
type Candidato = { clave: string; nombre: string; ajustes: Ajustes };
const PANTALLA = "__pantalla__";
const MAX = 3;

export function Comparar({ escenarios, ajustesPantalla, hayCambios, activoId, base, entrada }: { escenarios: EscenarioGuardado[]; ajustesPantalla: Ajustes; hayCambios: boolean; activoId: string | null; base: Supuestos; entrada: Entrada }) {
  const candidatos: Candidato[] = useMemo(() => {
    const lista: Candidato[] = escenarios.map((e) => ({ clave: e.id, nombre: e.nombre, ajustes: e.id === activoId ? ajustesPantalla : e.ajustes }));
    if (escenarios.length === 0 || (hayCambios && activoId === null)) lista.push({ clave: PANTALLA, nombre: "Lo que ves en pantalla", ajustes: ajustesPantalla });
    return lista;
  }, [escenarios, ajustesPantalla, hayCambios, activoId]);

  const [elegidos, setElegidos] = useState<string[]>(() => candidatos.slice(0, MAX).map((c) => c.clave));
  const vigentes = elegidos.filter((k) => candidatos.some((c) => c.clave === k));
  const columnas = useMemo(
    () =>
      vigentes.map((k) => {
        const c = candidatos.find((x) => x.clave === k)!;
        return { nombre: c.nombre, totales: totales(correr(entrada, aplicarAjustes(base, c.ajustes))) };
      }),
    [vigentes, candidatos, base, entrada],
  );

  function alternar(clave: string) {
    setElegidos((previos) => (previos.includes(clave) ? previos.filter((k) => k !== clave) : previos.length >= MAX ? previos : [...previos, clave]));
  }

  if (candidatos.length < 2) {
    return <Aviso tipo="info">Para comparar necesitas al menos dos escenarios. Cambia algunos números en «Supuestos» y usa «Nuevo con lo de pantalla» arriba para guardar el segundo.</Aviso>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Elige hasta {MAX} para comparar</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Escenarios a comparar">
          {candidatos.map((c) => {
            const activo = vigentes.includes(c.clave);
            return (
              <button
                key={c.clave}
                type="button"
                aria-pressed={activo}
                onClick={() => alternar(c.clave)}
                disabled={!activo && vigentes.length >= MAX}
                className={`min-h-11 max-w-full rounded-full px-4 text-[0.9375rem] font-semibold [overflow-wrap:anywhere] transition disabled:opacity-40 ${activo ? "bg-musgo text-sobre-musgo" : "bg-arena text-tinta hover:brightness-95"}`}
              >
                {c.nombre}
              </button>
            );
          })}
        </div>
      </div>
      {columnas.length < 2 ? (
        <Aviso tipo="info">Elige al menos dos escenarios.</Aviso>
      ) : (
        <>
          <p className="text-sm text-humo">Los {entrada.horizonte} meses completos, con el mismo hato de hoy. Lo mejor de cada fila va marcado.</p>
          <div className="hidden overflow-x-auto rounded-3xl bg-papel ring-1 ring-arena lg:block">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-arena text-left text-humo">
                  <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Cifra</span></th>
                  {columnas.map((c, i) => (
                    <th key={i} scope="col" className="px-3 py-3 text-right font-semibold [overflow-wrap:anywhere]">{c.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FILAS_COMPARACION.map((f) => {
                  const valores = columnas.map((c) => f.valor(c.totales));
                  const gana = ganadores(f, valores);
                  return (
                    <tr key={f.titulo} className={`border-b border-arena/60 last:border-0 ${f.destacada ? "bg-lana/60 font-bold" : ""}`}>
                      <th scope="row" className="px-4 py-2.5 text-left font-semibold">{f.titulo}</th>
                      {valores.map((v, i) => (
                        <td key={i} className={`px-3 py-2.5 text-right ${v < 0 && f.formato === "pesos" ? "text-rojo" : ""} ${gana[i] ? "font-bold text-musgo" : ""}`}>
                          {formatear(f.formato, v)}{gana[i] ? " ✓" : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {columnas.map((c, i) => (
              <li key={i} className="min-w-0">
                <Tarjeta titulo={c.nombre}>
                  <dl className="space-y-1.5">
                    {FILAS_COMPARACION.map((f) => {
                      const valores = columnas.map((x) => f.valor(x.totales));
                      const gana = ganadores(f, valores)[i];
                      return (
                        <div key={f.titulo} className={`flex items-baseline justify-between gap-3 ${f.destacada ? "border-t border-arena pt-2 font-bold" : ""}`}>
                          <dt className={`min-w-0 text-[0.9375rem] [overflow-wrap:anywhere] ${f.destacada ? "" : "text-humo"}`}>{f.titulo}</dt>
                          <dd className={`shrink-0 text-right text-[0.9375rem] font-semibold tabular-nums ${valores[i] < 0 && f.formato === "pesos" ? "text-rojo" : ""} ${gana ? "text-musgo" : ""}`}>
                            {formatear(f.formato, valores[i])}{gana ? " ✓" : ""}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
