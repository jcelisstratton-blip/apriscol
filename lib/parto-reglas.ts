import type { CausaAborto } from "@/lib/tipos";

/** Lo que llega del formulario de un parto, ya leído (texto vacío = no se llenó). */
export type EntradaParto = {
  tipo: string;
  complicaciones?: string;
  observaciones?: string;
  causa_aborto?: CausaAborto | string;
  asistido_por?: string;
  protocolo_posoperatorio?: string;
};

export type DatosParto = {
  complicaciones: string | null;
  observaciones: string | null;
  causa_aborto: CausaAborto | null;
  asistido_por: string | null;
  protocolo_posoperatorio: string | null;
};

/**
 * Cada tipo de evento pide y guarda solo lo suyo. Un parto normal no lleva asistencia; un parto asistido y una cesárea piden quién asistió (el veterinario
 * de la finca u otra persona); una cesárea además guarda el protocolo posoperatorio; un aborto pide la causa aparente (obligatoria) y, si la hubo, quién asistió,
 * sin crías ni pesos.
 */
export function datosPorTipoParto(e: EntradaParto): { error: string } | { datos: DatosParto } {
  const base = { complicaciones: e.complicaciones ?? null, observaciones: e.observaciones ?? null };
  if (e.tipo === "aborto") {
    if (!e.causa_aborto) return { error: "Indica la causa aparente del aborto (si no se sabe, elige «Desconocida»)." };
    return { datos: { ...base, causa_aborto: e.causa_aborto as CausaAborto, asistido_por: e.asistido_por ?? null, protocolo_posoperatorio: null } };
  }
  if (e.tipo === "cesarea") {
    if (!e.asistido_por) return { error: "Elige o escribe quién hizo la cesárea: el veterinario o la persona que la realizó." };
    return { datos: { ...base, causa_aborto: null, asistido_por: e.asistido_por, protocolo_posoperatorio: e.protocolo_posoperatorio ?? null } };
  }
  if (e.tipo === "asistido") {
    if (!e.asistido_por) return { error: "Elige o escribe quién asistió el parto: el veterinario o la persona que ayudó." };
    return { datos: { ...base, causa_aborto: null, asistido_por: e.asistido_por, protocolo_posoperatorio: null } };
  }
  return { datos: { ...base, causa_aborto: null, asistido_por: null, protocolo_posoperatorio: null } };
}
