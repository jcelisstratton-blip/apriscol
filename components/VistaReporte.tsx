import Link from "next/link";
import { ChevronLeft, ClipboardList, Download } from "lucide-react";
import { AyudaModulo } from "@/components/AyudaModulo";
import { Aviso } from "@/components/Aviso";
import { clasesBoton } from "@/components/Boton";
import { Encabezado } from "@/components/Encabezado";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FiltroPeriodo, type FiltroFechas } from "@/components/FiltroPeriodo";
import { direccionReporte, FiltrosReporte } from "@/components/FiltrosReporte";
import { ListaReporte } from "@/components/ListaReporte";
import type { FiltroDef, ReporteDef, ResultadoReporte } from "@/lib/reportes/tipos";

/**
 * Un reporte ya calculado: sus cifras arriba, los filtros como tarjetas (y el periodo, si se mira por fechas), el aviso o botón de Excel
 * y el listado con buscador. Solo dibuja: el cálculo y los permisos los resuelve la página.
 */
export function VistaReporte({
  def,
  resultado,
  filtrosDef,
  filtros,
  fechas,
  fincaNombre,
  puedeExcel,
}: {
  def: ReporteDef;
  resultado: ResultadoReporte;
  filtrosDef: FiltroDef[];
  filtros: Record<string, string>;
  fechas: FiltroFechas;
  fincaNombre: string;
  puedeExcel: boolean;
}) {
  // Lo que viaja en la dirección además de los filtros: el periodo.
  const extra: Record<string, string | undefined> = def.periodo && fechas.periodo !== "todo" ? { periodo: fechas.periodo, ...(fechas.periodo === "rango" ? { desde: fechas.desde, hasta: fechas.hasta } : {}) } : {};
  const fijosPeriodo = Object.fromEntries(filtrosDef.filter((f) => filtros[f.clave] !== f.opciones[0].valor).map((f) => [f.clave, filtros[f.clave]]));
  const hayFiltros = filtrosDef.some((f) => filtros[f.clave] !== f.opciones[0].valor) || fechas.periodo !== "todo";
  const excel = direccionReporte(def.id, filtrosDef, filtros, extra).replace(`/reportes/${def.id}`, `/reportes/${def.id}/exportar`);

  return (
    <>
      <Link href="/reportes" className="-ml-2 mt-3 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
        <ChevronLeft className="size-5" strokeWidth={1.9} aria-hidden="true" /> Reportes
      </Link>
      <Encabezado titulo={def.titulo} subtitulo={`${def.detalle} · ${fincaNombre}`} />

      <div className="space-y-4">
        <AyudaModulo ayuda={{ titulo: def.titulo, puntos: def.ayuda, enlace: { href: "/reportes", texto: "Ver todos los reportes" } }} />

        {filtrosDef.length > 0 ? <FiltrosReporte id={def.id} filtros={filtrosDef} valores={filtros} extra={extra} /> : null}
        {def.periodo ? <FiltroPeriodo ruta={`/reportes/${def.id}`} fijos={fijosPeriodo} filtro={fechas} etiquetaRango={def.periodo.etiqueta} /> : null}

        {resultado.indicadores.length > 0 ? (
          <dl className="grid grid-cols-2 gap-2 text-center min-[560px]:grid-cols-3 lg:grid-cols-4">
            {resultado.indicadores.map((i) => (
              <div key={i.etiqueta} className="min-w-0 rounded-2xl bg-papel px-1.5 py-3 ring-1 ring-arena">
                <dd className={`font-display text-xl font-semibold tabular-nums sm:text-2xl ${i.alerta ? "text-rojo" : ""}`}>{i.valor}</dd>
                <dt className="mt-0.5 px-1 text-xs font-medium text-humo [overflow-wrap:anywhere]">{i.etiqueta}</dt>
                {i.detalle ? <dd className="px-1 text-[0.6875rem] text-humo/80 [overflow-wrap:anywhere]">{i.detalle}</dd> : null}
              </div>
            ))}
          </dl>
        ) : null}

        {resultado.notas.map((n) => (
          <Aviso key={n} tipo="info">{n}</Aviso>
        ))}

        {puedeExcel ? (
          <a href={excel} download className={`${clasesBoton("secundario", false)} w-full sm:w-auto`}>
            <Download className="size-5" strokeWidth={1.75} aria-hidden="true" /> Descargar en Excel
          </a>
        ) : (
          <Aviso tipo="info">Descargar los reportes en Excel está en el plan Profesional.</Aviso>
        )}

        <ListaReporte
          // Al cambiar de filtro es otra lista: se vuelve a empezar desde arriba.
          key={`${def.id}?${JSON.stringify(filtros)}${extra.periodo ?? ""}${extra.desde ?? ""}${extra.hasta ?? ""}`}
          filas={resultado.filas}
          columnas={resultado.columnas}
          vacio={
            hayFiltros ? (
              <EstadoVacio icono={<ClipboardList strokeWidth={1.5} />} titulo="Nada con estos filtros" descripcion="Cambia el filtro o el periodo para ver otras filas." />
            ) : (
              <EstadoVacio icono={<ClipboardList strokeWidth={1.5} />} titulo={def.vacio.titulo} descripcion={def.vacio.texto} />
            )
          }
        />
      </div>
    </>
  );
}
