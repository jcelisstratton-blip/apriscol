import { DIAS_MES, mesesGestacion, type Estacion, type Inicio } from "@/lib/proyeccion/motor";
import { CLAVES, DEFINICION, REFERENCIAS, type ClaveSupuesto, type OrigenSupuesto, type Supuestos } from "@/lib/proyeccion/supuestos";

/**
 * De los datos de la finca a los valores de partida de la proyección. Todo lo que aquí se calcula es puro (sin consultas): `cargar.ts` trae
 * los datos y esta función decide qué número de la finca es lo bastante sólido para usarse y cuál se queda en su valor de referencia.
 */

export type AnimalDato = {
  id: string;
  sexo: "hembra" | "macho";
  estado: string;
  fecha_nacimiento: string | null;
  uso_macho: string | null;
};
export type ReproDato = { animal_id: string; estado: string; fecha_prevista_parto: string | null; ultimo_servicio: string | null; en_lactancia: boolean };
export type PartoDato = { tipo: string; numero_crias: number | null };
export type BajaDato = { animal_id: string; tipo: string; fecha: string; peso_kg: number | null; valor: number | null };
export type LactanciaDato = { fecha_parto: string; fecha_secado: string | null };

export type DatosFinca = {
  hoy: string;
  animales: AnimalDato[];
  repro: ReproDato[];
  /** Partos de los últimos 12 meses. */
  partos: PartoDato[];
  /** Bajas de los últimos 12 meses. */
  bajas: BajaDato[];
  lactancias: LactanciaDato[];
  /** Ordeño de los últimos 90 días: litros totales y número de registros (animal × día). */
  produccion: { litros: number; registros: number };
  /** Costos de los últimos 12 meses por rubro y en cuántos de esos meses hubo costos registrados. */
  costosPorRubro: { rubro: string; total: number }[];
  mesesConCostos: number;
  litros12m: number;
  ingresosLeche12m: number;
  /** Suma de la capacidad de las instalaciones activas (0 si no hay). */
  capacidad: number;
  gestacionDias: number;
  servicioEdadMinMeses: number;
  pesoAdultoHembraKg: number | null;
  /** Meses de lluvia de los Ajustes de la finca (vacío = sin época seca). */
  mesesLluvia?: number[];
};

export type Procedencia = { origen: OrigenSupuesto; muestra?: string };

export type BaseProyeccion = {
  base: Supuestos;
  procedencia: Record<ClaveSupuesto, Procedencia>;
  inicio: Inicio;
  gestacionDias: number;
  /** La época del año, para encarecer el alimento y bajar la leche en los meses secos. */
  estacion: Estacion;
  /** El hato de hoy, para mostrarlo. */
  hato: { vientres: number; sementales: number; crias: number; levante: number; total: number; lactantes: number };
};

export const edadMeses = (nacimiento: string | null, hoy: string): number | null => {
  if (!nacimiento) return null;
  const dias = (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${nacimiento}T00:00:00Z`)) / 86_400_000;
  return Math.max(0, Math.floor(dias / DIAS_MES));
};

const dentro = (clave: ClaveSupuesto, v: number) => Math.min(DEFINICION[clave].max, Math.max(DEFINICION[clave].min, v));
const redondear = (v: number, decimales: number) => Math.round(v * 10 ** decimales) / 10 ** decimales;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function armarBase(d: DatosFinca): BaseProyeccion {
  const base: Supuestos = { ...REFERENCIAS };
  const procedencia = Object.fromEntries(CLAVES.map((k) => [k, { origen: "referencia" as OrigenSupuesto }])) as Record<ClaveSupuesto, Procedencia>;
  const poner = (clave: ClaveSupuesto, valor: number, muestra: string) => {
    const v = redondear(dentro(clave, valor), DEFINICION[clave].decimales);
    base[clave] = v;
    procedencia[clave] = { origen: "finca", muestra };
  };

  // La edad a la que una hembra entra al hato reproductor es la que la finca ya configuró para el primer servicio.
  if (d.servicioEdadMinMeses > 0) poner("edad_entrada_vientres_meses", d.servicioEdadMinMeses, "Ajustes de la finca");
  const edadEntrada = base.edad_entrada_vientres_meses;

  // El hato de hoy por categoría
  const activos = d.animales.filter((a) => a.estado === "activo");
  let vientres = 0;
  let sementales = 0;
  const jovenes = new Map<number, { machos: number; hembras: number }>();
  const sumarJoven = (edad: number, sexo: "macho" | "hembra") => {
    const c = jovenes.get(edad) ?? { machos: 0, hembras: 0 };
    if (sexo === "macho") c.machos += 1;
    else c.hembras += 1;
    jovenes.set(edad, c);
  };
  const hembrasActivas = new Set<string>();
  for (const a of activos) {
    const edad = edadMeses(a.fecha_nacimiento, d.hoy);
    if (a.sexo === "hembra") {
      if (edad === null || edad >= edadEntrada) {
        vientres += 1;
        hembrasActivas.add(a.id);
      } else sumarJoven(edad, "hembra");
    } else if (a.uso_macho === "carne") {
      sumarJoven(edad ?? Math.round(base.edad_venta_meses) - 1, "macho");
    } else if (edad === null || edad >= 12) sementales += 1;
    else sumarJoven(edad, "macho");
  }

  // Preñeces registradas: en qué mes pare cada una
  const G = mesesGestacion(d.gestacionDias);
  const gestantesPorMes = new Array<number>(G).fill(0);
  const servidasPorMes = new Array<number>(G).fill(0);
  let lactantes = 0;
  for (const r of d.repro) {
    if (!hembrasActivas.has(r.animal_id)) continue;
    if (r.en_lactancia) lactantes += 1;
    if (r.estado !== "gestante" && r.estado !== "servida") continue;
    const prevista = r.fecha_prevista_parto;
    if (!prevista) continue;
    const dias = (Date.parse(`${prevista}T00:00:00Z`) - Date.parse(`${d.hoy}T00:00:00Z`)) / 86_400_000;
    const mes = Math.min(G - 1, Math.max(0, Math.floor(dias / DIAS_MES)));
    (r.estado === "gestante" ? gestantesPorMes : servidasPorMes)[mes] += 1;
  }

  // Reproducción
  const partosReales = d.partos.filter((p) => p.tipo !== "aborto");
  if (vientres >= 5 && partosReales.length >= 8) poner("partos_por_hembra_anio", partosReales.length / vientres, plural(partosReales.length, "parto", "partos") + " en 12 meses");
  const conCrias = partosReales.filter((p) => p.numero_crias != null && p.numero_crias > 0);
  if (conCrias.length >= 8) {
    const total = conCrias.reduce((s, p) => s + (p.numero_crias ?? 0), 0);
    poner("prolificidad", total / conCrias.length, plural(conCrias.length, "parto", "partos"));
  }

  // Bajas: quién salió, a qué edad y por qué
  const animal = new Map(d.animales.map((a) => [a.id, a]));
  const hembrasAdultasBaja = d.bajas.filter((b) => {
    const a = animal.get(b.animal_id);
    if (!a || a.sexo !== "hembra") return false;
    const e = edadMeses(a.fecha_nacimiento, b.fecha);
    return e === null || e >= edadEntrada;
  });
  if (vientres >= 15) {
    const muertes = hembrasAdultasBaja.filter((b) => b.tipo === "muerte").length;
    const descartes = hembrasAdultasBaja.filter((b) => b.tipo === "venta" || b.tipo === "sacrificio").length;
    if (muertes >= 3) poner("mortalidad_adultos_pct", (muertes / vientres) * 100, plural(muertes, "muerte", "muertes") + " en 12 meses");
    if (descartes >= 3) poner("descarte_vientres_pct", (descartes / vientres) * 100, plural(descartes, "salida", "salidas") + " en 12 meses");
  }

  // Ventas de animales jóvenes: edad, peso y precio por kilo
  const ventasJovenes = d.bajas
    .filter((b) => b.tipo === "venta" && (b.peso_kg ?? 0) > 0 && (b.valor ?? 0) > 0)
    .map((b) => ({ b, edad: edadMeses(animal.get(b.animal_id)?.fecha_nacimiento ?? null, b.fecha), sexo: animal.get(b.animal_id)?.sexo }))
    .filter((v) => v.edad !== null && v.edad < Math.max(18, edadEntrada));
  if (ventasJovenes.length >= 5) {
    const n = ventasJovenes.length;
    const kg = ventasJovenes.reduce((s, v) => s + (v.b.peso_kg ?? 0), 0);
    const pesos = ventasJovenes.reduce((s, v) => s + (v.b.valor ?? 0), 0);
    const edad = ventasJovenes.reduce((s, v) => s + (v.edad ?? 0), 0) / n;
    const muestra = plural(n, "venta", "ventas") + " en 12 meses";
    poner("peso_venta_kg", kg / n, muestra);
    poner("precio_kg_vivo", pesos / kg, muestra);
    poner("edad_venta_meses", Math.max(base.destete_meses + 1, edad), muestra);
  }
  if (d.pesoAdultoHembraKg != null && d.pesoAdultoHembraKg > 0) poner("peso_descarte_kg", d.pesoAdultoHembraKg, "Ajustes de la finca");

  // Leche
  const cerradas = d.lactancias.filter((l) => l.fecha_secado && l.fecha_secado > l.fecha_parto);
  if (cerradas.length >= 5) {
    const meses = cerradas.reduce((s, l) => s + (Date.parse(l.fecha_secado!) - Date.parse(l.fecha_parto)) / 86_400_000 / DIAS_MES, 0) / cerradas.length;
    poner("lactancia_meses", meses, plural(cerradas.length, "lactancia cerrada", "lactancias cerradas"));
  }
  if (d.produccion.registros >= 30 && d.produccion.litros > 0) poner("litros_dia", d.produccion.litros / d.produccion.registros, plural(d.produccion.registros, "registro de ordeño", "registros de ordeño") + " en 90 días");
  if (d.litros12m >= 100 && d.ingresosLeche12m > 0) poner("precio_litro", d.ingresosLeche12m / d.litros12m, "Ventas de leche de 12 meses");
  if (lactantes >= 5 && d.produccion.registros >= 30) {
    // Cuántas de las que están en lactancia se ordeñan: no se mide directo; se toma el ordeño reciente frente a las lactantes de hoy.
    const ordenadas = Math.min(lactantes, d.produccion.registros / 90);
    poner("hembras_ordenadas_pct", (ordenadas / lactantes) * 100, `${Math.round(ordenadas)} de ${lactantes} en lactancia`);
  }

  // Cuánto se puede aprender de los costos: hay que tener al menos tres meses con costos registrados
  const total = (f: (rubro: string) => boolean) => d.costosPorRubro.filter((r) => f(r.rubro)).reduce((s, r) => s + Number(r.total), 0);
  const meses = d.mesesConCostos;
  const crias = [...jovenes.entries()].filter(([e]) => e < base.destete_meses).reduce((s, [, c]) => s + c.machos + c.hembras, 0);
  const levante = [...jovenes.entries()].filter(([e]) => e >= base.destete_meses).reduce((s, [, c]) => s + c.machos + c.hembras, 0);
  const totalAnimales = vientres + sementales + crias + levante;
  if (meses >= 3 && totalAnimales > 0) {
    const msDia = vientres * base.ms_vientre_seco + lactantes * Math.max(0, base.ms_vientre_lactando - base.ms_vientre_seco) + sementales * base.ms_semental + crias * base.ms_cria + levante * base.ms_levante;
    const alimentacion = total((r) => ["concentrado", "forraje", "sales_suplementos", "leche_maternizada"].includes(r));
    const muestra = `${meses} ${meses === 1 ? "mes" : "meses"} con costos`;
    if (alimentacion > 0 && msDia > 0) poner("costo_kg_ms", alimentacion / meses / (msDia * DIAS_MES), muestra);
    const variables = total((r) => ["vacunas_desparasitantes", "tratamientos", "pruebas_laboratorio", "podologia", "bioseguridad", "material_reproductivo", "asistencia_veterinaria", "identificacion", "fletes"].includes(r));
    if (variables > 0) poner("costo_animal_mes", variables / meses / totalAnimales, muestra);
    const fijos = total((r) => ["mano_obra", "arriendo", "servicios_publicos", "combustible", "mantenimiento", "otros"].includes(r));
    if (fijos > 0) poner("costos_fijos_mes", fijos / meses, muestra);
  }

  if (d.capacidad > 0) poner("capacidad_max_animales", d.capacidad, "Capacidad de tus corrales");

  const cohortes = [...jovenes.entries()].map(([edad, c]) => ({ edad, machos: c.machos, hembras: c.hembras })).sort((a, b) => a.edad - b.edad);
  const inicio: Inicio = { vientres, sementales, lactantes: Math.min(lactantes, vientres), cohortes, gestantesPorMes, servidasPorMes };
  const estacion: Estacion = { mesHoy: Number(d.hoy.slice(5, 7)), mesesLluvia: d.mesesLluvia ?? [] };
  return { base, procedencia, inicio, gestacionDias: d.gestacionDias, estacion, hato: { vientres, sementales, crias, levante, total: totalAnimales, lactantes: inicio.lactantes } };
}
