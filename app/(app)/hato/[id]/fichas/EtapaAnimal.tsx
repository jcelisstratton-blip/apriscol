import { ETIQUETA_ETAPA } from "@/lib/etapas";
import { cargarEtapas } from "@/lib/etapas-servidor";
import type { CtxFicha } from "./contexto";
import { Dato } from "./Dato";

/** Una fila de «Datos»: la etapa de crecimiento del animal y, si hay peso y referencia, su porcentaje del peso adulto. Solo para animales activos. */
export async function EtapaAnimal({ c }: { c: CtxFicha }) {
  const { id, animal, finca, ajustes, supabase, hoy } = c;
  if (animal.estado !== "activo") return null;
  const e = (await cargarEtapas(supabase, finca.id, ajustes, [id], hoy)).get(id);
  if (!e?.etapa) return null;
  return (
    <Dato etiqueta="Etapa">
      {ETIQUETA_ETAPA[e.etapa]}
      {e.porcentaje !== null ? <span className="block text-sm font-normal text-humo">{e.porcentaje} % del peso adulto de la finca ({String(e.pesoAdultoKg).replace(".", ",")} kg)</span> : null}
    </Dato>
  );
}
