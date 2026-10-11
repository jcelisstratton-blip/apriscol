"use client";

import { useCallback, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { CLASE_INPUT } from "@/components/Campo";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import type { Especie, SexoAnimal } from "@/lib/tipos";

type Resultado = { id: string; numero_arete: string; nombre: string | null };

/** Elegir un animal del hato (por ejemplo, el padre o la madre) con búsqueda en la hoja inferior. */
export function SelectorAnimal({
  id,
  nombre,
  fincaId,
  sexo,
  especie,
  titulo,
  valor,
  onCambio,
}: {
  id?: string;
  nombre: string;
  fincaId: string;
  sexo?: SexoAnimal;
  especie?: Especie;
  titulo: string;
  valor: Resultado | null;
  onCambio: (a: Resultado | null) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buscar = useCallback(
    async (texto: string) => {
      setError(null);
      setResultados(null);
      const limpio = texto.replace(/[%,()*\\]/g, " ").trim();
      let q = crearClienteNavegador()
        .from("animales")
        .select("id, numero_arete, nombre")
        .eq("finca_id", fincaId)
        .is("deleted_at", null);
      if (sexo) q = q.eq("sexo", sexo);
      if (especie) q = q.eq("especie", especie);
      // Los animales que ya salieron del hato también pueden tener premios históricos.
      if (sexo || especie) q = q.eq("estado", "activo");
      if (limpio) q = q.or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`);
      const { data, error: e } = await q.order("numero_arete").limit(20);
      if (e) setError(e.message);
      else setResultados(data ?? []);
    },
    [fincaId, sexo, especie],
  );

  return (
    <>
      <input type="hidden" name={nombre} value={valor?.id ?? ""} />
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setAbierta(true)}
          aria-haspopup="dialog"
          className={`${CLASE_INPUT} flex items-center justify-between gap-3 pr-12 text-left`}
        >
          <span className={`min-w-0 flex-1 ${valor ? "" : "text-humo/70"}`}>{valor ? etiquetaAnimal(valor) : "Sin registrar"}</span>
          {!valor ? <ChevronDown className="size-5 shrink-0 text-humo" strokeWidth={1.75} /> : null}
        </button>
        {valor ? (
          <button
            type="button"
            onClick={() => onCambio(null)}
            aria-label="Quitar"
            className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-humo hover:bg-arena"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
      <Sheet abierta={abierta} onCerrar={() => setAbierta(false)} titulo={titulo}>
        <div className="space-y-3">
          <CampoBusqueda onBuscar={buscar} placeholder="Buscar por arete o nombre" retardo={250} />
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
          {resultados === null && !error ? <Cargando texto="Buscando…" /> : null}
          {resultados?.length === 0 ? <p className="py-6 text-center text-sm text-humo">No hay animales que coincidan.</p> : null}
          <ul className="-mx-2 space-y-0.5">
            {resultados?.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onCambio(r);
                    setAbierta(false);
                  }}
                  className="flex min-h-12 w-full items-center rounded-xl px-3 text-left font-medium hover:bg-arena/60"
                >
                  {etiquetaAnimal(r)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
