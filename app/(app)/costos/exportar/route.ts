import { NextResponse, type NextRequest } from "next/server";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVer } from "@/lib/permisos";
import { servicioEnPlan } from "@/lib/planes";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { ETIQUETA_GRUPO_COSTO, GRUPOS_COSTO, type GrupoCosto } from "@/lib/costos";
import { ES_REPORTE } from "@/lib/costos-reportes";
import { diasHasta, hoyBogota } from "@/lib/fechas";
import { esPeriodo, rangoPeriodo, type Periodo } from "@/lib/periodos";
import { construirLibro, nombreArchivo, type DatosReporte, type FilaDetalle } from "@/lib/reportes-excel";
import type { CostoLinea } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const TEXTO_PERIODO: Record<Periodo, string> = { todo: "todo el historial", anio: "este año", "12m": "últimos 12 meses", "6m": "últimos 6 meses", "3m": "últimos 3 meses", rango: "entre fechas" };
const POR_PAGINA = 5000;
const TOPE_FILAS = 50_000;

/**
 * Descarga un reporte de costos en Excel con el periodo y los filtros de la pantalla. El archivo se arma en el servidor con la sesión de la persona
 * (la base decide qué puede ver) y se llama «<finca> - <reporte> - <desde> a <hasta>.xlsx».
 */
export async function GET(req: NextRequest) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "contabilidad", finca.plan)) return new NextResponse("No tienes permiso para ver los costos de esta finca.", { status: 403 });
  if (!servicioEnPlan(finca.plan, "reportes")) return new NextResponse("Los reportes en Excel están en el plan Profesional.", { status: 403 });
  const q = req.nextUrl.searchParams;
  const reporte = q.get("reporte");
  if (!ES_REPORTE(reporte)) return new NextResponse("Ese reporte no existe.", { status: 400 });

  const hoy = hoyBogota();
  const periodo: Periodo = esPeriodo(q.get("periodo") ?? undefined) ? (q.get("periodo") as Periodo) : "todo";
  const rango = rangoPeriodo(periodo, hoy, q.get("desde") ?? undefined, q.get("hasta") ?? undefined);
  const grupo = GRUPOS_COSTO.includes(q.get("grupo") as GrupoCosto) ? (q.get("grupo") as GrupoCosto) : null;
  const supabase = await crearClienteServidor();
  const p = { p_finca: finca.id, p_desde: rango.desde, p_hasta: rango.hasta };

  // Las fechas del título: si el periodo no tiene límites, desde el primer movimiento hasta hoy.
  let desde = rango.desde;
  if (!desde) {
    const { data: meses } = await supabase.rpc("costos_por_mes", { ...p });
    desde = meses?.[0]?.mes ?? hoy;
  }
  const hasta = rango.hasta ?? hoy;

  const datos: DatosReporte = {
    finca: finca.nombre,
    desde,
    hasta,
    periodoTexto: TEXTO_PERIODO[periodo],
    filtros: [],
    generado: new Date(),
  };

  /** Todo el detalle del periodo, por páginas (la base devuelve hasta 5.000 filas por llamada). */
  const detalleCompleto = async (rubro: string | null): Promise<CostoLinea[]> => {
    const todas: CostoLinea[] = [];
    for (let salto = 0; salto < TOPE_FILAS; salto += POR_PAGINA) {
      const { data, error } = await supabase.rpc("costos_detalle", { ...p, p_rubro: rubro, p_limite: POR_PAGINA, p_salto: salto });
      if (error) throw new Error(error.message);
      todas.push(...(data ?? []));
      if ((data ?? []).length < POR_PAGINA) break;
    }
    return todas;
  };

  try {
    if (reporte === "rubros" || reporte === "resultado") {
      const { data, error } = await supabase.rpc("costos_por_rubro", { ...p });
      if (error) throw new Error(error.message);
      datos.rubros = data ?? [];
    }
    if (reporte === "meses" || reporte === "resultado") {
      const { data, error } = await supabase.rpc("costos_por_mes", { ...p });
      if (error) throw new Error(error.message);
      datos.meses = data ?? [];
    }
    if (reporte === "resultado") {
      const [ind, dep, lineas] = await Promise.all([supabase.rpc("costos_indicadores", { ...p }), supabase.rpc("costos_depreciacion", { ...p }), supabase.rpc("ventas_por_linea", { ...p })]);
      if (ind.error) throw new Error(ind.error.message);
      if (lineas.error) throw new Error(lineas.error.message);
      datos.indicadores = ind.data?.[0];
      datos.depreciacion = dep.data ?? [];
      datos.ventasLinea = (lineas.data ?? []).map((l) => ({ ...l, total: Number(l.total), por_cobrar: Number(l.por_cobrar), vencido: Number(l.vencido) }));
    }
    if (reporte === "ventas") {
      const { data, error } = await supabase.rpc("ventas_detalle", { ...p, p_linea: null });
      if (error) throw new Error(error.message);
      datos.ventas = data ?? [];
    }
    if (reporte === "detalle" || reporte === "animales") {
      const lineas = await detalleCompleto(reporte === "detalle" && grupo ? `grupo:${grupo}` : null);
      if (reporte === "animales") {
        datos.generalesFinca = lineas.filter((l) => l.destino_tipo === "finca").reduce((s, l) => s + Number(l.monto), 0);
        const { data, error } = await supabase.rpc("costos_por_animal", { ...p });
        if (error) throw new Error(error.message);
        datos.animales = data ?? [];
      } else {
        if (grupo) datos.filtros.push(`Grupo: ${ETIQUETA_GRUPO_COSTO[grupo]}`);
        const [{ data: ubicaciones }, { data: lotes }, animales] = await Promise.all([
          supabase.from("ubicaciones").select("id, nombre").eq("finca_id", finca.id).limit(1000),
          supabase.from("lotes_ceba").select("id, nombre").eq("finca_id", finca.id).limit(1000),
          animalesPorIds(supabase, finca.id, lineas.map((l) => l.animal_id).filter((x): x is string => !!x)),
        ]);
        const nUbic = new Map((ubicaciones ?? []).map((u) => [u.id, u.nombre]));
        const nLote = new Map((lotes ?? []).map((l) => [l.id, l.nombre]));
        const nAnimal = new Map(animales.map((a) => [a.id, etiquetaAnimal(a)]));
        datos.detalle = lineas.map<FilaDetalle>((l) => ({
          fecha: l.fecha,
          origen: l.origen,
          rubro: l.rubro,
          descripcion: l.descripcion,
          proveedor: l.proveedor,
          cargado_a:
            l.destino_tipo === "finca" ? "Toda la finca"
            : l.destino_tipo === "especie" ? (l.especie === "caprino" ? "Todas las cabras" : "Todas las ovejas")
            : l.destino_tipo === "ubicacion" ? (nUbic.get(l.ubicacion_id ?? "") ?? "Un corral o potrero")
            : l.destino_tipo === "lote" ? `Lote ${nLote.get(l.lote_id ?? "") ?? "de ceba"}`
            : l.destino_tipo === "animal" ? (nAnimal.get(l.animal_id ?? "") ?? "Un animal")
            : "Animales tratados",
          estado: l.pagado ? "Pagado" : l.vence && l.vence < hoy ? "Vencido" : "Por pagar",
          vence: l.vence,
          monto: Number(l.monto),
        }));
      }
    }
    if (reporte === "pendientes") {
      let consulta = supabase.from("gastos").select("fecha, vence, proveedor, descripcion, rubro, monto").eq("finca_id", finca.id).is("pagado_en", null);
      if (rango.desde) consulta = consulta.gte("fecha", rango.desde);
      if (rango.hasta) consulta = consulta.lte("fecha", rango.hasta);
      const { data, error } = await consulta.order("vence", { ascending: true, nullsFirst: false }).order("fecha").limit(TOPE_FILAS);
      if (error) throw new Error(error.message);
      datos.pendientes = (data ?? []).map((g) => ({ fecha: g.fecha, vence: g.vence, atraso: g.vence ? Math.max(0, -diasHasta(g.vence, hoy)) : 0, proveedor: g.proveedor, descripcion: g.descripcion, rubro: g.rubro, monto: Number(g.monto) }));
    }
    const libro = await construirLibro(reporte, datos);
    const nombre = nombreArchivo(finca.nombre, reporte, desde, hasta);
    const ascii = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
    return new NextResponse(new Uint8Array(libro), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("No se pudo armar el reporte. Intenta de nuevo.", { status: 500 });
  }
}
