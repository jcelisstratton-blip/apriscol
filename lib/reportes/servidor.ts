import "server-only";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { esPeriodo, rangoPeriodo, type Periodo } from "@/lib/periodos";
import { puedeGestionar, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { limitarFilas, type ContextoReporte } from "@/lib/reportes/base";
import { definicionReporte, filtrosDe, leerFiltros, textoFiltros } from "@/lib/reportes/catalogo";
import { generarReporte } from "@/lib/reportes/generar";
import type { FiltroDef, ReporteDef, ReporteId, ResultadoReporte } from "@/lib/reportes/tipos";
import type { FiltroFechas } from "@/components/FiltroPeriodo";
import type { PlanId } from "@/lib/tipos";

export type ReporteListo = {
  def: ReporteDef;
  resultado: ResultadoReporte;
  finca: { id: string; nombre: string; plan: PlanId };
  filtrosDef: FiltroDef[];
  /** Los valores elegidos de cada filtro. */
  filtros: Record<string, string>;
  /** Los filtros que no están en su valor por defecto, en texto (para el Excel). */
  filtrosTexto: string[];
  fechas: FiltroFechas;
  /** El periodo en palabras, o `null` si el reporte no se mira por fechas. */
  periodoTexto: string | null;
  hoy: string;
  /** Cuántas filas tiene el reporte completo (la pantalla puede mostrar menos). */
  totalFilas: number;
};

const TEXTO_PERIODO: Record<Periodo, string> = { todo: "todo el historial", anio: "este año", "12m": "últimos 12 meses", "6m": "últimos 6 meses", "3m": "últimos 3 meses", rango: "entre fechas" };

/**
 * Lee los filtros de la dirección, comprueba que la persona puede ver ese reporte y lo arma con su sesión (la base decide qué filas ve).
 * Devuelve `null` si su rol o su plan no ven el módulo del reporte. Con `completo` trae todas las filas (para el Excel); sin él, solo las de la pantalla.
 */
export async function prepararReporte(id: ReporteId, params: Record<string, string | undefined>, opciones: { completo?: boolean } = {}): Promise<ReporteListo | null> {
  const { finca, rol } = await obtenerContexto();
  const def = definicionReporte(id);
  // Los reportes del inventario son solo del propietario y el administrador (el veterinario y el ordeñador ven el módulo, no estos reportes).
  if (!puedeVer(rol, def.modulo, finca.plan) || (def.soloGestion && !puedeGestionar(rol))) return null;

  const ajustes = await obtenerAjustes();
  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const filtros = leerFiltros(def, finca.especies, params);
  const periodo: Periodo = def.periodo && esPeriodo(params.periodo) ? params.periodo : "todo";
  const fechas: FiltroFechas = { periodo, desde: params.desde, hasta: params.hasta };
  const rango = def.periodo ? rangoPeriodo(periodo, hoy, params.desde, params.hasta) : { desde: null, hasta: null };

  const contexto: ContextoReporte = {
    supabase,
    fincaId: finca.id,
    hoy,
    ajustes,
    filtros,
    rango,
    puede: (modulo) => puedeVer(rol, modulo, finca.plan),
  };
  const completo = await generarReporte(id, contexto);
  // La pantalla recibe un máximo de filas (el celular no aguanta miles); el Excel lleva todas.
  const resultado = opciones.completo ? completo : limitarFilas(completo);

  return {
    def,
    resultado,
    finca: { id: finca.id, nombre: finca.nombre, plan: finca.plan },
    filtrosDef: filtrosDe(def, finca.especies),
    filtros,
    filtrosTexto: textoFiltros(def, finca.especies, filtros),
    fechas,
    periodoTexto: def.periodo ? (rango.desde || rango.hasta ? `${TEXTO_PERIODO[periodo]}` : TEXTO_PERIODO.todo) : null,
    hoy,
    totalFilas: completo.filas.length,
  };
}

/** Los parámetros de la dirección como un objeto simple (cada uno, el primer valor). */
export function parametrosDe(sp: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}
