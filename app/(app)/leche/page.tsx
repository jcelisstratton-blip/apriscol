import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { armarPestanas } from "@/lib/escenas";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Calidad } from "./Calidad";
import { Despachos } from "./Despachos";
import { FrioEquipo } from "./FrioEquipo";
import { Historial } from "./Historial";

export const metadata: Metadata = { title: "Leche" };

const PESTANAS = [
  { valor: "produccion", etiqueta: "Producción", detalle: "Litros por día y animal" },
  { valor: "calidad", etiqueta: "Calidad", detalle: "Grasa, proteína y células" },
  { valor: "despachos", etiqueta: "Despachos", detalle: "A dónde fue la leche" },
  { valor: "frio", etiqueta: "Frío y equipo", detalle: "Tanque y equipos" },
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
  if (!puedeVer(rol, "leche", finca.plan)) redirect("/");
  const sp = await searchParams;
  // Enlaces viejos al registro del ordeño: ahora está en Hato.
  if (sp.vista === "registrar") redirect(sp.agregar && /^[0-9a-f-]{36}$/i.test(sp.agregar) ? `/hato?vista=ordeno&agregar=${sp.agregar}` : "/hato?vista=ordeno");
  if (sp.agregar && /^[0-9a-f-]{36}$/i.test(sp.agregar)) redirect(`/hato?vista=ordeno&agregar=${sp.agregar}`);

  const vista: Vista = PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "produccion";
  const puedeEditar = puedeEscribir(rol, "leche", finca.plan);
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
      <PestanasTarjetas pestanas={armarPestanas("/leche", "produccion", PESTANAS)} actual={vista} />

      {vista === "produccion" ? (
        <Historial fincaId={finca.id} puedeEditar={puedeEditar} pedido={{ periodo: sp.periodo, desde: sp.desde, hasta: sp.hasta, animal: sp.animal }} />
      ) : null}
      {vista === "calidad" ? <Calidad fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "despachos" ? <Despachos fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "frio" ? <FrioEquipo fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
    </>
  );
}
