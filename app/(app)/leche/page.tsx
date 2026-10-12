import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Historial } from "./Historial";
import { Registrar } from "./Registrar";

export const metadata: Metadata = { title: "Leche" };

/**
 * Leche, a nivel de toda la finca: lo que ha producido el hato (o un animal) en cualquier periodo, con su gráfica, y el registro del ordeño.
 * Qué hembras se ordeñan y en qué turnos se programa dentro de Hato.
 */
export default async function PaginaLeche({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; agregar?: string; periodo?: string; desde?: string; hasta?: string; animal?: string }>;
}) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "leche")) redirect("/");
  const sp = await searchParams;
  const puedeEditar = puedeEscribir(rol, "leche");
  const vista = sp.vista === "registrar" && puedeEditar ? "registrar" : "resumen";

  return (
    <>
      <Encabezado titulo="Leche" subtitulo={finca.nombre} />
      {puedeEditar ? (
        <FilaDesplazable className="mb-3">
          {[
            { v: "resumen", t: "Producción", href: "/leche" },
            { v: "registrar", t: "Registrar ordeño", href: "/leche?vista=registrar" },
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
      {vista === "registrar" ? (
        <Registrar fincaId={finca.id} puedeEditar={puedeEditar} agregar={sp.agregar} />
      ) : (
        <Historial fincaId={finca.id} puedeEditar={puedeEditar} pedido={{ periodo: sp.periodo, desde: sp.desde, hasta: sp.hasta, animal: sp.animal }} />
      )}
    </>
  );
}
