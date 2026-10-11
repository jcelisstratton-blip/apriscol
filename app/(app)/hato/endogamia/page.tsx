import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, GitFork } from "lucide-react";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { ListaEndogamia } from "@/components/ListaEndogamia";
import { Tarjeta } from "@/components/Tarjeta";
import { UmbralEndogamia } from "@/components/UmbralEndogamia";
import { obtenerContexto } from "@/lib/contexto";
import { porcentaje } from "@/lib/endogamia";
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
  const conEndogamia = evaluados.filter((a) => a.f > 0);
  const sobreUmbral = conEndogamia.filter((a) => a.f >= finca.umbral_endogamia);
  const totalActivos = activos.count ?? 0;
  const mayor = conEndogamia[0]?.f;

  return (
    <>
      <Link href="/hato" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Hato
      </Link>
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
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Medidos", String(evaluados.length)],
                ["Sobre el umbral", String(sobreUmbral.length)],
                ["La más alta", mayor ? porcentaje(mayor) : "0 %"],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena">
                  <dd className="font-display text-xl font-semibold tabular-nums sm:text-2xl">{valor}</dd>
                  <dt className="mt-0.5 text-xs font-medium text-humo">{etiqueta}</dt>
                </div>
              ))}
            </dl>
            <p className="px-1 text-sm text-humo">
              {evaluados.length} de tus {totalActivos} animales activos tienen padre y madre registrados. En el resto no se puede medir.
            </p>
            <ListaEndogamia
              filas={conEndogamia.map((a) => ({
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
