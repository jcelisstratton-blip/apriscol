import type { FilaRanking } from "@/components/RankingLeche";
import type { DiaLeche } from "@/components/TablaDiasLeche";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";
import { direccionLeche, resolverPeriodo, type FilaHistorial } from "@/lib/leche";
import { esBaja } from "@/lib/produccion";
import { VistaHistorial } from "./VistaHistorial";

const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (f: { fecha: string; jornada: string; litros_tanque: unknown; litros_descartados: unknown; ordenos: number; animales: number }): FilaHistorial => ({
  fecha: f.fecha,
  jornada: f.jornada,
  litros_tanque: Number(f.litros_tanque),
  litros_descartados: Number(f.litros_descartados),
  ordenos: f.ordenos,
  animales: f.animales,
});

export async function Historial({
  fincaId,
  puedeEditar,
  pedido,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  pedido: { periodo?: string; desde?: string; hasta?: string; animal?: string };
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const { data: primero } = await supabase.from("ordenos").select("fecha").eq("finca_id", fincaId).order("fecha", { ascending: true }).limit(1).maybeSingle();
  const periodo = resolverPeriodo(pedido, hoy, primero?.fecha ?? null);

  let animal: { id: string; numero_arete: string; nombre: string | null } | null = null;
  if (pedido.animal && ID_UUID.test(pedido.animal)) {
    const { data } = await supabase.from("animales").select("id, numero_arete, nombre").eq("id", pedido.animal).eq("finca_id", fincaId).maybeSingle();
    animal = data;
  }

  const [hist, previo, porAnimal, tendencia, lactancia] = await Promise.all([
    supabase.rpc("produccion_historial", { p_finca: fincaId, p_desde: periodo.desde, p_hasta: periodo.hasta, p_animal: animal?.id ?? null }),
    periodo.anterior
      ? supabase.rpc("produccion_historial", { p_finca: fincaId, p_desde: periodo.anterior.desde, p_hasta: periodo.anterior.hasta, p_animal: animal?.id ?? null })
      : Promise.resolve({ data: null }),
    animal ? Promise.resolve({ data: null }) : supabase.rpc("produccion_por_animal", { p_finca: fincaId, p_desde: periodo.desde, p_hasta: periodo.hasta }),
    supabase.rpc("produccion_tendencia", { p_finca: fincaId }),
    animal
      ? supabase.from("v_lactancias_resumen").select("numero, fecha_parto, fecha_secado, dias_lactancia").eq("animal_id", animal.id).order("numero", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const filas = (hist.data ?? []).map(num);
  const baja = new Map((tendencia.data ?? []).filter(esBaja).map((t) => [t.animal_id, t]));
  const ver = (a?: string) => direccionLeche({ periodo: periodo.id, desde: periodo.desde, hasta: periodo.hasta, animal: a ?? null });

  // Por animal (vista de todo el hato): ranking con nombres.
  let ranking: FilaRanking[] = [];
  let alertas: (NonNullable<typeof tendencia.data>[number] & { etiqueta: string })[] = [];
  if (!animal) {
    const filasAnimal = porAnimal.data ?? [];
    const idsAlertas = [...baja.keys()];
    const nombres = new Map((await animalesPorIds(supabase, fincaId, [...filasAnimal.map((f) => f.animal_id), ...idsAlertas])).map((a) => [a.id, etiquetaAnimal(a)]));
    ranking = filasAnimal.map((f) => ({
      animal_id: f.animal_id,
      etiqueta: nombres.get(f.animal_id) ?? "Animal",
      tanque: Number(f.litros_tanque),
      descartados: Number(f.litros_descartados),
      ordenos: f.ordenos,
      dias: f.dias,
      promedio: f.dias ? Number(f.litros_tanque) / f.dias : 0,
      href: ver(f.animal_id),
      baja: baja.has(f.animal_id),
    }));
    alertas = idsAlertas.map((id) => ({ ...baja.get(id)!, etiqueta: nombres.get(id) ?? "Animal" }));
  }

  // Por animal (vista de un animal): día por día.
  const diasAnimal: DiaLeche[] = [];
  if (animal) {
    const porDia = new Map<string, DiaLeche>();
    for (const f of filas) {
      const d = porDia.get(f.fecha) ?? { fecha: f.fecha, manana: 0, tarde: 0, noche: 0, unico: 0, descartados: 0, total: 0 };
      const j = f.jornada === "manana" || f.jornada === "tarde" || f.jornada === "noche" ? f.jornada : "unico";
      d[j] += f.litros_tanque;
      d.total += f.litros_tanque;
      d.descartados += f.litros_descartados;
      porDia.set(f.fecha, d);
    }
    diasAnimal.push(...[...porDia.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)));
  }
  const tendenciaAnimal = animal ? baja.get(animal.id) : undefined;
  const lac = lactancia.data;

  return (
    <VistaHistorial
      fincaId={fincaId}
      puedeEditar={puedeEditar}
      hoy={hoy}
      periodo={periodo}
      animal={animal}
      lactancia={lac && lac.numero !== null ? { numero: lac.numero, fecha_secado: lac.fecha_secado, dias_lactancia: lac.dias_lactancia ?? 0 } : null}
      tendenciaAnimal={tendenciaAnimal as never}
      alertas={alertas as never}
      filas={filas}
      previas={previo.data ? previo.data.map(num) : null}
      ranking={ranking}
      diasAnimal={diasAnimal}
    />
  );
}
