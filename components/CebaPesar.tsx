"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Scale } from "lucide-react";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { CLASE_INPUT } from "@/components/Campo";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_SIN_LOTE, ESCENA_TODOS_LOS_LOTES, escenaLote } from "@/lib/escenas-listas-carne";
import { textoAnimales } from "@/lib/hato";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { useToast } from "@/components/Toast";
import { guardarPeso } from "@/app/(app)/carne/actions";
import { formatoFecha } from "@/lib/fechas";
import { gdp, kg } from "@/lib/carne";
import { leerNumero } from "@/lib/numeros";

export type AnimalCeba = {
  id: string;
  etiqueta: string;
  loteId: string | null;
  ultimoPeso: number | null;
  ultimaFecha: string | null;
  gdpReciente: number | null;
};

const SIN_LOTE = "sin";
const MIN_PARA_BUSCAR = 8;
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Hato → Ceba: los animales en engorde con su último peso. Se escribe el peso de cada uno y se guarda al instante (un peso por animal y día;
 * volver a guardarlo el mismo día lo corrige). Arriba, el día del pesaje y el filtro por lote.
 */
export function CebaPesar({ animales, lotes, hoy, puedeEditar }: { animales: AnimalCeba[]; lotes: { id: string; nombre: string }[]; hoy: string; puedeEditar: boolean }) {
  const toast = useToast();
  const [fecha, setFecha] = useState(hoy);
  const [lote, setLote] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [texto, setTexto] = useState<Record<string, string>>({});
  const [guardados, setGuardados] = useState<Record<string, number>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const guardar = (a: AnimalCeba) => {
    const peso = leerNumero(texto[a.id] ?? "");
    if (peso === null) return toast.error("Escribe el peso en kilos.");
    setOcupado(a.id);
    iniciar(async () => {
      const r = await guardarPeso({ animalId: a.id, fecha, peso });
      setOcupado(null);
      if (!r.ok) return toast.error(r.error);
      setGuardados((g) => ({ ...g, [a.id]: r.peso }));
      setTexto((t) => ({ ...t, [a.id]: "" }));
    });
  };

  if (animales.length === 0) {
    return (
      <EstadoVacio
        icono={<Scale strokeWidth={1.5} />}
        titulo="Aún no hay animales en ceba"
        descripcion="Aquí pesas los animales que engordas. Crea un lote en el menú Carne y ponle animales, o registra el peso de un animal desde su ficha."
      >
        {puedeEditar ? (
          <Link href="/carne/lotes/nuevo" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-musgo px-5 font-semibold text-sobre-musgo">
            Crear un lote
          </Link>
        ) : null}
      </EstadoVacio>
    );
  }

  const t = sinTildes(busqueda);
  const visibles = animales.filter((a) => (lote === "todos" ? true : lote === SIN_LOTE ? a.loteId === null : a.loteId === lote)).filter((a) => !t || sinTildes(a.etiqueta).includes(t));
  const hayLoteSuelto = animales.some((a) => a.loteId === null);

  return (
    <div className="space-y-3 lg:max-w-3xl">
      <p className="px-1 text-[0.9375rem] text-humo">
        {puedeEditar ? "Escribe el peso de cada animal y toca «Guardar». " : "Los animales en engorde con su último peso. "}
        Con dos pesos separados al menos 7 días se calcula cuánto gana por día.
      </p>
      {puedeEditar ? (
      <div className="space-y-1.5 rounded-3xl bg-papel p-4 ring-1 ring-arena">
        <label htmlFor="dia-pesaje" className="block text-sm font-semibold">
          Día del pesaje
        </label>
        <input
          id="dia-pesaje"
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => {
            setFecha(e.target.value || hoy);
            setGuardados({});
          }}
          className={CLASE_INPUT}
        />
        {fecha !== hoy ? <p className="text-sm text-humo">Estás registrando pesos del {formatoFecha(fecha)}.</p> : null}
      </div>
      ) : null}

      {animales.length > MIN_PARA_BUSCAR ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
      {lotes.length > 0 || hayLoteSuelto ? (
        <FilaTarjetas etiqueta="Lote">
          <TarjetaOpcion escena={ESCENA_TODOS_LOS_LOTES} titulo="Todos" dato={textoAnimales(animales.length)} activo={lote === "todos"} onClick={() => setLote("todos")} />
          {lotes.map((l, i) => (
            <TarjetaOpcion key={l.id} escena={escenaLote(i)} titulo={l.nombre} dato={textoAnimales(animales.filter((a) => a.loteId === l.id).length)} activo={lote === l.id} onClick={() => setLote(l.id)} />
          ))}
          {hayLoteSuelto ? <TarjetaOpcion escena={ESCENA_SIN_LOTE} titulo="Sin lote" dato={textoAnimales(animales.filter((a) => a.loteId === null).length)} activo={lote === SIN_LOTE} onClick={() => setLote(SIN_LOTE)} /> : null}
        </FilaTarjetas>
      ) : null}

      {visibles.length === 0 ? (
        <p className="py-6 text-center text-[0.9375rem] text-humo">Ningún animal coincide.</p>
      ) : (
        <ListaPorTramos
          key={`${t}|${lote}`}
          items={visibles}
          clave={(a) => a.id}
          fila={(a) => {
            const nuevo = leerNumero(texto[a.id] ?? "");
            const menos = nuevo !== null && a.ultimoPeso !== null && nuevo < a.ultimoPeso;
            return (
              <div className="space-y-2 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/hato/${a.id}#crecimiento`} className="block min-w-0 font-bold [overflow-wrap:anywhere] hover:underline">
                    {a.etiqueta}
                  </Link>
                  {guardados[a.id] !== undefined ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ok">
                      <Check className="size-4" strokeWidth={2.4} aria-hidden="true" /> {kg(guardados[a.id])}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-humo [overflow-wrap:anywhere]">
                  {a.ultimoPeso !== null ? `Último: ${kg(a.ultimoPeso)} el ${formatoFecha(a.ultimaFecha, { day: "numeric", month: "short" })}` : "Sin pesos todavía"}
                  {a.gdpReciente !== null ? ` · ${gdp(a.gdpReciente)}` : ""}
                </p>
                {puedeEditar ? (
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`Peso de ${a.etiqueta} en kilos`}
                      value={texto[a.id] ?? ""}
                      onChange={(e) => setTexto((x) => ({ ...x, [a.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && guardar(a)}
                      inputMode="decimal"
                      autoComplete="off"
                      enterKeyHint="done"
                      placeholder="Peso (kg)"
                      className={`${CLASE_INPUT} min-w-0 flex-1`}
                    />
                    <Boton ancho={false} onClick={() => guardar(a)} pendiente={ocupado === a.id} cargando="Guardando…" disabled={(texto[a.id] ?? "").trim() === ""}>
                      Guardar
                    </Boton>
                  </div>
                ) : null}
                {menos ? <p className="text-sm text-ambar">Es menos que la última vez ({kg(a.ultimoPeso)}). Revísalo antes de guardar.</p> : null}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
