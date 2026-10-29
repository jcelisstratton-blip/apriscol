import "server-only";
import type { crearClienteServidor } from "@/lib/supabase/server";
import type { AjustesCompletos } from "@/lib/ajustes";
import { etiquetaAnimal } from "@/lib/animal";
import { enTramos, leerTodo } from "@/lib/consultas";
import { aplicaFamacha } from "@/lib/famacha";
import { diasDesde, sumarDias } from "@/lib/fechas";
import { nombreEvento, plazosRevisionPezuna } from "@/lib/sanidad";
import type { FilaInventario } from "@/lib/inventario";
import {
  areasSemaforo,
  senalCalidad,
  senalCorrales,
  senalInventario,
  senalDosis,
  senalFamacha,
  senalCoprologico,
  senalFrio,
  senalPartos,
  senalProduccion,
  senalRetiro,
  senalSecado,
  senalAbortos,
  senalCuarentena,
  senalMantenimiento,
  senalPezunas,
  senalPruebas,
  senalVacunas,
  senalesCeba,
  senalesDinero,
  senalMortalidadCrias,
  senalVaciaSinServicio,
  ABORTOS_VENTANA_DIAS,
  MORTALIDAD_VENTANA_DIAS,
  senalesDiagnostico,
  type AnalisisTanque,
  type DosisPendiente,
  type AbortoReciente,
  type AnimalEnCeba,
  type CompraPorPagar,
  type EventoVacuna,
  type FilaPrueba,
  type VentaPorCobrar,
  type LecturaFrio,
  type MuerteCria,
  type Senal,
} from "@/lib/semaforos";
import type { CuarentenaAlerta, MantenimientoOrdeno, PlanId, ProgramaSanitarioResumen, ReglaCeba, ReproHembra, RolFinca, SanidadPendiente, UbicacionVista } from "@/lib/tipos";
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
    supabase.from("animales").select("id, numero_arete, nombre, estado, fecha_nacimiento, especie, sexo, uso_macho, lote_ceba_id").eq("finca_id", fincaId).is("deleted_at", null).order("id").range(d, h),
  );
  const porId = new Map((animales.data ?? []).map((a) => [a.id, a]));
  const etiqueta = (id: string) => {
    const a = porId.get(id);
    return a ? etiquetaAnimal(a) : "Animal";
  };
  const activo = (id: string) => porId.get(id)?.estado === "activo";
  const adulto = (id: string) => {
    const a = porId.get(id);
    return a ? aplicaFamacha(a, hoy) : false;
  };

  const senales: Senal[] = [];

  if (areas.has("reproduccion")) {
    const { data } = await leerTodo<ReproHembra>((d, h) => supabase.from("v_repro_hembras").select("*").eq("finca_id", fincaId).order("animal_id").range(d, h));
    const filas = ((data ?? []) as ReproHembra[]).filter((f) => activo(f.animal_id));
    // Abortos recientes y crías nacidas en los últimos 90 días (nacidas muertas o muertas antes de los 90 días).
    const desdeCrias = sumarDias(hoy, -MORTALIDAD_VENTANA_DIAS);
    const [abortosDB, partosDB, muertesDB] = await Promise.all([
      supabase.from("partos").select("id, madre_id, fecha, causa_aborto").eq("finca_id", fincaId).eq("tipo", "aborto").gte("fecha", sumarDias(hoy, -ABORTOS_VENTANA_DIAS)).order("fecha", { ascending: false }).limit(100),
      supabase.from("partos").select("id, madre_id, fecha").eq("finca_id", fincaId).neq("tipo", "aborto").gte("fecha", desdeCrias).limit(1000),
      supabase.from("bajas").select("id, animal_id, fecha").eq("finca_id", fincaId).eq("tipo", "muerte").gte("fecha", desdeCrias).limit(1000),
    ]);
    const partos = partosDB.data ?? [];
    const criasDB = await Promise.all(enTramos(partos.map((p) => p.id), 100).map((ids) => supabase.from("crias").select("id, parto_id, vivo, animal_id").eq("finca_id", fincaId).in("parto_id", ids)));
    const crias = criasDB.flatMap((r) => r.data ?? []);
    const madreDe = new Map(partos.map((p) => [p.id, p]));
    const muertes: MuerteCria[] = crias
      .filter((c) => !c.vivo)
      .map((c) => ({ clave: `nacida-muerta-${c.id}`, animalId: null, fecha: madreDe.get(c.parto_id)?.fecha ?? hoy, texto: `Cría de ${etiqueta(madreDe.get(c.parto_id)?.madre_id ?? "")}` }));
    for (const b of muertesDB.data ?? []) {
      const nac = porId.get(b.animal_id)?.fecha_nacimiento;
      // Solo las que nacieron dentro del periodo: así lo que muere cabe dentro de lo que nació y el porcentaje no se infla.
      if (!nac || nac < desdeCrias || diasDesde(nac, b.fecha) > MORTALIDAD_VENTANA_DIAS) continue;
      muertes.push({ clave: `murio-${b.id}`, animalId: b.animal_id, fecha: b.fecha, texto: etiqueta(b.animal_id) });
    }

    senales.push(
      senalPartos(filas, hoy, { preparar: g.parto_preparar_dias, vigilar: g.parto_vigilar_dias }, etiqueta),
      ...senalesDiagnostico(filas, hoy, { desde: g.dx_prenez_dia_desde, hasta: g.dx_prenez_dia_hasta }, etiqueta),
      senalSecado(filas, hoy, g.secado_dias_antes_parto, g.ultimo_tercio_dia, etiqueta),
      senalVaciaSinServicio(filas, hoy, g.vacia_aviso_dias, g.vacia_urgente_dias, etiqueta),
      senalAbortos((abortosDB.data ?? []) as AbortoReciente[], hoy, etiqueta),
      senalMortalidadCrias(crias.length, muertes, hoy),
    );
  }

  if (areas.has("sanidad")) {
    const plazosPezuna = plazosRevisionPezuna(g, hoy);
    const [famacha, coprologico, pendientes, programas, retiro, pruebas, cuarentena, podologia, pediluvio, vacunas] = await Promise.all([
      leerTodo((d, h) => supabase.from("v_famacha_animal").select("animal_id, puntaje, ultima_fecha, desparasitado_en").eq("finca_id", fincaId).gte("puntaje", 3).order("animal_id").range(d, h)),
      leerTodo((d, h) => supabase.from("v_coprologico_animal").select("animal_id, hpg, ultima_fecha, desparasitado_en").eq("finca_id", fincaId).gte("hpg", 1000).is("desparasitado_en", null).order("animal_id").range(d, h)),
      leerTodo((d, h) => supabase.from("v_sanidad_pendiente").select("*").eq("finca_id", fincaId).lte("proxima_fecha", sumarDias(hoy, 7)).order("proxima_fecha").order("evento_id").order("animal_id").range(d, h)),
      supabase.from("v_programas_sanitarios").select("*").eq("finca_id", fincaId).eq("estado", "abierto").lte("fecha_programada", sumarDias(hoy, 7)).order("fecha_programada").limit(100),
      supabase.rpc("animales_en_retiro", { p_finca: fincaId }),
      leerTodo((d, h) => supabase.from("pruebas_sanitarias").select("animal_id, prueba, fecha, resultado").eq("finca_id", fincaId).gte("fecha", sumarDias(hoy, -730)).order("fecha", { ascending: false }).order("id").range(d, h)),
      supabase.from("v_cuarentena_alerta").select("*").eq("finca_id", fincaId).limit(300),
      leerTodo((d, h) => supabase.from("v_podologia_animal").select("animal_id, ultima_fecha").eq("finca_id", fincaId).order("animal_id").range(d, h)),
      leerTodo((d, h) => supabase.from("v_pediluvio_animal").select("animal_id, ultima_fecha").eq("finca_id", fincaId).order("animal_id").range(d, h)),
      g.vacuna_rabia_dias != null || g.vacuna_clostridiosis_dias != null
        ? supabase.from("eventos_sanitarios").select("fecha, producto_nombre").eq("finca_id", fincaId).eq("tipo", "vacunacion").order("fecha", { ascending: false }).limit(300)
        : Promise.resolve({ data: [] as EventoVacuna[] }),
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
      senalCoprologico((coprologico.data ?? []).filter((c) => activo(c.animal_id)), etiqueta),
      senalDosis([...grupos.values()].filter((d) => d.animales > 0), hoy),
      senalRetiro((retiro.data ?? []).filter((r) => activo(r.animal_id)), hoy, etiqueta),
      senalPruebas(((pruebas.data ?? []) as FilaPrueba[]).filter((p) => activo(p.animal_id)), hoy, etiqueta),
      senalCuarentena(((cuarentena.data ?? []) as CuarentenaAlerta[]).filter((c) => activo(c.animal_id)), etiqueta),
      senalPezunas(
        // Las crías de menos de 3 meses no entran: nunca han tenido pezuñas que revisar y estarían siempre «sin registro».
        (podologia.data ?? []).filter((p) => adulto(p.animal_id)),
        (pediluvio.data ?? []).filter((p) => adulto(p.animal_id)),
        plazosPezuna,
        hoy,
      ),
      senalVacunas((vacunas.data ?? []) as EventoVacuna[], g.vacuna_rabia_dias, g.vacuna_clostridiosis_dias, hoy),
    );
  }

  if (areas.has("leche")) {
    const [frio, analisis, tendencia, mantenimiento] = await Promise.all([
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
      supabase.from("mantenimiento_ordeno").select("*").eq("finca_id", fincaId).order("fecha", { ascending: false }).limit(500),
    ]);
    const ultimo = ((analisis.data ?? [])[0] ?? null) as AnalisisTanque | null;
    senales.push(
      senalFrio((frio.data ?? []) as LecturaFrio[], hoy),
      senalCalidad(ultimo, { rcs: g.ccs_limite_miles_ml, grasaMin: cap.grasa_min_pct, grasaMax: cap.grasa_max_pct, proteinaMin: cap.proteina_min_pct, proteinaMax: cap.proteina_max_pct }),
      senalProduccion(((tendencia.data ?? []) as Tendencia[]).filter((t) => activo(t.animal_id)), etiqueta),
      senalMantenimiento((mantenimiento.data ?? []) as MantenimientoOrdeno[], hoy),
    );
  }

  if (areas.has("ceba")) {
    const [lotes, ceba, reglas] = await Promise.all([
      supabase.from("lotes_ceba").select("id").eq("finca_id", fincaId).is("cerrado_en", null).limit(500),
      supabase.rpc("ceba_animales", { p_finca: fincaId }),
      supabase.rpc("reglas_ceba_efectivas", { p_finca: fincaId }),
    ]);
    const abiertos = new Set((lotes.data ?? []).map((l) => l.id));
    const reglaDe = new Map(((reglas.data ?? []) as ReglaCeba[]).map((r) => [r.especie, r]));
    const datos = new Map((ceba.data ?? []).map((c) => [c.animal_id, c]));
    const enCeba: AnimalEnCeba[] = [];
    for (const [id, a] of porId) {
      if (a.estado !== "activo") continue;
      const enLote = a.lote_ceba_id !== null && abiertos.has(a.lote_ceba_id);
      if (!enLote && !(a.sexo === "macho" && a.uso_macho === "carne")) continue;
      const regla = reglaDe.get(a.especie);
      const c = datos.get(id);
      // El peso al nacer no cuenta como pesaje (igual que en Hato → Ceba): sin pesajes de verdad es «sin pesos todavía».
      enCeba.push({
        animalId: id,
        ultimaFecha: c && c.n_pesajes > 0 ? c.fecha_ultimo : null,
        gdpRecienteG: c?.gdp_reciente_g != null ? Number(c.gdp_reciente_g) : null,
        limiteDias: (a.sexo === "hembra" ? regla?.hembra_dias_entre_pesajes : regla?.dias_entre_pesajes) ?? (a.sexo === "hembra" ? 90 : 30),
      });
    }
    senales.push(...senalesCeba(enCeba, g.gdp_minima_g, hoy, etiqueta));
  }

  if (areas.has("dinero")) {
    const limite = sumarDias(hoy, 7);
    const [gastos, ventas] = await Promise.all([
      supabase.from("gastos").select("id, descripcion, monto, vence").eq("finca_id", fincaId).is("pagado_en", null).not("vence", "is", null).lte("vence", limite).order("vence").limit(200),
      supabase.rpc("ventas_pagina", { p_finca: fincaId, p_desde: null, p_hasta: null, p_linea: null, p_limite: 200, p_salto: 0 }),
    ]);
    const compras: CompraPorPagar[] = (gastos.data ?? []).map((x) => ({ id: x.id, descripcion: x.descripcion, monto: Number(x.monto), vence: x.vence! }));
    const porCobrar: VentaPorCobrar[] = (ventas.data ?? [])
      .flatMap((v) => (!v.cobrado && v.cobro_vence !== null && v.cobro_vence <= limite ? [{ clave: `${v.origen}-${v.origen_id}`, producto: v.producto, tercero: v.tercero ?? null, valor: Number(v.valor), cobro_vence: v.cobro_vence }] : []));
    senales.push(...senalesDinero(compras, porCobrar, hoy));
  }

  if (areas.has("corrales")) {
    const { data } = await supabase.from("v_ubicaciones").select("*").eq("finca_id", fincaId).eq("activa", true).or("hacinada.eq.true,estado.eq.debe_salir").limit(100);
    senales.push(senalCorrales((data ?? []) as UbicacionVista[]));
  }

  if (areas.has("inventario")) {
    const { data } = await supabase.rpc("inventario_productos", { p_finca: fincaId });
    senales.push(senalInventario((data ?? []) as FilaInventario[], hoy));
  }

  return senales;
}
