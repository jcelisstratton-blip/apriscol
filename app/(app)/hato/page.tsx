import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar, puedeVer } from "@/lib/permisos";
import { Animales, ProgramaLeche } from "./ProgramaLeche";

export const metadata: Metadata = { title: "Hato" };

/**
 * Hato: los animales y, en la pestaña «Leche», el programa del ordeño (qué hembras se ordeñan y en qué turnos). Lo que se mira o se hace
 * sobre la producción de todo el hato está en el menú «Leche».
 */
export default async function PaginaHato({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista: vistaPedida } = await searchParams;
  const { finca, rol, perfil } = await obtenerContexto();
  const puedeCrear = puedeEscribir(rol, "hato");
  const verLeche = puedeVer(rol, "leche");
  const vista = vistaPedida === "leche" && verLeche ? "leche" : "animales";

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
      {verLeche ? (
        <FilaDesplazable className="mb-3">
          {[
            { v: "animales", t: "Animales", href: "/hato" },
            { v: "leche", t: "Leche", href: "/hato?vista=leche" },
          ].map((p) => (
            <Link
              key={p.v}
              href={p.href}
              aria-current={vista === p.v ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
                vista === p.v ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
              }`}
            >
              {p.t}
            </Link>
          ))}
        </FilaDesplazable>
      ) : null}

      {vista === "leche" ? (
        <ProgramaLeche fincaId={finca.id} puedeEditar={puedeCrear} />
      ) : (
        <Animales fincaId={finca.id} especies={finca.especies} puedeCrear={puedeCrear} puedeTraer={puedeGestionar(rol) && !perfil?.libro_resuelto_en} />
      )}
    </>
  );
}
