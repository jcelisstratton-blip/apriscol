"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Rabbit, SearchX } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ChipEnlace } from "@/components/ChipEnlace";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { FilaAnimal, type AnimalFila, type RetiroFila } from "@/components/FilaAnimal";
import { ListaEscalable } from "@/components/ListaEscalable";
import { clasesBoton } from "@/components/Boton";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { DIRECCION_ORDENO, DIRECCION_CEBA, DIRECCION_EMPADRONAMIENTO, filtrosHato, type FiltroHato } from "@/lib/hato";
import type { Especie } from "@/lib/tipos";

type Filtro = FiltroHato;

export function ListaHato({
  fincaId,
  especies,
  retiros,
  puedeCrear,
  puedeTraer = false,
  filtroInicial = "todos",
  conOrdeno = false,
  conCeba = false,
  conMonta = false,
}: {
  fincaId: string;
  especies: Especie[];
  retiros: Record<string, RetiroFila>;
  puedeCrear: boolean;
  /** Solo mientras el paso único «traer mis animales» siga pendiente. */
  puedeTraer?: boolean;
  /** El filtro con el que abre la lista (por ejemplo, al volver desde «Ordeño»). */
  filtroInicial?: FiltroHato;
  /** Si se ofrece el filtro «Ordeño» (quien puede ver leche): lleva al registro del ordeño y su programa. */
  conOrdeno?: boolean;
  /** Si se ofrece el filtro «Ceba» (quien puede ver carne): lleva a pesar los animales en engorde. */
  conCeba?: boolean;
  /** Si se ofrece el filtro «Empadronamiento» (quien puede ver reproducción): arma y cierra las temporadas de monta. */
  conMonta?: boolean;
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
      <FilaDesplazable>
        {filtrosHato(especies).map((f) => (
          <Chip key={f.id} activo={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.texto}
          </Chip>
        ))}
        {conOrdeno ? (
          <ChipEnlace href={DIRECCION_ORDENO} activo={false}>
            Ordeño
          </ChipEnlace>
        ) : null}
        {conCeba ? (
          <ChipEnlace href={DIRECCION_CEBA} activo={false}>
            Ceba
          </ChipEnlace>
        ) : null}
        {conMonta ? (
          <ChipEnlace href={DIRECCION_EMPADRONAMIENTO} activo={false}>
            Empadronamiento
          </ChipEnlace>
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
