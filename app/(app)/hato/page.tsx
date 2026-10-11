import type { Metadata } from "next";
import Link from "next/link";
import { GitFork, Plus, Shuffle } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { ListaHato } from "@/components/ListaHato";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir } from "@/lib/permisos";

export const metadata: Metadata = { title: "Hato" };

export default async function PaginaHato() {
  const { finca, rol } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("animales_en_retiro", { p_finca: finca.id });
  const retiros = Object.fromEntries(
    (data ?? []).map((r) => [r.animal_id, { leche: r.retiro_leche_hasta, carne: r.retiro_carne_hasta }]),
  );
  const puedeCrear = puedeEscribir(rol, "hato");

  return (
    <>
      <Encabezado
        titulo="Hato"
        subtitulo={finca.nombre}
        acciones={
          puedeCrear ? (
            <Link
              href="/hato/nuevo"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-musgo px-4 text-sm font-semibold text-sobre-musgo"
            >
              <Plus className="size-4" strokeWidth={2.4} /> Nuevo
            </Link>
          ) : null
        }
      />
      <div className="-mt-1 mb-3 flex flex-wrap gap-2">
        {[
          { href: "/hato/endogamia", texto: "Endogamia", Icono: GitFork },
          { href: "/hato/cruza", texto: "Simular cruza", Icono: Shuffle },
        ].map(({ href, texto, Icono }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-papel px-4 text-sm font-semibold text-musgo ring-1 ring-arena"
          >
            <Icono className="size-4" strokeWidth={2} aria-hidden="true" /> {texto}
          </Link>
        ))}
      </div>
      <ListaHato fincaId={finca.id} especies={finca.especies} retiros={retiros} puedeCrear={puedeCrear} />
    </>
  );
}
