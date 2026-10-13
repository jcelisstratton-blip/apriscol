import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { armarPestanas } from "@/lib/escenas";
import { ListaPesajes } from "@/components/ListaPesajes";
import { PorQueAnalizar } from "@/components/PorQueAnalizar";
import { ListaSalidas } from "@/components/ListaSalidas";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Candidatos } from "./Candidatos";
import { Canales } from "./Canales";
import { Lotes } from "./Lotes";
import { Reglas } from "./Reglas";
import { Resumen } from "./Resumen";

export const metadata: Metadata = { title: "Carne" };

const PESTANAS = [
  { valor: "resumen", etiqueta: "Resumen", detalle: "Cómo va la ceba" },
  { valor: "candidatos", etiqueta: "Candidatos", detalle: "A quién pasar a ceba" },
  { valor: "lotes", etiqueta: "Lotes", detalle: "Grupos en engorde" },
  { valor: "pesajes", etiqueta: "Pesos", detalle: "Peso y ganancia diaria" },
  { valor: "canales", etiqueta: "Canales", detalle: "Rendimiento al sacrificio" },
  { valor: "salidas", etiqueta: "Salidas", detalle: "Ventas y sacrificio" },
  { valor: "reglas", etiqueta: "Reglas", detalle: "Cuándo pasar a ceba" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/**
 * Carne, a nivel de toda la finca: cuántos animales hay en ceba, cuánto pesan y ganan, cuánto alimento gastan y cuáles ya están listos
 * para beneficio, qué rendimiento dan en canal y hacia dónde salen. Pesar animales vive en Hato → Ceba; el peso, el lote y la canal de un solo
 * animal, en su ficha.
 */
export default async function PaginaCarne({ searchParams }: { searchParams: Promise<{ vista?: string; guardado?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "carne", finca.plan)) redirect("/");
  const sp = await searchParams;
  const vista: Vista = PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "resumen";
  const puedeEditar = puedeEscribir(rol, "carne", finca.plan);

  return (
    <>
      <AvisoGuardado activo={sp.guardado === "1"} />
      <Encabezado
        titulo="Carne"
        subtitulo={finca.nombre}
        acciones={puedeEditar && vista === "lotes" ? <EnlaceBoton href="/carne/lotes/nuevo" ancho={false}>Nuevo lote</EnlaceBoton> : null}
      />
      <PestanasTarjetas pestanas={armarPestanas("/carne", "resumen", PESTANAS)} actual={vista} />

      {vista === "resumen" ? <Resumen fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "candidatos" ? <Candidatos fincaId={finca.id} /> : null}
      {vista === "lotes" ? <Lotes fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "pesajes" ? <ListaPesajes fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "canales" ? <Canales fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "reglas" ? <Reglas fincaId={finca.id} especies={finca.especies} puedeEditar={puedeEditar} /> : null}
      {vista === "salidas" ? (
        <div className="space-y-4">
          <PorQueAnalizar linea="carne" />
          <ListaSalidas fincaId={finca.id} puedeEditar={puedeEscribir(rol, "hato", finca.plan)} />
        </div>
      ) : null}
    </>
  );
}
