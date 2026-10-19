"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Rabbit, SearchX } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { TarjetasHato } from "@/components/TarjetasHato";
import { FilaAnimal, type AnimalFila, type RetiroFila } from "@/components/FilaAnimal";
import { ListaEscalable } from "@/components/ListaEscalable";
import { clasesBoton } from "@/components/Boton";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { FiltroHato, VistaHato } from "@/lib/hato";
import type { Especie } from "@/lib/tipos";

type Filtro = FiltroHato;

export function ListaHato({
  fincaId,
  especies,
  retiros,
  puedeCrear,
  puedeTraer = false,
  filtroInicial = "todos",
  vistas = [],
  conteos,
}: {
  fincaId: string;
  especies: Especie[];
  retiros: Record<string, RetiroFila>;
  puedeCrear: boolean;
  /** Solo mientras el paso único «traer mis animales» siga pendiente. */
  puedeTraer?: boolean;
  /** El filtro con el que abre la lista (por ejemplo, al volver desde «Ordeño»). */
  filtroInicial?: FiltroHato;
  /** Las vistas de trabajo que se ofrecen junto a los filtros (Ordeño, Ceba, Empadronamiento, Sanidad, Corrales…), según lo que la persona puede ver. */
  vistas?: VistaHato[];
  /** Cuántos animales hay en cada filtro (el dato de cada tarjeta). */
  conteos?: Record<FiltroHato, number>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase
        .from("animales")
        .select("id, numero_arete, nombre, sexo, especie, fecha_nacimiento, fecha_nacimiento_aprox, estado, fecha_baja", { count: "exact" })
        .eq("finca_id", fincaId)
        .is("deleted_at", null);
      q = filtro === "bajas" ? q.neq("estado", "activo") : q.eq("estado", "activo");
      if (filtro === "hembras") q = q.eq("sexo", "hembra");
      if (filtro === "machos") q = q.eq("sexo", "macho");
      if (filtro === "caprino" || filtro === "ovino") q = q.eq("especie", filtro);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) q = q.or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`);
      const orden = filtro === "bajas" ? q.order("fecha_baja", { ascending: false }).order("numero_arete") : q.order("numero_arete");
      const { data, count, error } = await orden.range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      return { filas: (data ?? []) as AnimalFila[], total: count ?? 0 };
    },
    [fincaId, filtro, busqueda],
  );

  const hayFiltro = filtro !== "todos" || busqueda !== "";

  return (
    <div className="space-y-3">
      <div className="lg:max-w-md">
        <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" />
      </div>
      <TarjetasHato especies={especies} vistas={vistas} conteos={conteos} filtroActivo={filtro} onFiltro={setFiltro} />
      <ListaEscalable<AnimalFila>
        key={`${filtro}|${busqueda}`}
        cargar={cargar}
        rejilla="grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
        clave={(a) => a.id}
        fila={(a) => <FilaAnimal animal={a} retiro={retiros[a.id]} />}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="Nada con ese filtro" descripcion="Prueba con otro número de arete o quita el filtro." />
          ) : (
            <EstadoVacio
              icono={<Rabbit strokeWidth={1.5} />}
              titulo="Aquí va tu hato"
              descripcion="Cada animal que registres aparecerá en esta lista, con su edad, su estado y sus periodos de retiro."
            >
              {puedeCrear ? (
                <div className="space-y-2">
                  <Link href="/hato/nuevo" className={clasesBoton("primario")}>
                    Registrar el primer animal
                  </Link>
                  {puedeTraer ? (
                    <Link href="/onboarding/animales" className={clasesBoton("secundario")}>
                      Traer mis animales registrados
                    </Link>
                  ) : null}
                  <Link href="/hato/importar" className={clasesBoton("secundario")}>
                    Cargarlos desde Excel
                  </Link>
                </div>
              ) : null}
            </EstadoVacio>
          )
        }
      />
    </div>
  );
}
