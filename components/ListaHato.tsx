"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Rabbit, SearchX } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { FilaAnimal, type AnimalFila, type RetiroFila } from "@/components/FilaAnimal";
import { ListaEscalable } from "@/components/ListaEscalable";
import { clasesBoton } from "@/components/Boton";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { Especie } from "@/lib/tipos";

type Filtro = "todos" | "hembras" | "machos" | "caprino" | "ovino";

export function ListaHato({
  fincaId,
  especies,
  retiros,
  puedeCrear,
  puedeTraer = false,
}: {
  fincaId: string;
  especies: Especie[];
  retiros: Record<string, RetiroFila>;
  puedeCrear: boolean;
  /** Solo mientras el paso único «traer mis animales» siga pendiente. */
  puedeTraer?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase
        .from("animales")
        .select("id, numero_arete, nombre, sexo, especie, fecha_nacimiento, fecha_nacimiento_aprox", { count: "exact" })
        .eq("finca_id", fincaId)
        .is("deleted_at", null)
        .eq("estado", "activo");
      if (filtro === "hembras") q = q.eq("sexo", "hembra");
      if (filtro === "machos") q = q.eq("sexo", "macho");
      if (filtro === "caprino" || filtro === "ovino") q = q.eq("especie", filtro);
      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) q = q.or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`);
      const { data, count, error } = await q.order("numero_arete").range(desde, desde + cantidad - 1);
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
      <FilaDesplazable>
        <Chip activo={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos</Chip>
        <Chip activo={filtro === "hembras"} onClick={() => setFiltro("hembras")}>Hembras</Chip>
        <Chip activo={filtro === "machos"} onClick={() => setFiltro("machos")}>Machos</Chip>
        {especies.length > 1 ? (
          <>
            <Chip activo={filtro === "caprino"} onClick={() => setFiltro("caprino")}>Cabras</Chip>
            <Chip activo={filtro === "ovino"} onClick={() => setFiltro("ovino")}>Ovejas</Chip>
          </>
        ) : null}
      </FilaDesplazable>
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
                </div>
              ) : null}
            </EstadoVacio>
          )
        }
      />
    </div>
  );
}
