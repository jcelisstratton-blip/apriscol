"use client";

import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { Campo } from "@/components/Campo";
import { Cargando } from "@/components/Cargando";
import { NivelEndogamia } from "@/components/NivelEndogamia";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { Tarjeta } from "@/components/Tarjeta";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { RutasEndogamia } from "@/components/RutasEndogamia";
import { nivelEndogamia, pedigriTexto, porcentaje, recomendacionCruza, type AncestroEndogamia } from "@/lib/endogamia";
import type { Especie } from "@/lib/tipos";

export type RefCruza = { id: string; numero_arete: string; nombre: string | null; especie?: Especie };
export type ResultadoSimulacion = { f: number; pedigriMacho: number; pedigriHembra: number; origen: AncestroEndogamia[] };

/** Simulador de cruza: elige un macho y una hembra y muestra la endogamia que tendría la cría. */
export function FormCruza({
  fincaId,
  umbral,
  machoInicial,
  hembraInicial,
}: {
  fincaId: string;
  umbral: number;
  machoInicial: RefCruza | null;
  hembraInicial: RefCruza | null;
}) {
  const [macho, setMacho] = useState<RefCruza | null>(machoInicial);
  const [hembra, setHembra] = useState<RefCruza | null>(hembraInicial);
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const calcular = (m: RefCruza | null, h: RefCruza | null) => {
    setResultado(null);
    setError(null);
    if (!m || !h) return;
    iniciar(async () => {
      const supabase = crearClienteNavegador();
      const [sim, pm, ph, com] = await Promise.all([
        supabase.rpc("simular_endogamia", { p_macho: m.id, p_hembra: h.id }),
        supabase.rpc("completitud_pedigri", { p_animal: m.id }),
        supabase.rpc("completitud_pedigri", { p_animal: h.id }),
        supabase.rpc("explicar_cruza", { p_macho: m.id, p_hembra: h.id }),
      ]);
      const fallo = sim.error ?? pm.error ?? ph.error ?? com.error;
      if (fallo) return setError(fallo.message);
      setResultado({ f: sim.data ?? 0, pedigriMacho: pm.data ?? 0, pedigriHembra: ph.data ?? 0, origen: com.data ?? [] });
    });
  };

  const elegirMacho = (a: RefCruza | null) => {
    // Si cambia la especie, la pareja elegida ya no sirve.
    const hembraValida = hembra && (!a?.especie || !hembra.especie || a.especie === hembra.especie) ? hembra : null;
    setMacho(a);
    setHembra(hembraValida);
    calcular(a, hembraValida);
  };
  const elegirHembra = (a: RefCruza | null) => {
    const machoValido = macho && (!a?.especie || !macho.especie || a.especie === macho.especie) ? macho : null;
    setHembra(a);
    setMacho(machoValido);
    calcular(machoValido, a);
  };

  return (
    <div className="space-y-3.5">
      <Tarjeta>
        <div className="space-y-4">
          <Campo etiqueta="Macho">
            {(id) => (
              <SelectorAnimal
                id={id}
                nombre="macho"
                fincaId={fincaId}
                sexo="macho"
                especie={hembra?.especie}
                titulo="Elegir macho"
                valor={macho}
                onCambio={elegirMacho}
              />
            )}
          </Campo>
          <Campo etiqueta="Hembra">
            {(id) => (
              <SelectorAnimal
                id={id}
                nombre="hembra"
                fincaId={fincaId}
                sexo="hembra"
                especie={macho?.especie}
                titulo="Elegir hembra"
                valor={hembra}
                onCambio={elegirHembra}
              />
            )}
          </Campo>
        </div>
      </Tarjeta>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {pendiente ? <Cargando texto="Calculando la cruza…" /> : null}

      {!pendiente && !resultado && !error ? (
        <p className="px-1 text-[0.9375rem] text-humo">
          Elige un macho y una hembra de la misma especie y te decimos qué endogamia tendría su cría, antes de cruzarlos.
        </p>
      ) : null}

      {resultado ? <ResultadoCruza resultado={resultado} umbral={umbral} /> : null}
    </div>
  );
}

export function ResultadoCruza({ resultado, umbral }: { resultado: ResultadoSimulacion; umbral: number }) {
  const nivel = nivelEndogamia(resultado.f, umbral);
  const pedigriMin = Math.min(resultado.pedigriMacho, resultado.pedigriHembra);
  return (
    <>
          <Tarjeta titulo="Endogamia de la cría">
            <div className="flex items-end justify-between gap-3">
              <p className="font-display text-5xl font-semibold leading-none tabular-nums">{porcentaje(resultado.f)}</p>
              <NivelEndogamia f={resultado.f} umbral={umbral} />
            </div>
            <Aviso tipo={nivel === "bajo" ? "exito" : nivel === "vigilar" ? "info" : "atencion"} className="mt-3.5">
              {recomendacionCruza(nivel)}
            </Aviso>
            {pedigriMin < 0.5 ? (
              <Aviso tipo="info" className="mt-3">
                Alguno de los dos tiene pocos ancestros registrados, así que la endogamia real puede ser mayor a la calculada.
              </Aviso>
            ) : null}
          </Tarjeta>

          <Tarjeta titulo="Por qué sale así">
            {resultado.origen.length === 0 ? (
              <p className="text-[0.9375rem] text-humo">
                No comparten ancestros conocidos, por eso la endogamia es {resultado.f === 0 ? "nula" : "baja"}.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-humo">
                  Estos animales aparecen en el pedigrí del macho y en el de la hembra. Así llega cada uno hasta la cría:
                </p>
                <RutasEndogamia filas={resultado.origen} rotuloPadre="Por el macho" rotuloMadre="Por la hembra" cruza />
              </>
            )}
          </Tarjeta>

          <Tarjeta titulo="Qué tan completo es el pedigrí">
            <dl className="divide-y divide-arena text-[0.9375rem]">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-humo">Macho</dt>
                <dd className="font-semibold">{pedigriTexto(resultado.pedigriMacho)} · {Math.round(resultado.pedigriMacho * 100)} %</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-humo">Hembra</dt>
                <dd className="font-semibold">{pedigriTexto(resultado.pedigriHembra)} · {Math.round(resultado.pedigriHembra * 100)} %</dd>
              </div>
            </dl>
            <p className="mt-2 text-sm text-humo">Se mide sobre las 4 primeras generaciones; la endogamia se calcula con todo el pedigrí que haya.</p>
          </Tarjeta>
    </>
  );
}
