import { AgregarAlOrdeno } from "@/components/AgregarAlOrdeno";
import { ListaHato } from "@/components/ListaHato";
import { ProgramaOrdeno } from "@/components/ProgramaOrdeno";
import { crearClienteServidor } from "@/lib/supabase/server";
import { etiquetaAnimal } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";

export async function Animales({ fincaId, especies, puedeCrear, puedeTraer }: { fincaId: string; especies: ("caprino" | "ovino")[]; puedeCrear: boolean; puedeTraer: boolean }) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("animales_en_retiro", { p_finca: fincaId });
  const retiros = Object.fromEntries((data ?? []).map((r) => [r.animal_id, { leche: r.retiro_leche_hasta, carne: r.retiro_carne_hasta }]));
  return <ListaHato fincaId={fincaId} especies={especies} retiros={retiros} puedeCrear={puedeCrear} puedeTraer={puedeTraer} />;
}

/** El programa del ordeño: las hembras en leche con sus turnos, y agregar más hembras al ordeño. */
export async function ProgramaLeche({
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
  const { data: lactancias } = await supabase.from("lactancias").select("animal_id").eq("finca_id", fincaId).is("fecha_secado", null);
  const ids = (lactancias ?? []).map((l) => l.animal_id);
  const activas: { id: string; numero_arete: string; nombre: string | null; turnos_ordeno: string[] | null }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("animales")
      .select("id, numero_arete, nombre, turnos_ordeno")
      .eq("finca_id", fincaId)
      .eq("sexo", "hembra")
      .eq("estado", "activo")
      .is("deleted_at", null)
      .in("id", ids.slice(i, i + 100));
    activas.push(...(data ?? []));
  }
  activas.sort((a, b) => a.numero_arete.localeCompare(b.numero_arete, "es", { numeric: true }));

  return (
    <div className="space-y-4 lg:max-w-3xl">
      <p className="px-1 text-[0.9375rem] text-humo">
        Aquí decides qué hembras se ordeñan y en qué turnos. De esto sale la lista de cada turno cuando registras el ordeño en Leche.
      </p>
      <ProgramaOrdeno
        hembras={activas.map((a) => ({ id: a.id, etiqueta: etiquetaAnimal(a), turnos: a.turnos_ordeno }))}
        puedeEditar={puedeEditar}
      />
      {puedeEditar ? <AgregarAlOrdeno fincaId={fincaId} hoy={hoyBogota()} enLeche={ids} /> : null}
    </div>
  );
}
