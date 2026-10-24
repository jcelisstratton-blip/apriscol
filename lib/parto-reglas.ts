import type { CausaAborto } from "@/lib/tipos";

/** Lo que llega del formulario de un parto, ya leído (texto vacío = no se llenó). */
export type EntradaParto = {
  tipo: string;
  complicaciones?: string;
  observaciones?: string;
  causa_aborto?: CausaAborto | string;
  responsable_quirurgico?: string;
  protocolo_posoperatorio?: string;
};

export type DatosParto = {
  complicaciones: string | null;
  observaciones: string | null;
  causa_aborto: CausaAborto | null;
  responsable_quirurgico: string | null;
  protocolo_posoperatorio: string | null;
};

/**
 * Cada tipo de evento pide lo suyo y solo guarda sus datos: un parto normal o asistido, complicaciones y observaciones; una cesárea además el
 * médico veterinario que operó (obligatorio) y el protocolo posoperatorio; un aborto, la causa aparente (obligatoria), sin crías ni pesos.
 */
export function datosPorTipoParto(e: EntradaParto): { error: string } | { datos: DatosParto } {
  const base = { complicaciones: e.complicaciones ?? null, observaciones: e.observaciones ?? null };
  if (e.tipo === "aborto") {
    if (!e.causa_aborto) return { error: "Indica la causa aparente del aborto (si no se sabe, elige «Desconocida»)." };
    return { datos: { ...base, causa_aborto: e.causa_aborto as CausaAborto, responsable_quirurgico: null, protocolo_posoperatorio: null } };
  }
  if (e.tipo === "cesarea") {
    if (!e.responsable_quirurgico) return { error: "Escribe quién hizo la cesárea: el médico veterinario o responsable de la cirugía." };
    return { datos: { ...base, causa_aborto: null, responsable_quirurgico: e.responsable_quirurgico, protocolo_posoperatorio: e.protocolo_posoperatorio ?? null } };
  }
  return { datos: { ...base, causa_aborto: null, responsable_quirurgico: null, protocolo_posoperatorio: null } };
}
