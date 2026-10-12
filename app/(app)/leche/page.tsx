import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Calidad } from "./Calidad";
import { Despachos } from "./Despachos";
import { FrioEquipo } from "./FrioEquipo";
import { Historial } from "./Historial";

export const metadata: Metadata = { title: "Leche" };

const PESTANAS = [
  { valor: "produccion", etiqueta: "Producción" },
  { valor: "calidad", etiqueta: "Calidad" },
  { valor: "despachos", etiqueta: "Despachos" },
  { valor: "frio", etiqueta: "Frío y equipo" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/**
 * Leche, a nivel de toda la finca: lo que ha producido el hato en cualquier periodo (con sus gráficas), la calidad de la leche, lo que
 * se despacha y la cadena de frío con el equipo de ordeño. El registro del ordeño y el programa de turnos viven en Hato → «Ordeño»; los
 * análisis de un solo animal, en su ficha.
 */
export default async function PaginaLeche({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; agregar?: string; periodo?: string; desde?: string; hasta?: string; animal?: string; guardado?: string }>;
}) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "leche")) redirect("/");
  const sp = await searchParams;
  // Enlaces viejos al registro del ordeño: ahora está en Hato.
  if (sp.vista === "registrar") redirect(sp.agregar && /^[0-9a-f-]{36}$/i.test(sp.agregar) ? `/hato?vista=ordeno&agregar=${sp.agregar}` : "/hato?vista=ordeno");
  if (sp.agregar && /^[0-9a-f-]{36}$/i.test(sp.agregar)) redirect(`/hato?vista=ordeno&agregar=${sp.agregar}`);

  const vista: Vista = PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "produccion";
  const puedeEditar = puedeEscribir(rol, "leche");
  const accion =
    puedeEditar && vista === "calidad" ? (
      <EnlaceBoton href="/leche/calidad/nuevo" ancho={false}>Registrar</EnlaceBoton>
    ) : puedeEditar && vista === "despachos" ? (
      <EnlaceBoton href="/leche/despachos/nuevo" ancho={false}>Registrar</EnlaceBoton>
    ) : null;

  return (
    <>
      <AvisoGuardado activo={sp.guardado === "1"} />
      <Encabezado titulo="Leche" subtitulo={finca.nombre} acciones={accion} />
      <FilaDesplazable className="mb-3">
        {PESTANAS.map((t) => (
          <Link
            key={t.valor}
            href={t.valor === "produccion" ? "/leche" : `/leche?vista=${t.valor}`}
            aria-current={vista === t.valor ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
              vista === t.valor ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
            }`}
          >
            {t.etiqueta}
          </Link>
        ))}
      </FilaDesplazable>

      {vista === "produccion" ? (
        <Historial fincaId={finca.id} puedeEditar={puedeEditar} pedido={{ periodo: sp.periodo, desde: sp.desde, hasta: sp.hasta, animal: sp.animal }} />
      ) : null}
      {vista === "calidad" ? <Calidad fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "despachos" ? <Despachos fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "frio" ? <FrioEquipo fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
    </>
  );
}
