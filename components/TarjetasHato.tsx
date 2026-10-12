import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ESCENA_HATO } from "@/lib/escenas";
import { direccionHato, filtrosHato, textoAnimales, type FiltroHato, type VistaHato } from "@/lib/hato";
import type { Especie } from "@/lib/tipos";

/**
 * Las tarjetas del Hato: los filtros de animales (con cuántos hay en cada uno) y las vistas de trabajo. En la lista, el filtro actual lleva el
 * check y cambia sin salir (`onFiltro`); dentro de una vista de trabajo, los filtros vuelven a la lista y la vista actual lleva el check.
 */
export function TarjetasHato({
  especies,
  vistas,
  conteos,
  vistaActiva,
  filtroActivo,
  onFiltro,
}: {
  especies: Especie[];
  vistas: VistaHato[];
  conteos?: Record<FiltroHato, number>;
  vistaActiva?: VistaHato["id"];
  filtroActivo?: FiltroHato;
  /** Solo desde la lista (componente de cliente): elegir un filtro sin cambiar de pantalla. */
  onFiltro?: (f: FiltroHato) => void;
}) {
  return (
    <FilaTarjetas etiqueta="Filtros y vistas del hato">
      {filtrosHato(especies).map((f) => (
        <TarjetaOpcion
          key={f.id}
          escena={ESCENA_HATO[f.id]}
          titulo={f.texto}
          detalle={f.detalle}
          dato={conteos ? textoAnimales(conteos[f.id]) : undefined}
          activo={filtroActivo === f.id}
          {...(onFiltro ? { onClick: () => onFiltro(f.id) } : { href: direccionHato(f.id) })}
        />
      ))}
      {vistas.map((v) => (
        <TarjetaOpcion key={v.id} escena={ESCENA_HATO[v.id]} titulo={v.texto} detalle={v.detalle} href={v.href} activo={vistaActiva === v.id} />
      ))}
    </FilaTarjetas>
  );
}
