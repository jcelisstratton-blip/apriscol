import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { ControlCalidadFila, type CandidatoAnalisis } from "@/components/ControlCalidadFila";
import { Encabezado } from "@/components/Encabezado";
import { Insignia } from "@/components/Insignia";
import { PorQueAnalizar } from "@/components/PorQueAnalizar";
import { obtenerContexto } from "@/lib/contexto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribir, puedeVer } from "@/lib/permisos";
import { diasHasta, formatoFecha, hoyBogota, litros as formatoLitros, sumarDias } from "@/lib/fechas";
import { analisisTraeResultado, CONTROLES_DESPACHO, etiquetaResumen, resumenAnalisis, resumenControles, VENTANA_DIAS } from "@/lib/controles";
import { ETIQUETA_DESTINO } from "@/lib/leche-calidad";
import type { AnalisisLeche, ControlCalidad } from "@/lib/tipos";

export const metadata: Metadata = { title: "Controles de calidad" };
const ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VENTANA = Math.max(...Object.values(VENTANA_DIAS).map((n) => n ?? 0));

/**
 * Los controles de calidad de un despacho de leche (residuos de antibióticos, crioscopia, composición, células somáticas): cada uno
 * queda realizado (con el análisis y su documento) o no realizado (con la constancia). Lo que no se responde queda pendiente.
 */
export default async function PaginaControlesDespacho({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const { id } = await params;
  const { nuevo } = await searchParams;
  if (!ID_UUID.test(id)) notFound();
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "leche")) redirect("/");
  const supabase = await crearClienteServidor();
  const { data: despacho } = await supabase.from("despachos_leche").select("*").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!despacho) notFound();
  const puedeEditar = puedeEscribir(rol, "leche");

  const [controlesDB, analisisDB] = await Promise.all([
    supabase.from("controles_calidad").select("*").eq("despacho_id", id).eq("finca_id", finca.id),
    supabase
      .from("analisis_leche")
      .select("*")
      .eq("finca_id", finca.id)
      .is("animal_id", null)
      .not("soporte_path", "is", null)
      .gte("fecha", sumarDias(despacho.fecha, -MAX_VENTANA))
      .lte("fecha", despacho.fecha)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const controles = (controlesDB.data ?? []) as ControlCalidad[];
  const analisis = (analisisDB.data ?? []) as AnalisisLeche[];
  const porTipo = new Map(controles.map((c) => [c.tipo, c]));

  // El análisis que respalda un control ya realizado puede estar fuera de la ventana de candidatos: se pide aparte.
  const idsRespaldo = controles.map((c) => c.analisis_id).filter((x): x is string => Boolean(x) && !analisis.some((a) => a.id === x));
  const extra = idsRespaldo.length ? ((await supabase.from("analisis_leche").select("*").eq("finca_id", finca.id).in("id", idsRespaldo)).data ?? []) as AnalisisLeche[] : [];
  const todos = [...analisis, ...extra];

  const hoy = hoyBogota();
  const resumen = resumenControles(CONTROLES_DESPACHO, controles);
  const etiqueta = etiquetaResumen(resumen);
  const volver = `/leche/despachos/${id}/controles`;

  return (
    <>
      <Link href="/leche?vista=despachos" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
        <ChevronLeft className="size-5" strokeWidth={2} /> Despachos
      </Link>
      <Encabezado titulo="Controles de calidad" subtitulo={`${formatoLitros(despacho.litros)} litros · ${formatoFecha(despacho.fecha)} · ${ETIQUETA_DESTINO[despacho.destino_tipo]}`} />
      <div className="space-y-4 lg:max-w-2xl">
        {nuevo === "1" ? <Aviso tipo="exito">Despacho registrado. Ahora responde estos controles: si los hiciste, con qué análisis; si no, queda la constancia.</Aviso> : null}
        <PorQueAnalizar linea="leche" />
        <p className="px-1">
          <Insignia tono={etiqueta.tono}>{etiqueta.texto}</Insignia>
        </p>
        {CONTROLES_DESPACHO.map((tipo) => {
          const control = porTipo.get(tipo) ?? null;
          const ventana = VENTANA_DIAS[tipo] ?? 30;
          const candidatos: CandidatoAnalisis[] = analisis
            .filter((a) => analisisTraeResultado(a, tipo) && diasHasta(despacho.fecha, a.fecha) >= 0 && diasHasta(despacho.fecha, a.fecha) <= ventana)
            .map((a) => ({ id: a.id, fecha: a.fecha, resumen: resumenAnalisis(a, tipo), soporte: a.soporte_path! }));
          const actual = control?.analisis_id ? todos.find((a) => a.id === control.analisis_id) : null;
          return (
            <ControlCalidadFila
              key={tipo}
              ambito="despacho"
              id={id}
              tipo={tipo}
              control={control}
              respaldoActual={actual ? { id: actual.id, fecha: actual.fecha, resumen: resumenAnalisis(actual, tipo), soporte: actual.soporte_path ?? "" } : null}
              candidatos={candidatos}
              nuevoAnalisis={puedeEditar ? `/leche/calidad/nuevo?volver=${encodeURIComponent(volver)}` : undefined}
              fechaSugerida={despacho.fecha}
              hoy={hoy}
              puedeEditar={puedeEditar}
            />
          );
        })}
        <p className="px-1 text-sm text-humo">
          El análisis que respalda un control debe ser del tanque o del lote, traer su documento y ser de pocos días antes del despacho (residuos de antibióticos: hasta 3 días; crioscopia: 7; composición y células: 30).
        </p>
      </div>
    </>
  );
}
