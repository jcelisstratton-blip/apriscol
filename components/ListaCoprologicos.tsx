"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Microscope, Pencil } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EnlaceBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { ESCENA_NIVEL_COPROLOGICO, ESCENA_TODOS_COPROLOGICOS } from "@/lib/escenas-listas-sanidad";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { ETIQUETA_MOMENTO, ETIQUETA_TECNICA, HPG_ALTO, HPG_BAJO, HPG_MUY_ALTO, interpretarHpg, textoResultado, type NivelHpg } from "@/lib/coprologico";
import { formatoFecha } from "@/lib/fechas";
import type { ExamenCoprologico } from "@/lib/tipos";

type FilaExamen = ExamenCoprologico & { animal?: { numero_arete: string; nombre: string | null } };

const NIVELES: { nivel: NivelHpg; titulo: string; detalle: string; desde: number; hasta: number | null }[] = [
  { nivel: "bajo", titulo: "Carga baja", detalle: `Menos de ${HPG_BAJO} HPG`, desde: 0, hasta: HPG_BAJO },
  { nivel: "moderado", titulo: "Moderada", detalle: `${HPG_BAJO} a ${HPG_ALTO - 1} HPG`, desde: HPG_BAJO, hasta: HPG_ALTO },
  { nivel: "alto", titulo: "Alta", detalle: `${HPG_ALTO.toLocaleString("es-CO")} a ${(HPG_MUY_ALTO - 1).toLocaleString("es-CO")} HPG`, desde: HPG_ALTO, hasta: HPG_MUY_ALTO },
  { nivel: "muy_alto", titulo: "Muy alta", detalle: `${HPG_MUY_ALTO.toLocaleString("es-CO")} HPG o más`, desde: HPG_MUY_ALTO, hasta: null },
];

/** Todos los exámenes coprológicos de la finca, con su nivel de carga. Cada uno abre su detalle (de dónde salió el resultado). */
export function ListaCoprologicos({ fincaId, puedeEditar, rango = { desde: null, hasta: null } }: { fincaId: string; puedeEditar: boolean; rango?: { desde: string | null; hasta: string | null } }) {
  const [busqueda, setBusqueda] = useState("");
  const [nivel, setNivel] = useState<NivelHpg | "todos">("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("examenes_coprologicos").select("*", { count: "exact" }).eq("finca_id", fincaId);
      const corte = NIVELES.find((n) => n.nivel === nivel);
      if (corte) {
        q = q.gte("hpg", corte.desde);
        if (corte.hasta !== null) q = q.lt("hpg", corte.hasta);
      }
      if (rango.desde) q = q.gte("fecha", rango.desde);
      if (rango.hasta) q = q.lte("fecha", rango.hasta);
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
      const filas = (data ?? []) as FilaExamen[];
      const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", [...new Set(filas.map((f) => f.animal_id))]);
      const porId = new Map((animales ?? []).map((a) => [a.id, a]));
      for (const f of filas) f.animal = porId.get(f.animal_id);
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda, nivel, rango.desde, rango.hasta],
  );

  const hayFiltro = busqueda !== "" || nivel !== "todos" || Boolean(rango.desde || rango.hasta);

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar animal o laboratorio" />
      <FilaTarjetas etiqueta="Carga de parásitos">
        <TarjetaOpcion escena={ESCENA_TODOS_COPROLOGICOS} titulo="Todos" activo={nivel === "todos"} onClick={() => setNivel("todos")} />
        {NIVELES.map((n) => (
          <TarjetaOpcion key={n.nivel} escena={ESCENA_NIVEL_COPROLOGICO[n.nivel]} titulo={n.titulo} detalle={n.detalle} activo={nivel === n.nivel} onClick={() => setNivel(n.nivel)} />
        ))}
      </FilaTarjetas>
      <ListaEscalable<FilaExamen>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${nivel}|${rango.desde}|${rango.hasta}`}
        cargar={cargar}
        clave={(x) => x.id}
        fila={(x) => {
          const lectura = x.hpg !== null && x.momento === "diagnostico" ? interpretarHpg(x.hpg) : null;
          return (
            <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
              <Link href={`/sanidad/coprologico/${x.id}`} className="block min-w-0 flex-1">
                <span className="block font-bold [overflow-wrap:anywhere]">{textoResultado(x)}</span>
                <span className="block text-sm text-humo [overflow-wrap:anywhere]">{x.animal ? etiquetaAnimal(x.animal) : "Animal"}</span>
                <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                  {formatoFecha(x.fecha, { day: "numeric", month: "short", year: "numeric" })} · {ETIQUETA_TECNICA[x.tecnica]}
                  {x.laboratorio ? ` · ${x.laboratorio}` : ""}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {lectura ? <Insignia tono={lectura.tono}>{lectura.texto}</Insignia> : null}
                  {x.momento !== "diagnostico" ? <Insignia>{ETIQUETA_MOMENTO[x.momento]}</Insignia> : null}
                </span>
              </Link>
              {puedeEditar ? (
                <Link href={`/hato/sanidad/coprologico/${x.id}/editar`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                  <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
                </Link>
              ) : null}
            </div>
          );
        }}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<Microscope strokeWidth={1.5} />} titulo="Ningún examen coincide" descripcion="Prueba con otro nombre o quita el filtro." />
          ) : (
            <EstadoVacio icono={<Microscope strokeWidth={1.5} />} titulo="Aún no hay exámenes coprológicos" descripcion="El conteo de huevos de parásitos en las heces dice qué animales necesitan desparasitarse. Regístralo aquí o desde la ficha de cada animal.">
              {puedeEditar ? <EnlaceBoton href="/hato/sanidad/coprologico/nuevo">Registrar un examen</EnlaceBoton> : null}
            </EstadoVacio>
          )
        }
      />
    </div>
  );
}
