import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CAUSAS_ABORTO, MAX_CRIAS, TIPOS_PARTO } from "@/lib/reproduccion";
import { leerNumero } from "@/lib/numeros";
import { noFutura, opcional, texto } from "@/lib/validacion";
import { hembraActiva } from "@/lib/servicio-reglas";
import type { CausaAborto, Database } from "@/lib/tipos";

type Cliente = SupabaseClient<Database>;

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

// ───────────────────────── Parto nuevo (con sus crías) ─────────────────────────
export const esquemaCria = z.object({
  sexo: z.enum(["hembra", "macho"], "Indica el sexo de cada cría.").nullable().optional(),
  vivo: z.boolean(),
  // El peso llega como lo escribió la persona («3,2»); un texto que no es número no se descarta en silencio.
  peso: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : (leerNumero(v) ?? v)) : (v ?? undefined)),
    z.number("El peso de la cría debe ser un número, como 3,2.").min(0.1, "El peso al nacer debe estar entre 0,1 y 15 kg.").max(15, "El peso al nacer debe estar entre 0,1 y 15 kg.").optional(),
  ),
  arete: z.string().trim().max(40, "El arete es muy largo.").optional(),
  nombre: z.string().trim().max(60, "El nombre es muy largo.").optional(),
});

/** Lo clínico de un parto: complicaciones y observaciones de todos; causa del aborto; y el médico y el protocolo de una cesárea. */
export const camposClinicosParto = {
  complicaciones: texto(1000, "Las complicaciones son muy largas."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  causa_aborto: opcional(z.enum(CAUSAS_ABORTO as [string, ...string[]], "Elige la causa aparente del aborto.")),
  asistido_por: texto(120, "El nombre de quien asistió es muy largo."),
  protocolo_posoperatorio: texto(1000, "El protocolo posoperatorio es muy largo."),
};

export const esquemaParto = z.object({
  madre_id: z.uuid("Elige la hembra."),
  fecha: z.iso.date("Indica la fecha del parto."),
  tipo: z.enum(TIPOS_PARTO as [string, ...string[]], "Elige qué pasó."),
  servicio_id: opcional(z.uuid()),
  ...camposClinicosParto,
  crias: opcional(z.string().max(5000)),
  client_request_id: opcional(z.uuid()),
  parto_id: opcional(z.uuid()),
});

export type CriaEntrada = z.infer<typeof esquemaCria>;

export function leerCrias(texto: string | undefined, tipo: string) {
  if (tipo === "aborto") return { crias: [] as CriaEntrada[] } as const;
  let bruto: unknown;
  try {
    bruto = texto ? JSON.parse(texto) : [];
  } catch {
    return { error: "No se entendieron los datos de las crías. Revísalos." } as const;
  }
  const r = z.array(esquemaCria).max(MAX_CRIAS, `Máximo ${MAX_CRIAS} crías por parto.`).safeParse(bruto);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Revisa los datos de las crías." } as const;
  if (r.data.length === 0) return { error: "Registra al menos una cría (si nació muerta, márcala como no viva)." } as const;
  return { crias: r.data } as const;
}


/** Lo que se revisa de las crías antes de guardar (también en el celular): aretes sin repetir entre ellas, ninguna muerta con arete y sexo en la que se crea como animal. */
export function revisarCrias(crias: CriaEntrada[]): string | null {
  const aretes = crias.map((x) => x.arete).filter((a): a is string => Boolean(a));
  if (new Set(aretes.map((a) => a.toLowerCase())).size !== aretes.length) return "Dos crías tienen el mismo arete. Cámbialo.";
  if (crias.some((x) => x.arete && !x.vivo)) return "Una cría que nació muerta no se crea como animal: quita su arete.";
  if (crias.some((x) => x.arete && !x.sexo)) return "Indica el sexo de la cría que vas a crear como animal.";
  return null;
}

export type PartoListo = { madreId: string; fecha: string; args: { p_finca: string; p_parto: Record<string, unknown>; p_crias: Record<string, unknown>[] } };

/**
 * Valida un parto nuevo y arma lo que recibe `registrar_parto` (el parto, sus crías y los animales de las crías con arete, todo o nada): lo usan el
 * formulario con señal (`crearParto`) y el envío sin señal (`guardarPartoCampo`). `servicioAuto`: si no viene el servicio, se liga al de la gestación
 * en curso (servida o gestante), como hace la pantalla con señal.
 */
export async function prepararParto(supabase: Cliente, fincaId: string, campos: Record<string, unknown>, servicioAuto = false): Promise<PartoListo | { error: string }> {
  const datos = esquemaParto.safeParse(campos);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura };
  const clinico = datosPorTipoParto(d);
  if ("error" in clinico) return { error: clinico.error };
  const c = leerCrias(d.crias, d.tipo);
  if ("error" in c) return { error: c.error ?? "Revisa los datos de las crías." };
  const problemaCrias = revisarCrias(c.crias);
  if (problemaCrias) return { error: problemaCrias };

  const h = await hembraActiva(supabase, fincaId, d.madre_id);
  if ("error" in h) return { error: h.error ?? "No encontramos esa hembra." };
  if (h.hembra.fecha_nacimiento && d.fecha <= h.hembra.fecha_nacimiento) return { error: "El parto debe ser posterior al nacimiento de la hembra." };

  let servicioId = d.servicio_id;
  if (!servicioId && servicioAuto) {
    const { data: r } = await supabase.from("v_repro_hembras").select("servicio_id, ultimo_servicio, estado").eq("animal_id", d.madre_id).maybeSingle();
    if (r?.servicio_id && r.ultimo_servicio && (r.estado === "gestante" || r.estado === "servida")) {
      // Igual que con señal: con una gestación en curso, el parto va después de su servicio.
      if (d.fecha <= r.ultimo_servicio) return { error: "El parto debe ser posterior al servicio." };
      servicioId = r.servicio_id;
    }
  }
  let servicio: { id: string; macho_id: string | null; macho_externo: string | null; fecha: string } | null = null;
  if (servicioId) {
    const { data: s } = await supabase.from("servicios").select("id, macho_id, macho_externo, fecha").eq("id", servicioId).eq("finca_id", fincaId).eq("hembra_id", d.madre_id).maybeSingle();
    if (!s) return { error: "No encontramos el servicio de este parto." };
    if (d.fecha <= s.fecha) return { error: "El parto debe ser posterior al servicio." };
    servicio = s;
  }

  // Los aretes de las crías que se crean como animales no pueden repetirse con el hato: se comprueba antes de guardar nada.
  const aretes = c.crias.map((x) => x.arete).filter((a): a is string => Boolean(a));
  if (aretes.length) {
    const { data: ya } = await supabase.from("animales").select("numero_arete").eq("finca_id", fincaId).in("numero_arete", aretes);
    if (ya && ya.length > 0) return { error: `El arete ${ya[0].numero_arete} ya está en tu hato. Usa otro para la cría.` };
  }
  return {
    madreId: d.madre_id,
    fecha: d.fecha,
    args: {
      p_finca: fincaId,
      p_parto: {
        madre_id: d.madre_id,
        servicio_id: servicio?.id ?? null,
        fecha: d.fecha,
        tipo: d.tipo,
        ...clinico.datos,
        client_request_id: d.client_request_id ?? null,
        padre_id: servicio?.macho_id ?? null,
        padre_externo: servicio?.macho_externo ?? null,
      },
      p_crias: c.crias.map((x) => ({ arete: x.arete ?? null, nombre: x.nombre || null, sexo: x.sexo ?? null, peso: x.peso ?? null, vivo: x.vivo })),
    },
  };
}
