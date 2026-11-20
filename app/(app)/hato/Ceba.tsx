import { AyudaModulo } from "@/components/AyudaModulo";
import { CebaPesar, type AnimalCeba } from "@/components/CebaPesar";
import { EnlaceSinSenal } from "@/components/EnlaceSinSenal";
import { AYUDA_CEBA } from "@/lib/ayuda";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";
import { leerCeba } from "@/lib/ceba-servidor";
import { leerAjustesFinca } from "@/lib/ajustes-servidor";
import { DIAS_PESADO_RECIENTE } from "@/lib/semaforos";
import { diasDesde } from "@/lib/fechas";

/** Hato → Ceba: los animales que se están engordando (en un lote abierto, machos de carne o pesados hace poco), listos para pesar. */
export async function Ceba({
  fincaId,
  puedeEditar,
  cliente,
}: {
  fincaId: string;
  puedeEditar: boolean;
  /** Solo para pruebas: un cliente de base de datos en lugar del de la sesión. */
  cliente?: Awaited<ReturnType<typeof crearClienteServidor>>;
}) {
  const supabase = cliente ?? (await crearClienteServidor());
  const hoy = hoyBogota();
  const [{ lotes, datos, ids, loteDe }, ajustes] = await Promise.all([leerCeba(supabase, fincaId, hoy), leerAjustesFinca(supabase, fincaId)]);

  const nombres = await animalesPorIds(supabase, fincaId, [...ids]);
  const animales: AnimalCeba[] = nombres.map((a) => {
    const c = datos.get(a.id);
    const gdpReciente = c?.gdp_reciente_g != null ? Number(c.gdp_reciente_g) : null;
    return {
      id: a.id,
      etiqueta: etiquetaAnimal(a),
      loteId: loteDe.get(a.id) ?? null,
      ultimoPeso: c?.peso_ultimo != null ? Number(c.peso_ultimo) : null,
      ultimaFecha: c?.fecha_ultimo ?? null,
      gdpReciente,
      // Misma regla que la señal «Ganancia de peso baja» de Semáforos: gana menos del mínimo; si lo pesaron hace poco, ya está atendido.
      gdpBajo: gdpReciente !== null && gdpReciente < ajustes.general.gdp_minima_g,
      pesadoReciente: (c?.n_pesajes ?? 0) > 0 && c?.fecha_ultimo != null && diasDesde(c.fecha_ultimo, hoy) <= DIAS_PESADO_RECIENTE,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5">
        <AyudaModulo ayuda={AYUDA_CEBA} />
        <EnlaceSinSenal texto="Pesar sin señal" />
      </div>
      <CebaPesar animales={animales} lotes={lotes} hoy={hoy} puedeEditar={puedeEditar} gdpMinimo={ajustes.general.gdp_minima_g} fincaId={fincaId} />
    </div>
  );
}
