import type { SupabaseClient } from "@supabase/supabase-js";
import { enTramos, leerTodo } from "@/lib/consultas";
import type { AjustesCompletos } from "@/lib/ajustes";
import { MESES_ADULTO, etapaDe, pesoAdultoReferencia, porcentajePesoAdulto, type Etapa } from "@/lib/etapas";
import { diasEntre } from "@/lib/trazabilidad";
import type { Database, Especie, SexoAnimal } from "@/lib/tipos";

export type AnimalConEtapa = {
  id: string;
  sexo: SexoAnimal;
  especie: Especie;
  etapa: Etapa | null;
  pesoKg: number | null;
  /** Peso adulto de referencia de su especie (kg), si se conoce. */
  pesoAdultoKg: number | null;
  /** Porcentaje del peso adulto que ya alcanzó (si hay peso y referencia). */
  porcentaje: number | null;
};

type Cliente = SupabaseClient<Database>;

/**
 * Peso adulto de referencia por especie: el que definió la finca o, si no, el promedio de sus hembras adultas pesadas (con al menos 3). Se calcula con un
 * máximo de 600 hembras por especie: es un promedio de referencia, no una cifra que decida algo sobre el hato entero.
 */
export async function pesosAdultosReferencia(supabase: Cliente, fincaId: string, ajustes: AjustesCompletos, hoy: string, especies: Especie[]): Promise<Record<Especie, number | null>> {
  const salida: Record<Especie, number | null> = { caprino: null, ovino: null };
  const corte = new Date(Date.parse(`${hoy}T00:00:00Z`) - MESES_ADULTO * 30.4375 * 86_400_000).toISOString().slice(0, 10);
  for (const e of especies) {
    const definido = ajustes.especie[e].peso_adulto_hembra_kg;
    if (definido !== null) {
      salida[e] = definido;
      continue;
    }
    const { data: hembras } = await supabase.from("animales").select("id").eq("finca_id", fincaId).eq("especie", e).eq("sexo", "hembra").eq("estado", "activo").is("deleted_at", null).lte("fecha_nacimiento", corte).limit(600);
    const pesos: number[] = [];
    for (const t of enTramos((hembras ?? []).map((h) => h.id))) {
      const { data } = await supabase.from("v_peso_animal").select("ultimo_peso_kg").eq("finca_id", fincaId).in("animal_id", t);
      for (const p of data ?? []) if (p.ultimo_peso_kg != null) pesos.push(Number(p.ultimo_peso_kg));
    }
    salida[e] = pesoAdultoReferencia(null, pesos);
  }
  return salida;
}

/** La etapa de cada animal pedido (por tramos de 100), con su último peso y su porcentaje del peso adulto. */
export async function cargarEtapas(supabase: Cliente, fincaId: string, ajustes: AjustesCompletos, ids: string[], hoy: string): Promise<Map<string, AnimalConEtapa>> {
  const unicos = [...new Set(ids)];
  const salida = new Map<string, AnimalConEtapa>();
  if (unicos.length === 0) return salida;
  const animales: { id: string; sexo: SexoAnimal; especie: Especie; fecha_nacimiento: string | null; uso_macho: "reproductor" | "carne" | null; lote_ceba_id: string | null; partos_previos: number | null }[] = [];
  const pesos = new Map<string, number>();
  const conPartos = new Set<string>();
  for (const t of enTramos(unicos)) {
    const [a, p, partos] = await Promise.all([
      supabase.from("animales").select("id, sexo, especie, fecha_nacimiento, uso_macho, lote_ceba_id, partos_previos").eq("finca_id", fincaId).in("id", t),
      supabase.from("v_peso_animal").select("animal_id, ultimo_peso_kg").eq("finca_id", fincaId).in("animal_id", t),
      supabase.from("partos").select("madre_id").eq("finca_id", fincaId).in("madre_id", t),
    ]);
    animales.push(...((a.data ?? []) as typeof animales));
    for (const x of p.data ?? []) if (x.animal_id && x.ultimo_peso_kg != null) pesos.set(x.animal_id, Number(x.ultimo_peso_kg));
    for (const x of partos.data ?? []) conPartos.add(x.madre_id);
  }
  const especies = [...new Set(animales.map((x) => x.especie))];
  const referencia = await pesosAdultosReferencia(supabase, fincaId, ajustes, hoy, especies);
  for (const x of animales) {
    const pesoKg = pesos.get(x.id) ?? null;
    const adultoKg = referencia[x.especie];
    const etapa = etapaDe(
      {
        sexo: x.sexo,
        edadDias: x.fecha_nacimiento ? Math.max(0, diasEntre(x.fecha_nacimiento, hoy)) : null,
        pesoKg,
        tienePartos: conPartos.has(x.id) || (x.partos_previos ?? 0) > 0,
        usoMacho: x.uso_macho,
        enLoteCeba: x.lote_ceba_id !== null,
      },
      { desteteDias: ajustes.general.destete_dias, servicioEdadMeses: ajustes.general.servicio_edad_min_meses, servicioPesoPct: ajustes.general.servicio_peso_adulto_pct, pesoAdultoKg: adultoKg },
    );
    salida.set(x.id, { id: x.id, sexo: x.sexo, especie: x.especie, etapa, pesoKg, pesoAdultoKg: adultoKg, porcentaje: porcentajePesoAdulto(pesoKg, adultoKg) });
  }
  return salida;
}

/** Los ids de los animales que están hoy en una instalación (movimiento abierto), por páginas. */
export async function ocupantesDe(supabase: Cliente, fincaId: string, ubicacionId: string): Promise<string[]> {
  const { data } = await leerTodo((d, h) => supabase.from("movimientos_animales").select("animal_id").eq("finca_id", fincaId).eq("ubicacion_id", ubicacionId).is("hasta", null).order("animal_id").range(d, h));
  return (data ?? []).map((m) => m.animal_id);
}
