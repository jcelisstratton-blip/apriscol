"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Insignia } from "@/components/Insignia";
import { ListaEscalable } from "@/components/ListaEscalable";
import { clasesBoton } from "@/components/Boton";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { formatoFecha } from "@/lib/fechas";
import { ETIQUETA_NIVEL } from "@/lib/ferias";
import type { NivelFeria } from "@/lib/tipos";

type FilaFeria = {
  id: string;
  nombre: string;
  nivel: NivelFeria;
  departamento: string | null;
  municipio: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
};

export function ListaFerias({ fincaId, puedeCrear }: { fincaId: string; puedeCrear: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      let q = crearClienteNavegador()
        .from("ferias")
        .select("id, nombre, nivel, departamento, municipio, fecha_inicio, fecha_fin", { count: "exact" })
        .eq("finca_id", fincaId);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) q = q.or(`nombre.ilike.%${limpio}%,municipio.ilike.%${limpio}%,departamento.ilike.%${limpio}%`);
      const { data, count, error } = await q.order("fecha_inicio", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as FilaFeria[], total: count ?? 0 };
    },
    [fincaId, busqueda],
  );

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar feria, ciudad o departamento" />
      <ListaEscalable<FilaFeria>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={busqueda}
        cargar={cargar}
        clave={(f) => f.id}
        fila={(f) => (
          <Link
            href={`/ferias/${f.id}`}
            className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-3 ring-1 ring-arena transition active:scale-[0.99]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ocre/15 text-ocre">
              <Trophy className="size-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold [overflow-wrap:anywhere]">{f.nombre}</span>
              <span className="block text-sm text-humo">
                {formatoFecha(f.fecha_inicio, { day: "numeric", month: "short", year: "numeric" })}
                {[f.municipio, f.departamento].filter(Boolean).length ? ` · ${[f.municipio, f.departamento].filter(Boolean).join(", ")}` : ""}
              </span>
              <span className="mt-1 block">
                <Insignia tono={f.nivel === "internacional" || f.nivel === "nacional" ? "musgo" : "neutro"}>{ETIQUETA_NIVEL[f.nivel]}</Insignia>
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} />
          </Link>
        )}
        vacio={
          busqueda ? (
            <EstadoVacio icono={<Trophy strokeWidth={1.5} />} titulo="Ninguna feria coincide" descripcion="Prueba con otro nombre o ciudad." />
          ) : (
            <EstadoVacio
              icono={<Trophy strokeWidth={1.5} />}
              titulo="Aquí va tu palmarés"
              descripcion="Registra las ferias a las que llevas tus animales y, en cada una, el premio que recibieron con su foto."
            >
              {puedeCrear ? (
                <Link href="/ferias/nueva" className={clasesBoton("primario")}>
                  Registrar la primera feria
                </Link>
              ) : null}
            </EstadoVacio>
          )
        }
      />
    </div>
  );
}
