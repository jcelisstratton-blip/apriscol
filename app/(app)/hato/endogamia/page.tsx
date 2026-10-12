import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GitFork } from "lucide-react";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaEndogamia } from "@/components/ListaEndogamia";
import { LeyendaEndogamia, ResumenEndogamia } from "@/components/ResumenEndogamia";
import { repartirPorNivel } from "@/lib/endogamia";
import { Tarjeta } from "@/components/Tarjeta";
import { UmbralEndogamia } from "@/components/UmbralEndogamia";
import { obtenerContexto } from "@/lib/contexto";
import { puedeGestionar, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Endogamia" };

export default async function PaginaEndogamia() {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "hato")) redirect("/hato");
  const supabase = await crearClienteServidor();

  const [calculo, activos] = await Promise.all([
    supabase.rpc("animales_endogamia", { p_finca: finca.id }),
    supabase.from("animales").select("id", { count: "exact", head: true }).eq("finca_id", finca.id).eq("estado", "activo").is("deleted_at", null),
  ]);

  const evaluados = (calculo.data ?? []).filter((a) => a.estado === "activo");
  const ordenados = evaluados.slice().sort((a, b) => b.f - a.f);
  const totalActivos = activos.count ?? 0;
  const mayor = ordenados[0]?.f;
  const reparto = repartirPorNivel(ordenados.map((a) => a.f), finca.umbral_endogamia);

  return (
    <>
      <Encabezado titulo="Endogamia" subtitulo={finca.nombre} />

      <div className="space-y-3.5 lg:max-w-3xl">
        <Tarjeta>
          <UmbralEndogamia fincaId={finca.id} umbral={finca.umbral_endogamia} puedeEditar={puedeGestionar(rol)} />
        </Tarjeta>

        {evaluados.length === 0 ? (
          <Tarjeta>
            <EstadoVacio
              icono={<GitFork strokeWidth={1.5} />}
              titulo="Todavía no hay pedigrí que medir"
              descripcion="La endogamia se calcula en los animales que tienen registrados a su padre y a su madre. Cuando los tengas, aparecerán aquí."
            />
          </Tarjeta>
        ) : (
          <>
            <ResumenEndogamia medidos={evaluados.length} reparto={reparto} mayor={mayor} activos={totalActivos} />
            <LeyendaEndogamia umbral={finca.umbral_endogamia} />
            <ListaEndogamia
              filas={ordenados.map((a) => ({
                animal_id: a.animal_id,
                numero_arete: a.numero_arete,
                nombre: a.nombre,
                sexo: a.sexo,
                especie: a.especie,
                f: a.f,
              }))}
              umbral={finca.umbral_endogamia}
            />
          </>
        )}

        <Link href="/hato/cruza" className={clasesBoton("secundario")}>
          Simular una cruza
        </Link>
      </div>
    </>
  );
}
