import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { AnimalesLote, type AnimalDeLote } from "@/components/AnimalesLote";
import { AvisoGuardado } from "@/components/AvisoGuardado";
import { EnlaceBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { Insignia } from "@/components/Insignia";
import { ListaConsumo } from "@/components/ListaConsumo";
import { Tarjeta } from "@/components/Tarjeta";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { etiquetaAnimal } from "@/lib/animal";
import { formatoFecha } from "@/lib/fechas";
import { conversion, gdp, kg, textoConversion } from "@/lib/carne";
import { pesos } from "@/lib/leche-calidad";

export const metadata: Metadata = { title: "Lote de ceba" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un lote de ceba: lo que lleva (peso, ganancia, conversión), sus animales y el alimento que ha comido. */
export default async function PaginaLote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string }> }) {
  const { id } = await params;
  const { guardado } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "carne")) redirect("/");
  const supabase = await crearClienteServidor();
  const { data: lote } = await supabase.from("lotes_ceba").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!lote) notFound();
  const puedeEditar = puedeEscribir(rol, "carne");

  const [estadisticas, animalesDB, cebaDB, retirosDB] = await Promise.all([
    supabase.rpc("ceba_lotes", { p_finca: finca.id }),
    supabase.from("animales").select("id, numero_arete, nombre").eq("finca_id", finca.id).eq("lote_ceba_id", id).eq("estado", "activo").is("deleted_at", null).order("numero_arete").limit(1000),
    supabase.rpc("ceba_animales", { p_finca: finca.id }),
    supabase.rpc("animales_en_retiro", { p_finca: finca.id }),
  ]);
  const e = estadisticas.data?.find((x) => x.lote_id === id);
  const ceba = new Map((cebaDB.data ?? []).map((c) => [c.animal_id, c]));
  const retiro = new Map((retirosDB.data ?? []).map((r) => [r.animal_id, r.retiro_carne_hasta]));
  const animales: AnimalDeLote[] = (animalesDB.data ?? []).map((a) => ({
    id: a.id,
    etiqueta: etiquetaAnimal(a),
    peso: ceba.get(a.id)?.peso_ultimo ?? null,
    fecha: ceba.get(a.id)?.fecha_ultimo ?? null,
    gdpTotal: ceba.get(a.id)?.gdp_total_g ?? null,
    retiroCarneHasta: retiro.get(a.id) ?? null,
  }));

  const kgAlimento = Number(e?.kg_alimento ?? 0);
  const kgGanados = Number(e?.kg_ganados ?? 0);
  const costo = Number(e?.costo_alimento ?? 0);
  const cifras: [string, string][] = [
    ["Animales", String(e?.animales ?? animales.length)],
    ["Peso promedio", kg(e?.peso_promedio)],
    ["Ganancia por día", gdp(e?.gdp_g)],
    ["Conversión", textoConversion(conversion(kgAlimento, kgGanados))],
  ];

  return (
    <>
      <AvisoGuardado activo={guardado === "1"} />
      <Link href="/carne?vista=lotes" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Carne
      </Link>
      <Encabezado
        titulo={lote.nombre}
        subtitulo={`Desde el ${formatoFecha(lote.fecha_inicio)}${lote.cerrado_en ? ` · cerrado el ${formatoFecha(lote.cerrado_en)}` : ""}`}
        acciones={
          puedeEditar ? (
            <EnlaceBoton href={`/carne/lotes/${id}/editar`} variante="secundario" ancho={false}>
              <Pencil className="mr-1.5 size-4" strokeWidth={2} aria-hidden="true" /> Editar
            </EnlaceBoton>
          ) : null
        }
      />

      <div className="space-y-6">
        <section className="space-y-2" aria-label="Resumen del lote">
          <dl className="grid grid-cols-2 gap-2 text-center min-[560px]:grid-cols-4">
            {cifras.map(([et, v]) => (
              <div key={et} className="min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena">
                <dd className="font-display text-xl font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-2xl">{v}</dd>
                <dt className="mt-0.5 text-xs font-medium text-humo">{et}</dt>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2 px-1 text-sm text-humo">
            {lote.peso_meta_kg != null ? <Insignia tono={(e?.listos ?? 0) > 0 ? "ok" : "neutro"}>{`Meta ${kg(lote.peso_meta_kg)} · ${e?.listos ?? 0} ${(e?.listos ?? 0) === 1 ? "listo" : "listos"}`}</Insignia> : <span>Sin peso meta: edítalo para ver cuáles animales están listos.</span>}
            {kgAlimento > 0 ? (
              <span>
                {kg(kgAlimento)} de alimento{costo > 0 ? ` · ${pesos(costo)}` : ""}
                {costo > 0 && kgGanados > 0 ? ` · ${pesos(costo / kgGanados)} por kg ganado` : ""}
              </span>
            ) : null}
          </div>
          {kgAlimento > 0 && kgGanados <= 0 ? <p className="px-1 text-sm text-humo">Todavía no se puede calcular la conversión: falta que los animales tengan dos pesos dentro del lote.</p> : null}
        </section>

        <Tarjeta titulo="Animales del lote" id="animales">
          <AnimalesLote fincaId={finca.id} especies={finca.especies} loteId={id} cerrado={Boolean(lote.cerrado_en)} pesoMeta={lote.peso_meta_kg} animales={animales} puedeEditar={puedeEditar} />
        </Tarjeta>

        <Tarjeta
          titulo="Alimento"
          id="consumo"
          acciones={
            puedeEditar ? (
              <EnlaceBoton href={`/carne/lotes/${id}/consumo/nuevo`} ancho={false}>
                Registrar
              </EnlaceBoton>
            ) : null
          }
        >
          <ListaConsumo fincaId={finca.id} loteId={id} puedeEditar={puedeEditar} />
        </Tarjeta>
      </div>
    </>
  );
}
