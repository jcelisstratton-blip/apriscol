import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Historial } from "./Historial";

export const metadata: Metadata = { title: "Leche" };

/**
 * Leche, a nivel de toda la finca: lo que ha producido el hato (o un animal) en cualquier periodo, con sus gráficas. El registro del
 * ordeño y el programa de turnos viven en Hato → «Ordeño».
 */
export default async function PaginaLeche({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; agregar?: string; periodo?: string; desde?: string; hasta?: string; animal?: string }>;
}) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "leche")) redirect("/");
  const sp = await searchParams;
  // Enlaces viejos al registro del ordeño: ahora está en Hato.
  if (sp.vista === "registrar") redirect(sp.agregar && /^[0-9a-f-]{36}$/i.test(sp.agregar) ? `/hato?vista=ordeno&agregar=${sp.agregar}` : "/hato?vista=ordeno");
  if (sp.agregar && /^[0-9a-f-]{36}$/i.test(sp.agregar)) redirect(`/hato?vista=ordeno&agregar=${sp.agregar}`);

  return (
    <>
      <Encabezado titulo="Leche" subtitulo={finca.nombre} />
      <Historial fincaId={finca.id} puedeEditar={puedeEscribir(rol, "leche")} pedido={{ periodo: sp.periodo, desde: sp.desde, hasta: sp.hasta, animal: sp.animal }} />
    </>
  );
}
