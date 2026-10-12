"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { FileText, FlaskConical, Pencil } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import { estadoCrioscopia, estadoRcs, estadoResiduos, formatoCrioscopia, formatoMiles } from "@/lib/leche-calidad";
import { direccionSoporte } from "@/lib/soportes";
import type { AnalisisLeche } from "@/lib/tipos";

type FilaAnalisis = AnalisisLeche & { animal?: { numero_arete: string; nombre: string | null } };
type Origen = "todos" | "tanque" | "animales";

const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;

/** Resultados de calidad de la leche: del tanque o lote y de cada animal. Los de un animal se registran desde su ficha. */
export function ListaCalidad({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [origen, setOrigen] = useState<Origen>("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase.from("analisis_leche").select("*", { count: "exact" }).eq("finca_id", fincaId);
      if (origen === "tanque") q = q.is("animal_id", null);
      if (origen === "animales") q = q.not("animal_id", "is", null);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        const { data: animales } = await supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200);
        const condiciones = [`laboratorio.ilike.%${limpio}%`, `muestra.ilike.%${limpio}%`];
        const ids = (animales ?? []).map((a) => a.id);
        if (ids.length) condiciones.push(`animal_id.in.(${ids.join(",")})`);
        q = q.or(condiciones.join(","));
      }
      const { data, count, error } = await q.order("fecha", { ascending: false }).order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaAnalisis[];
      const ids = [...new Set(filas.map((f) => f.animal_id).filter((i): i is string => Boolean(i)))];
      if (ids.length) {
        const { data: animales } = await supabase.from("animales").select("id, numero_arete, nombre").in("id", ids);
        const porId = new Map((animales ?? []).map((a) => [a.id, a]));
        for (const f of filas) if (f.animal_id) f.animal = porId.get(f.animal_id);
      }
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda, origen],
  );

  const hayFiltro = busqueda !== "" || origen !== "todos";

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar animal, muestra o laboratorio" />
      <FilaDesplazable>
        <Chip activo={origen === "todos"} onClick={() => setOrigen("todos")}>Todos</Chip>
        <Chip activo={origen === "tanque"} onClick={() => setOrigen("tanque")}>Tanque o lote</Chip>
        <Chip activo={origen === "animales"} onClick={() => setOrigen("animales")}>Animales</Chip>
      </FilaDesplazable>
      <ListaEscalable<FilaAnalisis>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${origen}`}
        cargar={cargar}
        clave={(a) => a.id}
        fila={(a) => {
          const rcs = a.rcs_miles_ml != null ? estadoRcs(a.rcs_miles_ml) : null;
          const contenido = (
            <>
              <span className="block font-bold [overflow-wrap:anywhere]">
                {a.animal_id ? (a.animal ? etiquetaAnimal(a.animal) : "Animal") : (a.muestra ?? "Tanque o lote")}
              </span>
              <span className="block text-sm text-humo">
                {formatoFecha(a.fecha, { day: "numeric", month: "short", year: "numeric" })}
                {a.laboratorio ? ` · ${a.laboratorio}` : ""}
              </span>
              <span className="mt-1 block text-sm [overflow-wrap:anywhere]">
                {[
                  a.grasa_pct != null ? `Grasa ${pct(a.grasa_pct)}` : null,
                  a.proteina_pct != null ? `Proteína ${pct(a.proteina_pct)}` : null,
                  a.solidos_totales_pct != null ? `Sólidos ${pct(a.solidos_totales_pct)}` : null,
                  a.lactosa_pct != null ? `Lactosa ${pct(a.lactosa_pct)}` : null,
                  a.rcs_miles_ml != null ? `Células ${formatoMiles(a.rcs_miles_ml)}` : null,
                  a.crioscopia_c != null ? `Crioscopia ${formatoCrioscopia(a.crioscopia_c)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {rcs ? <Insignia tono={rcs.tono}>{`Células somáticas: ${rcs.texto.toLowerCase()}`}</Insignia> : null}
                {a.crioscopia_c != null ? <Insignia tono={estadoCrioscopia(a.crioscopia_c).tono}>{`Crioscopia: ${estadoCrioscopia(a.crioscopia_c).texto.toLowerCase()}`}</Insignia> : null}
                {a.residuos_antibioticos ? <Insignia tono={estadoResiduos(a.residuos_antibioticos).tono}>{`Antibióticos: ${estadoResiduos(a.residuos_antibioticos).texto.toLowerCase()}`}</Insignia> : null}
                {!a.soporte_path ? <Insignia tono="aviso">Sin documento</Insignia> : null}
              </span>
            </>
          );
          return (
            <div className="flex items-start gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena">
              {a.animal_id ? (
                <Link href={`/hato/${a.animal_id}#calidad`} className="block min-w-0 flex-1">{contenido}</Link>
              ) : (
                <div className="min-w-0 flex-1">{contenido}</div>
              )}
              <div className="flex shrink-0 flex-col items-end">
                {puedeEditar ? (
                  <Link href={`/leche/calidad/${a.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" /> Editar
                  </Link>
                ) : null}
                {a.soporte_path ? (
                  <a href={direccionSoporte(a.soporte_path)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-musgo underline-offset-4 hover:underline">
                    <FileText className="size-3.5" strokeWidth={2} aria-hidden="true" /> Documento
                  </a>
                ) : null}
              </div>
            </div>
          );
        }}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<FlaskConical strokeWidth={1.5} />} titulo="Ningún análisis coincide" descripcion="Prueba con otro nombre o quita el filtro." />
          ) : (
            <EstadoVacio icono={<FlaskConical strokeWidth={1.5} />} titulo="Aún no hay análisis" descripcion="Aquí quedan los resultados de grasa, proteína y células somáticas de tu leche, la del tanque y la de cada animal." />
          )
        }
      />
    </div>
  );
}
