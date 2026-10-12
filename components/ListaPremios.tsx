"use client";

import { useCallback, useState } from "react";
import { Trophy } from "lucide-react";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { EnlaceBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_FILTRO_PREMIOS } from "@/lib/escenas-listas-premios";
import { FilaParticipacion, type DatosParticipacion } from "@/components/FilaParticipacion";
import { ListaEscalable } from "@/components/ListaEscalable";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";

type Filtro = "todos" | "premios" | "campeonatos";
const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todas" },
  { valor: "premios", etiqueta: "Con premio" },
  { valor: "campeonatos", etiqueta: "Campeonatos" },
];

type FilaPremio = DatosParticipacion & {
  animal_id: string;
  foto_path: string | null;
  feria_id: string;
  animales?: { numero_arete: string; nombre: string | null };
  ferias?: { nombre: string; fecha_inicio: string };
  fotoUrl?: string;
};

/**
 * Compendio de todos los premios de la finca, el más reciente primero. Cada fila lleva a la ficha de su animal
 * (donde también se registran y se corrigen). Pagina en el servidor y busca por animal, feria, categoría o premio.
 */
export function ListaPremios({ fincaId, puedeEditar }: { fincaId: string; puedeEditar: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const cargar = useCallback(
    async (desde: number, cantidad: number) => {
      const supabase = crearClienteNavegador();
      let q = supabase
        .from("participaciones_feria")
        .select(
          "id, animal_id, categoria, resultado, puesto, puntaje, premio_descripcion, premio_en_dinero, foto_path, feria_id",
          { count: "exact" },
        )
        .eq("finca_id", fincaId);
      if (filtro === "premios") q = q.neq("resultado", "participacion");
      if (filtro === "campeonatos") q = q.in("resultado", ["gran_campeon", "campeon"]);

      const limpio = busqueda.replace(/[%,()*\\]/g, " ").trim();
      if (limpio) {
        // Se busca por animal y por feria aparte y se juntan con la categoría y el premio (los uuid son seguros de interpolar).
        const [animales, ferias] = await Promise.all([
          supabase.from("animales").select("id").eq("finca_id", fincaId).or(`numero_arete.ilike.%${limpio}%,nombre.ilike.%${limpio}%`).limit(200),
          supabase.from("ferias").select("id").eq("finca_id", fincaId).ilike("nombre", `%${limpio}%`).limit(200),
        ]);
        const condiciones = [`categoria.ilike.%${limpio}%`, `premio_descripcion.ilike.%${limpio}%`];
        const idsAnimales = (animales.data ?? []).map((a) => a.id);
        const idsFerias = (ferias.data ?? []).map((f) => f.id);
        if (idsAnimales.length) condiciones.push(`animal_id.in.(${idsAnimales.join(",")})`);
        if (idsFerias.length) condiciones.push(`feria_id.in.(${idsFerias.join(",")})`);
        q = q.or(condiciones.join(","));
      }

      const { data, count, error } = await q.order("created_at", { ascending: false }).range(desde, desde + cantidad - 1);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as FilaPremio[];

      // Los nombres del animal y de la feria se piden aparte, solo de este tramo.
      const [animales, ferias] = await Promise.all([
        supabase.from("animales").select("id, numero_arete, nombre").in("id", [...new Set(filas.map((f) => f.animal_id))]),
        supabase.from("ferias").select("id, nombre, fecha_inicio").in("id", [...new Set(filas.map((f) => f.feria_id))]),
      ]);
      const porAnimal = new Map((animales.data ?? []).map((a) => [a.id, a]));
      const porFeria = new Map((ferias.data ?? []).map((f) => [f.id, f]));
      for (const f of filas) {
        f.animales = porAnimal.get(f.animal_id);
        f.ferias = porFeria.get(f.feria_id);
      }

      const rutas = filas.map((f) => f.foto_path).filter((r): r is string => Boolean(r));
      if (rutas.length) {
        const { data: firmadas } = await supabase.storage.from("premios").createSignedUrls(rutas, 3600);
        const mapa = new Map((firmadas ?? []).map((u) => [u.path, u.signedUrl]));
        for (const f of filas) if (f.foto_path) f.fotoUrl = mapa.get(f.foto_path) ?? undefined;
      }
      return { filas, total: count ?? 0 };
    },
    [fincaId, busqueda, filtro],
  );

  const hayFiltro = busqueda !== "" || filtro !== "todos";

  return (
    <div className="space-y-3">
      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar animal, feria o premio" />
      <FilaTarjetas etiqueta="Tipo de participación">
        {FILTROS.map((f) => (
          <TarjetaOpcion key={f.valor} escena={ESCENA_FILTRO_PREMIOS[f.valor]} titulo={f.etiqueta} activo={filtro === f.valor} onClick={() => setFiltro(f.valor)} />
        ))}
      </FilaTarjetas>
      <ListaEscalable<FilaPremio>
        rejilla="grid-cols-1 lg:grid-cols-2"
        key={`${busqueda}|${filtro}`}
        cargar={cargar}
        clave={(p) => p.id}
        fila={(p) => (
          <FilaParticipacion
            p={p}
            titulo={p.animales ? etiquetaAnimal(p.animales) : "Animal"}
            detalle={p.ferias ? `${p.ferias.nombre} · ${formatoFecha(p.ferias.fecha_inicio, { day: "numeric", month: "short", year: "numeric" })}` : undefined}
            enlace={`/hato/${p.animal_id}#premios`}
            fotoUrl={p.fotoUrl}
            editar={puedeEditar ? `/ferias/participacion/${p.id}/editar` : undefined}
          />
        )}
        vacio={
          hayFiltro ? (
            <EstadoVacio icono={<Trophy strokeWidth={1.5} />} titulo="Ningún premio coincide" descripcion="Prueba con otro nombre o quita el filtro." />
          ) : (
            <EstadoVacio
              icono={<Trophy strokeWidth={1.5} />}
              titulo="Aquí va tu palmarés"
              descripcion="Cuando registres el premio de un animal, desde su ficha, aparece aquí con su foto."
            >
              <EnlaceBoton href="/hato">Ir al hato</EnlaceBoton>
            </EstadoVacio>
          )
        }
      />
    </div>
  );
}
