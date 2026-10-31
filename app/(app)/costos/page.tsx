import { QueAtender } from "@/components/QueAtender";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { AyudaModulo } from "@/components/AyudaModulo";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { PestanasTarjetas } from "@/components/TarjetaOpcion";
import { obtenerContexto } from "@/lib/contexto";
import { AYUDA_COSTOS } from "@/lib/ayuda";
import { direccionExportar, type ReporteId } from "@/lib/costos-reportes";
import { ESCENA_PESTANA_COSTOS } from "@/lib/escenas-costos";
import { hoyBogota } from "@/lib/fechas";
import { esPeriodo, rangoPeriodo } from "@/lib/periodos";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ListaCostoAnimales } from "./ListaCostoAnimales";
import { ListaCostos } from "./ListaCostos";
import { ListaVentas } from "@/components/ListaVentas";
import { Reportes } from "./Reportes";
import { Resumen } from "./Resumen";
import { Aviso } from "@/components/Aviso";
import { pesos } from "@/lib/ferias";
import { RequierePlan } from "@/components/RequierePlan";
import { servicioEnPlan } from "@/lib/planes";
import { leerTodo } from "@/lib/consultas";

export const metadata: Metadata = { title: "Costos" };

const PESTANAS = [
  { valor: "resumen", etiqueta: "Resumen", detalle: "Compras, ventas y resultado" },
  { valor: "compras", etiqueta: "Compras", detalle: "Todo lo que costó, uno por uno" },
  { valor: "ventas", etiqueta: "Ventas", detalle: "Todo lo que se vendió y se cobró" },
  { valor: "animales", etiqueta: "Por animal", detalle: "Cuánto cuesta cada animal" },
  { valor: "reportes", etiqueta: "Reportes", detalle: "Descarga en Excel" },
] as const;
type Vista = (typeof PESTANAS)[number]["valor"];
/** Qué reporte descarga el botón de cada pestaña. */
const REPORTE_DE: Partial<Record<Vista, ReporteId>> = { resumen: "resultado", compras: "detalle", ventas: "ventas", animales: "animales" };

/**
 * Costos (menú de todo el hato): el resumen de compras, mano de obra y ventas con filtros por cualquier fecha, todo lo que costó, todo lo que se vendió,
 * el costo por animal y los reportes en Excel. Compras y ventas se registran en Hato → Compras y Hato → Ventas, y lo de cada animal en su ficha.
 */
export default async function PaginaCostos({ searchParams }: { searchParams: Promise<{ vista?: string; periodo?: string; desde?: string; hasta?: string }> }) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "contabilidad", finca.plan)) redirect("/");
  const sp = await searchParams;
  // «costos» era el nombre de la pestaña de compras: los enlaces viejos siguen funcionando.
  const vista: Vista = sp.vista === "costos" ? "compras" : PESTANAS.some((p) => p.valor === sp.vista) ? (sp.vista as Vista) : "resumen";
  const puedeEditar = puedeEscribir(rol, "contabilidad", finca.plan);
  const periodo = esPeriodo(sp.periodo) ? sp.periodo : "todo";
  const filtro = { periodo, desde: sp.desde, hasta: sp.hasta };
  const hoy = hoyBogota();
  const rango = rangoPeriodo(periodo, hoy, sp.desde, sp.hasta);
  const reporte = servicioEnPlan(finca.plan, "reportes") ? REPORTE_DE[vista] : undefined;
  const verAnimales = servicioEnPlan(finca.plan, "costoAnimal");
  const verReportes = servicioEnPlan(finca.plan, "reportes");

  // «Por animal»: el costo de cada uno y los gastos de toda la finca, que no se reparten.
  let animales: Awaited<ReturnType<typeof costosAnimales>> | null = null;
  if (vista === "animales" && verAnimales) animales = await costosAnimales(finca.id, rango);

  return (
    <>
      <Encabezado titulo="Costos" subtitulo={finca.nombre} />
      <PestanasTarjetas
        pestanas={PESTANAS.map((p) => ({ ...p, href: p.valor === "resumen" ? "/costos" : `/costos?vista=${p.valor}`, escena: ESCENA_PESTANA_COSTOS[p.valor === "animales" ? "animales" : p.valor] }))}
        actual={vista}
      />
      <div className="mb-3 space-y-1">
        <AyudaModulo ayuda={AYUDA_COSTOS} />
        <FiltroPeriodo ruta="/costos" fijos={vista !== "resumen" ? { vista } : {}} filtro={filtro} />
      </div>
      {reporte ? (
        <div className="mb-3">
          <a href={direccionExportar(reporte, filtro)} download className={`${clasesBoton("secundario")} lg:w-auto lg:px-6`}>
            <Download className="size-5" strokeWidth={2} aria-hidden="true" /> Descargar este reporte en Excel
          </a>
        </div>
      ) : null}

      {vista === "resumen" ? <QueAtender area="dinero" /> : null}
      {vista === "resumen" ? <Resumen fincaId={finca.id} filtros={filtro} /> : null}
      {vista === "compras" ? <ListaCostos fincaId={finca.id} hoy={hoy} puedeEditar={puedeEditar} rango={rango} /> : null}
      {vista === "ventas" ? <ListaVentas fincaId={finca.id} hoy={hoy} puedeEditar={puedeEditar} rango={rango} /> : null}
      {vista === "animales" && !verAnimales ? <RequierePlan servicio="costoAnimal" rol={rol} /> : null}
      {vista === "animales" && animales ? (
        <div className="space-y-3">
          {animales.generales > 0 ? <Aviso tipo="info">Además hay {pesos(animales.generales)} de compras generales de la finca que no se reparten entre los animales.</Aviso> : null}
          <ListaCostoAnimales filas={animales.filas} />
        </div>
      ) : null}
      {vista === "reportes" ? (verReportes ? <Reportes filtro={filtro} /> : <RequierePlan servicio="reportes" rol={rol} />) : null}
    </>
  );
}

async function costosAnimales(fincaId: string, rango: { desde: string | null; hasta: string | null }) {
  const supabase = await crearClienteServidor();
  // Una suma de dinero no puede quedar corta: se leen todas las filas, no las primeras mil.
  const generales = leerTodo((d, h) => {
    let q = supabase.from("gastos").select("monto").eq("finca_id", fincaId).eq("destino_tipo", "finca");
    if (rango.desde) q = q.gte("fecha", rango.desde);
    if (rango.hasta) q = q.lte("fecha", rango.hasta);
    return q.order("id").range(d, h);
  });
  const [{ data }, { data: gen }] = await Promise.all([supabase.rpc("costos_por_animal", { p_finca: fincaId, p_desde: rango.desde, p_hasta: rango.hasta }), generales]);
  return {
    filas: (data ?? []).map((f) => ({ ...f, directo: Number(f.directo), repartido: Number(f.repartido), total: Number(f.total), valor_compra: f.valor_compra != null ? Number(f.valor_compra) : null })),
    generales: (gen ?? []).reduce((s, g) => s + Number(g.monto), 0),
  };
}
