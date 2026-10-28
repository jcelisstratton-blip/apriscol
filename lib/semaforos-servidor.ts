import "server-only";
import type { crearClienteServidor } from "@/lib/supabase/server";
import type { AjustesCompletos } from "@/lib/ajustes";
import { etiquetaAnimal } from "@/lib/animal";
import { leerTodo } from "@/lib/consultas";
import { aplicaFamacha } from "@/lib/famacha";
import { sumarDias } from "@/lib/fechas";
import { nombreEvento } from "@/lib/sanidad";
import {
  areasSemaforo,
  senalCalidad,
  senalCorrales,
  senalDosis,
  senalFamacha,
  senalFrio,
  senalPartos,
  senalProduccion,
  senalRetiro,
  senalSecado,
  senalesDiagnostico,
  type AnalisisTanque,
  type DosisPendiente,
  type LecturaFrio,
  type Senal,
} from "@/lib/semaforos";
import type { PlanId, ProgramaSanitarioResumen, ReproHembra, RolFinca, SanidadPendiente, UbicacionVista } from "@/lib/tipos";
import type { Tendencia } from "@/lib/produccion";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Días hacia atrás que cuentan las lecturas de frío y el último análisis del tanque. */
const DIAS_FRIO = 7;
const DIAS_ANALISIS = 60;

/**
 * Calcula los semáforos que le tocan a esa persona (por rol y plan): solo trae los datos de sus áreas. Las reglas viven en `lib/semaforos.ts`;
 * aquí solo se consulta, con las mismas vistas y funciones que ya usan Hoy, Reproducción, Sanidad y Leche.
 */
export async function cargarSemaforos({
  supabase,
  fincaId,
  rol,
  plan,
  hoy,
  ajustes,
}: {
  supabase: Cliente;
  fincaId: string;
  rol: RolFinca;
  plan: PlanId;
  hoy: string;
  ajustes: AjustesCompletos;
}): Promise<Senal[]> {
  const areas = new Set(areasSemaforo(rol, plan));
  if (areas.size === 0) return [];
  const g = ajustes.general;
  // La leche del tanque es de cabras: se revisa contra el rango de grasa y proteína de la especie caprina.
  const cap = ajustes.especie.caprino;

  // Nombres de los animales: una sola lectura liviana (arete, nombre, estado) y todo lo demás las consulta.
  const animales = await leerTodo((d, h) =>
    supabase.from("animales").select("id, numero_arete, nombre, estado, fecha_nacimiento").eq("finca_id", fincaId).is("deleted_at", null).order("id").range(d, h),
  );
  const porId = new Map((animales.data ?? []).map((a) => [a.id, a]));
  const etiqueta = (id: string) => {
    const a = porId.get(id);
    return a ? etiquetaAnimal(a) : "Animal";
  };
  const activo = (id: string) => porId.get(id)?.estado === "activo";

  const senales: Senal[] = [];

  if (areas.has("reproduccion")) {
    const { data } = await leerTodo<ReproHembra>((d, h) => supabase.from("v_repro_hembras").select("*").eq("finca_id", fincaId).order("animal_id").range(d, h));
    const filas = ((data ?? []) as ReproHembra[]).filter((f) => activo(f.animal_id));
    senales.push(
      senalPartos(filas, hoy, etiqueta),
      ...senalesDiagnostico(filas, hoy, { desde: g.dx_prenez_dia_desde, hasta: g.dx_prenez_dia_hasta }, etiqueta),
      senalSecado(filas, hoy, g.secado_dias_antes_parto, g.ultimo_tercio_dia, etiqueta),
    );
  }

  if (areas.has("sanidad")) {
    const [famacha, pendientes, programas, retiro] = await Promise.all([
      leerTodo((d, h) => supabase.from("v_famacha_animal").select("animal_id, puntaje, ultima_fecha, desparasitado_en").eq("finca_id", fincaId).gte("puntaje", 3).order("animal_id").range(d, h)),
      leerTodo((d, h) => supabase.from("v_sanidad_pendiente").select("*").eq("finca_id", fincaId).lte("proxima_fecha", sumarDias(hoy, 7)).order("proxima_fecha").order("evento_id").order("animal_id").range(d, h)),
      supabase.from("v_programas_sanitarios").select("*").eq("finca_id", fincaId).eq("estado", "abierto").lte("fecha_programada", sumarDias(hoy, 7)).order("fecha_programada").limit(100),
      supabase.rpc("animales_en_retiro", { p_finca: fincaId }),
    ]);

    // Las dosis por aplicar se agrupan por el evento que las programó (igual que en Hoy).
    const grupos = new Map<string, DosisPendiente>();
    for (const p of (pendientes.data ?? []) as SanidadPendiente[]) {
      if (!p.evento_id || !p.animal_id || !p.proxima_fecha || !activo(p.animal_id)) continue;
      const previo = grupos.get(p.evento_id);
      if (previo) previo.animales += 1;
      else grupos.set(p.evento_id, { clave: `dosis-${p.evento_id}`, titulo: nombreEvento(p), fecha: p.proxima_fecha, animales: 1, tipo: "dosis", href: `/hato/sanidad/nuevo?refuerzo=${p.evento_id}` });
    }
    for (const p of (programas.data ?? []) as ProgramaSanitarioResumen[]) {
      grupos.set(`programa-${p.id}`, {
        clave: `programa-${p.id}`,
        titulo: p.producto_nombre?.trim() || "Jornada sanitaria",
        fecha: p.fecha_programada,
        animales: Math.max(0, p.animales - p.aplicados),
        tipo: "programa",
        href: `/hato/sanidad/nuevo?programa=${p.id}`,
      });
    }

    const famachaVigentes = (famacha.data ?? []).filter((f) => {
      const a = porId.get(f.animal_id);
      return a ? aplicaFamacha(a, hoy) : false;
    });
    senales.push(
      senalFamacha(famachaVigentes, etiqueta),
      senalDosis([...grupos.values()].filter((d) => d.animales > 0), hoy),
      senalRetiro((retiro.data ?? []).filter((r) => activo(r.animal_id)), hoy, etiqueta),
    );
  }

  if (areas.has("leche")) {
    const [frio, analisis, tendencia] = await Promise.all([
      supabase.from("controles_frio").select("id, fecha, momento, temperatura_c").eq("finca_id", fincaId).gte("fecha", sumarDias(hoy, -DIAS_FRIO)).order("fecha", { ascending: false }).limit(200),
      supabase
        .from("analisis_leche")
        .select("id, fecha, rcs_miles_ml, grasa_pct, proteina_pct, crioscopia_c, residuos_antibioticos")
        .eq("finca_id", fincaId)
        .is("animal_id", null)
        .gte("fecha", sumarDias(hoy, -DIAS_ANALISIS))
        .order("fecha", { ascending: false })
        .limit(1),
      supabase.rpc("produccion_tendencia", { p_finca: fincaId }),
    ]);
    const ultimo = ((analisis.data ?? [])[0] ?? null) as AnalisisTanque | null;
    senales.push(
      senalFrio((frio.data ?? []) as LecturaFrio[], hoy),
      senalCalidad(ultimo, { rcs: g.ccs_limite_miles_ml, grasaMin: cap.grasa_min_pct, grasaMax: cap.grasa_max_pct, proteinaMin: cap.proteina_min_pct, proteinaMax: cap.proteina_max_pct }),
      senalProduccion(((tendencia.data ?? []) as Tendencia[]).filter((t) => activo(t.animal_id)), etiqueta),
    );
  }

  if (areas.has("corrales")) {
    const { data } = await supabase.from("v_ubicaciones").select("*").eq("finca_id", fincaId).eq("activa", true).or("hacinada.eq.true,estado.eq.debe_salir").limit(100);
    senales.push(senalCorrales((data ?? []) as UbicacionVista[]));
  }

  return senales;
}
