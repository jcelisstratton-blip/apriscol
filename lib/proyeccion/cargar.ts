import type { SupabaseClient } from "@supabase/supabase-js";
import { leerTodo } from "@/lib/consultas";
import { sumarDias } from "@/lib/fechas";
import { armarBase, type BaseProyeccion, type DatosFinca } from "@/lib/proyeccion/base";
import type { AjustesCompletos } from "@/lib/ajustes";
import type { Database } from "@/lib/tipos";

type Cliente = SupabaseClient<Database>;

/** Trae de la base lo que la proyección necesita de la finca (12 meses hacia atrás) y arma los valores de partida. Todo con la sesión de la persona: la base decide qué ve. */
export async function cargarBase(supabase: Cliente, fincaId: string, hoy: string, ajustes: AjustesCompletos): Promise<BaseProyeccion> {
  const hace12m = sumarDias(hoy, -365);
  const hace90d = sumarDias(hoy, -90);
  const p = { p_finca: fincaId, p_desde: hace12m, p_hasta: hoy };

  const [animales, repro, partos, bajas, lactancias, produccion, rubros, meses, ind, ubic] = await Promise.all([
    leerTodo((d, h) => supabase.from("animales").select("id, sexo, estado, fecha_nacimiento, uso_macho").eq("finca_id", fincaId).is("deleted_at", null).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("v_repro_hembras").select("animal_id, estado, fecha_prevista_parto, ultimo_servicio, en_lactancia").eq("finca_id", fincaId).order("animal_id").range(d, h)),
    leerTodo((d, h) => supabase.from("partos").select("id, tipo, numero_crias").eq("finca_id", fincaId).gte("fecha", hace12m).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("bajas").select("id, animal_id, tipo, fecha, peso_kg, valor").eq("finca_id", fincaId).gte("fecha", hace12m).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("lactancias").select("id, fecha_parto, fecha_secado").eq("finca_id", fincaId).not("fecha_secado", "is", null).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("v_produccion_diaria").select("animal_id, fecha, litros_total").eq("finca_id", fincaId).gte("fecha", hace90d).order("animal_id").order("fecha").range(d, h)),
    supabase.rpc("costos_por_rubro", p),
    supabase.rpc("costos_por_mes", p),
    supabase.rpc("costos_indicadores", p),
    leerTodo((d, h) => supabase.from("ubicaciones").select("id, capacidad").eq("finca_id", fincaId).eq("activa", true).order("id").range(d, h)),
  ]);

  const especieDominante = ajustes.especie.caprino;
  const filaInd = ind.data?.[0];
  const datos: DatosFinca = {
    hoy,
    animales: animales.data.map((a) => ({ id: a.id, sexo: a.sexo, estado: a.estado, fecha_nacimiento: a.fecha_nacimiento, uso_macho: a.uso_macho })),
    repro: repro.data.map((r) => ({ animal_id: r.animal_id ?? "", estado: r.estado ?? "", fecha_prevista_parto: r.fecha_prevista_parto, ultimo_servicio: r.ultimo_servicio, en_lactancia: Boolean(r.en_lactancia) })),
    partos: partos.data.map((x) => ({ tipo: x.tipo, numero_crias: x.numero_crias })),
    bajas: bajas.data.map((b) => ({ animal_id: b.animal_id, tipo: b.tipo, fecha: b.fecha, peso_kg: b.peso_kg == null ? null : Number(b.peso_kg), valor: b.valor == null ? null : Number(b.valor) })),
    lactancias: lactancias.data.map((l) => ({ fecha_parto: l.fecha_parto, fecha_secado: l.fecha_secado })),
    produccion: { litros: produccion.data.reduce((s, r) => s + Number(r.litros_total ?? 0), 0), registros: produccion.data.length },
    costosPorRubro: (rubros.data ?? []).map((r) => ({ rubro: r.rubro, total: Number(r.total) })),
    mesesConCostos: Math.min(12, (meses.data ?? []).filter((m) => Number(m.costos) > 0).length),
    litros12m: Number(filaInd?.litros ?? 0),
    ingresosLeche12m: Number(filaInd?.ingresos_leche ?? 0),
    capacidad: ubic.data.reduce((s, u) => s + (u.capacidad ?? 0), 0),
    gestacionDias: especieDominante.gestacion_dias,
    servicioEdadMinMeses: ajustes.general.servicio_edad_min_meses,
    pesoAdultoHembraKg: especieDominante.peso_adulto_hembra_kg,
    mesesLluvia: ajustes.general.meses_lluvia,
  };
  return armarBase(datos);
}
