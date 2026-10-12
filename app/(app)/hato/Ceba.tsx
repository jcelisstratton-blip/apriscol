import { AyudaModulo } from "@/components/AyudaModulo";
import { CebaPesar, type AnimalCeba } from "@/components/CebaPesar";
import { AYUDA_CEBA } from "@/lib/ayuda";
import { crearClienteServidor } from "@/lib/supabase/server";
import { animalesPorIds } from "@/lib/animal-etiquetas";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota, sumarDias } from "@/lib/fechas";

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
  const [lotesDB, cebaDB, machosDB] = await Promise.all([
    supabase.from("lotes_ceba").select("id, nombre").eq("finca_id", fincaId).is("cerrado_en", null).order("nombre").limit(500),
    supabase.rpc("ceba_animales", { p_finca: fincaId }),
    supabase.from("animales").select("id, lote_ceba_id").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null).eq("uso_macho", "carne").limit(1000),
  ]);
  const lotes = lotesDB.data ?? [];
  const abiertos = new Set(lotes.map((l) => l.id));
  const datos = new Map((cebaDB.data ?? []).map((c) => [c.animal_id, c]));
  const reciente = sumarDias(hoy, -DIAS_RECIENTE);

  const ids = new Set<string>();
  const loteDe = new Map<string, string | null>();
  for (const c of datos.values()) {
    const enLoteAbierto = c.lote_id !== null && abiertos.has(c.lote_id);
    // Un animal de un lote ya cerrado no sale de ceba aquí por estar cerrado: se ve solo si lo pesaron hace poco.
    if (enLoteAbierto || (c.fecha_ultimo && c.fecha_ultimo >= reciente)) {
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
    return {
      id: a.id,
      etiqueta: etiquetaAnimal(a),
      loteId: loteDe.get(a.id) ?? null,
      ultimoPeso: c?.peso_ultimo != null ? Number(c.peso_ultimo) : null,
      ultimaFecha: c?.fecha_ultimo ?? null,
      gdpReciente: c?.gdp_reciente_g != null ? Number(c.gdp_reciente_g) : null,
    };
  });

  return (
    <div className="space-y-3">
      <AyudaModulo ayuda={AYUDA_CEBA} />
      <CebaPesar animales={animales} lotes={lotes} hoy={hoy} puedeEditar={puedeEditar} />
    </div>
  );
}
