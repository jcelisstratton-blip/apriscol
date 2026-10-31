import { AyudaModulo } from "@/components/AyudaModulo";
import { CebaPesar, type AnimalCeba } from "@/components/CebaPesar";
import { AYUDA_CEBA } from "@/lib/ayuda";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota, sumarDias } from "@/lib/fechas";
import { leerTodo } from "@/lib/consultas";
import { entraEnCeba } from "@/lib/ceba-candidatos";
import { leerAjustesFinca } from "@/lib/ajustes-servidor";
import { DIAS_PESADO_RECIENTE } from "@/lib/semaforos";
import { diasDesde } from "@/lib/fechas";

/** Días desde el último peso para que un animal sin lote siga apareciendo en Ceba. */
const DIAS_RECIENTE = 90;

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
  const [lotesDB, cebaDB, machosDB, ajustes] = await Promise.all([
    supabase.from("lotes_ceba").select("id, nombre").eq("finca_id", fincaId).is("cerrado_en", null).order("nombre").limit(500),
    supabase.rpc("ceba_animales", { p_finca: fincaId }),
    leerTodo((d, h) => supabase.from("animales").select("id, lote_ceba_id").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null).eq("uso_macho", "carne").order("id").range(d, h)),
    leerAjustesFinca(supabase, fincaId),
  ]);
  const lotes = lotesDB.data ?? [];
  const abiertos = new Set(lotes.map((l) => l.id));
  const datos = new Map((cebaDB.data ?? []).map((c) => [c.animal_id, c]));
  const reciente = sumarDias(hoy, -DIAS_RECIENTE);

  const ids = new Set<string>();
  const loteDe = new Map<string, string | null>();
  for (const c of datos.values()) {
    // Un animal de un lote ya cerrado no sale de ceba aquí por estar cerrado: se ve solo si lo pesaron de verdad hace poco
    // (el peso al nacer no cuenta: ver `entraEnCeba`).
    const { entra, enLoteAbierto } = entraEnCeba(c, abiertos, reciente);
    if (entra) {
      ids.add(c.animal_id);
      loteDe.set(c.animal_id, enLoteAbierto ? c.lote_id : null);
    }
  }
  for (const m of machosDB.data ?? []) {
    ids.add(m.id);
    loteDe.set(m.id, m.lote_ceba_id && abiertos.has(m.lote_ceba_id) ? m.lote_ceba_id : null);
  }

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
      <AyudaModulo ayuda={AYUDA_CEBA} />
      <CebaPesar animales={animales} lotes={lotes} hoy={hoy} puedeEditar={puedeEditar} gdpMinimo={ajustes.general.gdp_minima_g} />
    </div>
  );
}
