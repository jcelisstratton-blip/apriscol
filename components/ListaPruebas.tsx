"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Pencil, TestTube } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EnlaceBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, RESULTADOS_PRUEBA, TONO_RESULTADO_PRUEBA } from "@/lib/sanidad";
import type { PruebaSanitaria, ResultadoPrueba } from "@/lib/tipos";

type FilaPrueba = PruebaSanitaria & { animal?: { numero_arete: string; nombre: string | null } };

/** Todas las pruebas diagnósticas de la finca. Se registran y se corrigen desde la ficha de cada animal; aquí se consultan. */
export function ListaPruebas({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [resultado, setResultado] = useState<ResultadoPrueba | "todos">("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("pruebas_sanitarias").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (resultado !== "todos") q = q.eq("resultado", resultado);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const condiciones = [`laboratorio.ilike.%${limpio}%`];
        const ids = (animales ?? []).map((a) => a.id);
        if (ids.length) condiciones.push(`animal_id.in.(${ids.join(",")})`);
        q = q.or(condiciones.join(","));
      }
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaPrueba[];
      const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", [...new Set(filas.map((f) => f.animal_id))]);
      const porId = new Map((animales ?? []).map((a) => [a.id, a]));
      for (const f of filas) f.animal = porId.get(f.animal_id);
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda, resultado],
  );

  const hayFiltro = busqueda !== "" || resultado !== "todos";

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar animal o laboratorio" />
      <FilaDesplazable>
        <Chip activo={resultado === "todos"} onClick={() => setResultado("todos")}>Todas</Chip>
        {RESULTADOS_PRUEBA.map((r) => (
          <Chip key={r} activo={resultado === r} onClick={() => setResultado(r)}>
            {ETIQUETA_RESULTADO_PRUEBA[r]}
          </Chip>
        ))}
      </FilaDesplazable>
      <ListaEscalable<FilaPrueba>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${resultado}`}
        cargar={cargar}
        clave={(p) => p.id}
        fila={(p) => (
          <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
            <Link href={`/hato/${p.animal_id}#sanidad`} className="block min-w-0 flex-1">
              <span className="block font-bold [overflow-wrap:anywhere]">{ETIQUETA_PRUEBA_CORTA[p.prueba]}</span>
              <span className="block text-sm text-humo [overflow-wrap:anywhere]">{p.animal ? etiquetaAnimal(p.animal) : "Animal"}</span>
              <span className="block text-sm text-humo">
                {formatoFecha(p.fecha, { day: "numeric", month: "short", year: "numeric" })}
                {p.laboratorio ? ` · ${p.laboratorio}` : ""}
              </span>
              <span className="mt-1.5 block">
                <Insignia tono={TONO_RESULTADO_PRUEBA[p.resultado]}>{ETIQUETA_RESULTADO_PRUEBA[p.resultado]}</Insignia>
              </span>
            </Link>
            {puedeEditar ? (
              <Link href={`/sanidad/pruebas/${p.id}/editar`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
              </Link>
            ) : null}
          </div>
        )}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<TestTube strokeWidth={1.5} />} titulo="Ninguna prueba coincide" descripcion="Prueba con otro nombre o quita el filtro." />
          ) : (
            <EstadoVacio icono={<TestTube strokeWidth={1.5} />} titulo="Aún no hay pruebas" descripcion="Las pruebas (CAE, brucelosis, CMT…) se registran desde la ficha de cada animal y aquí queda el compendio.">
              <EnlaceBoton href="/hato">Ir al hato</EnlaceBoton>
            </EstadoVacio>
          )
        }
      />
    </div>
  );
}
