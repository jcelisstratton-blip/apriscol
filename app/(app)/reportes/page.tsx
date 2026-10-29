import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Encabezado } from "@/components/Encabezado";
import { GruposReportes } from "@/components/GruposReportes";
import { obtenerContexto } from "@/lib/contexto";
import { hoyBogota } from "@/lib/fechas";
import { puedeGestionar, puedeVer } from "@/lib/permisos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { reportesVisibles } from "@/lib/reportes/catalogo";
import { cifra } from "@/lib/reportes/formato";
import { construirInvAlimento } from "@/lib/reportes/informes/inv-alimento";
import { construirInvLotes, type LoteFinca } from "@/lib/reportes/informes/inv-lotes";
import { construirInvMedicamentos } from "@/lib/reportes/informes/inv-medicamentos";
import { obtenerAjustes } from "@/lib/ajustes-servidor";
import type { FilaInventario } from "@/lib/inventario";
import type { FilaAlimento } from "@/lib/inventario-alimento";
import type { ReporteId } from "@/lib/reportes/tipos";
import { leerTodo } from "@/lib/consultas";

export const metadata: Metadata = { title: "Reportes" };

/**
 * Reportes: los listados de toda la finca, agrupados por área de trabajo. Cada tarjeta lleva directo a su reporte; algunas muestran cuántos hay hoy.
 * Los conteos son los mismos que el reporte mostrará (no se hacen cuentas aparte), y si uno falla la tarjeta simplemente no lo muestra.
 */
export default async function PaginaReportes() {
  const { finca, rol } = await obtenerContexto();
  const puede = (m: Parameters<typeof puedeVer>[1]) => puedeVer(rol, m, finca.plan);
  const reportes = reportesVisibles(puede, puedeGestionar(rol));
  const verCostos = puede("contabilidad");
  if (reportes.length === 0 && !verCostos) redirect("/");

  const supabase = await crearClienteServidor();
  const hoy = hoyBogota();
  const ids = new Set<ReporteId>(reportes.map((r) => r.id));
  const seguro = async <T,>(f: () => PromiseLike<T>): Promise<T | null> => {
    try {
      return await f();
    } catch {
      return null;
    }
  };

  const [activos, estados, retiros, invMed, invLotes, invAlimento] = await Promise.all([
    ids.has("inventario") ? seguro(() => supabase.from("animales").select("id", { count: "exact", head: true }).eq("finca_id", finca.id).eq("estado", "activo").is("deleted_at", null)) : null,
    ids.has("gestantes") || ids.has("por_palpar") ? seguro(() => leerTodo((d, h) => supabase.from("v_repro_hembras").select("estado").eq("finca_id", finca.id).in("estado", ["gestante", "servida"]).order("animal_id").range(d, h))) : null,
    ids.has("retiro") ? seguro(() => supabase.rpc("animales_en_retiro", { p_finca: finca.id })) : null,
    ids.has("inv_medicamentos") ? seguro(() => supabase.rpc("inventario_productos", { p_finca: finca.id })) : null,
    ids.has("inv_lotes") ? seguro(() => supabase.rpc("inventario_lotes_finca", { p_finca: finca.id })) : null,
    ids.has("inv_alimento") ? seguro(async () => ({ ...(await supabase.rpc("inventario_alimento", { p_finca: finca.id, p_hoy: hoy })), plazo: (await obtenerAjustes()).general.stock_autonomia_dias })) : null,
  ]);

  const datos: Partial<Record<ReporteId, string>> = {};
  if (activos?.count != null) datos.inventario = `${cifra(activos.count)} ${activos.count === 1 ? "animal" : "animales"}`;
  if (estados?.data) {
    const gestantes = estados.data.filter((r) => r.estado === "gestante").length;
    const servidas = estados.data.filter((r) => r.estado === "servida").length;
    datos.gestantes = `${cifra(gestantes)} ${gestantes === 1 ? "gestante" : "gestantes"}`;
    datos.por_palpar = `${cifra(servidas)} por confirmar`;
  }
  if (retiros?.data) {
    const n = retiros.data.filter((r) => (r.retiro_leche_hasta ?? "") >= hoy || (r.retiro_carne_hasta ?? "") >= hoy).length;
    datos.retiro = `${cifra(n)} en retiro`;
  }

  // Las cifras de las tarjetas del inventario salen de los mismos informes que el reporte (nunca una cuenta aparte).
  const cifraDe = (r: { indicadores: { etiqueta: string; valor: string }[] }, etiqueta: string) => r.indicadores.find((i) => i.etiqueta === etiqueta)?.valor;
  if (invMed?.data) datos.inv_medicamentos = `${cifraDe(construirInvMedicamentos({ hoy, estado: "todos", productos: invMed.data as FilaInventario[] }), "Piden atención")} piden atención`;
  if (invLotes?.data) datos.inv_lotes = `${cifraDe(construirInvLotes({ hoy, vencimiento: "todos", lotes: invLotes.data as LoteFinca[] }), "Vencidos")} vencidos`;
  if (invAlimento?.data) datos.inv_alimento = `${cifraDe(construirInvAlimento({ hoy, estado: "todos", plazoDias: invAlimento.plazo, alimentos: invAlimento.data as FilaAlimento[] }), "Piden atención")} piden atención`;

  return (
    <>
      <Encabezado titulo="Reportes" subtitulo={finca.nombre} />
      <GruposReportes reportes={reportes} datos={datos} conCostos={verCostos} />
    </>
  );
}

