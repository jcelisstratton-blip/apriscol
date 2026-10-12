import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaPesajes } from "@/components/ListaPesajes";
import { PorQueAnalizar } from "@/components/PorQueAnalizar";
import { ListaSalidas } from "@/components/ListaSalidas";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { Canales } from "./Canales";
import { Lotes } from "./Lotes";
import { Resumen } from "./Resumen";

export const metadata: Metadata = { title: "Carne" };

const PESTANAS = [
  { valor: "resumen", etiqueta: "Resumen" },
  { valor: "lotes", etiqueta: "Lotes" },
  { valor: "pesajes", etiqueta: "Pesos" },
  { valor: "canales", etiqueta: "Canales" },
  { valor: "salidas", etiqueta: "Salidas" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];

/**
 * Carne, a nivel de toda la finca: cuántos animales hay en ceba, cuánto pesan y ganan, cuánto alimento gastan y cuáles ya están listos
 * para beneficio, qué rendimiento dan en canal y hacia dónde salen. Pesar animales vive en Hato → Ceba; el peso, el lote y la canal de un solo
 * animal, en su ficha.
 */
export default async function PaginaCarne({ searchParams }: { searchParams: Promise<{ vista?: string; guardado?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "carne")) redirect("/");
  const sp = await searchParams;
  const vista: Vista = PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "resumen";
  const puedeEditar = puedeEscribir(rol, "carne");

  return (
    <>
      <AvisoGuardado activo={sp.guardado === "1"} />
      <Encabezado
        titulo="Carne"
        subtitulo={finca.nombre}
        acciones={puedeEditar && vista === "lotes" ? <EnlaceBoton href="/carne/lotes/nuevo" ancho={false}>Nuevo lote</EnlaceBoton> : null}
      />
      <FilaDesplazable className="mb-3">
        {PESTANAS.map((t) => (
          <Link
            key={t.valor}
            href={t.valor === "resumen" ? "/carne" : `/carne?vista=${t.valor}`}
            aria-current={vista === t.valor ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${
              vista === t.valor ? "bg-musgo text-sobre-musgo" : "bg-papel text-humo ring-1 ring-arena hover:text-tinta"
            }`}
          >
            {t.etiqueta}
          </Link>
        ))}
      </FilaDesplazable>

      {vista === "resumen" ? <Resumen fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "lotes" ? <Lotes fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "pesajes" ? <ListaPesajes fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "canales" ? <Canales fincaId={finca.id} puedeEditar={puedeEditar} /> : null}
      {vista === "salidas" ? (
        <div className="space-y-4">
          <PorQueAnalizar linea="carne" />
          <ListaSalidas fincaId={finca.id} puedeEditar={puedeEscribir(rol, "hato")} />
        </div>
      ) : null}
    </>
  );
}
