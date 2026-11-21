import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/tipos";
import { TECNICAS_INSEMINACION, TIPOS_SERVICIO, TIPOS_TRANSFERENCIA } from "@/lib/reproduccion";
import { opcional, texto, noFutura } from "@/lib/validacion";

/**
 * Las reglas de un servicio (monta natural, inseminación o transferencia de embrión), en un solo lugar: las usan la ficha con señal
 * (`crearServicio` / `editarServicio`) y el respaldo sin señal del mismo formulario (`guardarServicioCampo`, `lib/campo-servidor.ts`).
 */
type Cliente = SupabaseClient<Database>;

/** La hembra existe, es de la finca y sigue en el hato. */
export async function hembraActiva(supabase: Cliente, fincaId: string, id: string) {
  const { data } = await supabase.from("animales").select("id, especie, vocacion, fecha_nacimiento, sexo, estado").eq("id", id).eq("finca_id", fincaId).is("deleted_at", null).maybeSingle();
  if (!data) return { error: "No encontramos esa hembra." } as const;
  if (data.sexo !== "hembra") return { error: "Esto solo se registra sobre una hembra." } as const;
  if (data.estado !== "activo") return { error: "Esa hembra ya salió del hato." } as const;
  return { hembra: data } as const;
}

export const esquemaServicio = z.object({
  hembra_id: z.uuid("Elige la hembra."),
  fecha: z.iso.date("Indica la fecha del servicio."),
  tipo: z.enum(TIPOS_SERVICIO as [string, ...string[]], "Elige el tipo de servicio."),
  macho_id: opcional(z.uuid("El reproductor no es válido.")),
  macho_externo: texto(80, "El nombre del macho es muy largo."),
  semen_lote: texto(60, "El código de la pajilla es muy largo."),
  tecnica_inseminacion: opcional(z.enum(TECNICAS_INSEMINACION as [string, ...string[]], "Elige el tipo de inseminación.")),
  tipo_transferencia: opcional(z.enum(TIPOS_TRANSFERENCIA as [string, ...string[]], "Elige el tipo de transferencia.")),
  embrion_codigo: texto(60, "El código del embrión es muy largo."),
  madre_genetica_id: opcional(z.uuid("La madre genética no es válida.")),
  madre_genetica_externa: texto(80, "El nombre de la madre genética es muy largo."),
  responsable: texto(120, "El nombre del responsable es muy largo."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  servicio_id: opcional(z.uuid()),
});

/** Valida un servicio con los campos de texto del formulario y lo deja listo para la base (cada tipo guarda solo lo suyo). */
export async function leerServicio(campos: Record<string, unknown>, fincaId: string, supabase: Cliente) {
  const datos = esquemaServicio.safeParse(campos);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  if (d.macho_id && d.macho_externo) return { error: "Elige un reproductor de tu hato o escribe el de otra finca, no los dos." } as const;
  if (d.madre_genetica_id && d.madre_genetica_externa) return { error: "Elige la madre genética de tu hato o escribe la de otra finca, no las dos." } as const;
  // Cada tipo de servicio pide lo suyo: la monta, un reproductor; la inseminación, pajilla y técnica; la transferencia, embrión, tipo y madre genética.
  if (!d.macho_id && !d.macho_externo) {
    return { error: d.tipo === "monta_natural" ? "Elige el reproductor que hizo la monta." : d.tipo === "inseminacion" ? "Indica el reproductor donante del semen." : "Indica el padre genético del embrión." } as const;
  }
  if (d.tipo === "inseminacion") {
    if (!d.semen_lote) return { error: "Escribe el código o banco de la pajilla." } as const;
    if (!d.tecnica_inseminacion) return { error: "Elige el tipo de inseminación." } as const;
  }
  if (d.tipo === "transferencia_embrionaria") {
    if (!d.embrion_codigo) return { error: "Escribe el código o lote del embrión." } as const;
    if (!d.tipo_transferencia) return { error: "Elige el tipo de transferencia." } as const;
    if (!d.madre_genetica_id && !d.madre_genetica_externa) return { error: "Indica la madre genética, la hembra donante del óvulo." } as const;
  }
  const h = await hembraActiva(supabase, fincaId, d.hembra_id);
  if ("error" in h) return { error: h.error } as const;
  if (h.hembra.fecha_nacimiento && d.fecha <= h.hembra.fecha_nacimiento) return { error: "El servicio debe ser posterior al nacimiento de la hembra." } as const;
  if (d.madre_genetica_id) {
    if (d.madre_genetica_id === d.hembra_id) return { error: "La madre genética debe ser otra hembra: la que recibe el embrión es la receptora." } as const;
    const { data: mg } = await supabase.from("animales").select("id, sexo, especie").eq("id", d.madre_genetica_id).eq("finca_id", fincaId).is("deleted_at", null).maybeSingle();
    if (!mg || mg.sexo !== "hembra") return { error: "La madre genética debe ser una hembra de tu hato." } as const;
    if (mg.especie !== h.hembra.especie) return { error: "La madre genética debe ser de la misma especie que la receptora." } as const;
  }
  if (d.macho_id) {
    const { data: m } = await supabase.from("animales").select("id, sexo, especie").eq("id", d.macho_id).eq("finca_id", fincaId).is("deleted_at", null).maybeSingle();
    if (!m || m.sexo !== "macho") return { error: "El reproductor debe ser un macho de tu hato." } as const;
    if (m.especie !== h.hembra.especie) return { error: "El reproductor debe ser de la misma especie que la hembra." } as const;
  }
  const esTransferencia = d.tipo === "transferencia_embrionaria";
  return {
    d,
    fila: {
      fecha: d.fecha,
      tipo: d.tipo as never,
      macho_id: d.macho_id ?? null,
      macho_externo: d.macho_externo ?? null,
      // Cada dato solo se guarda en el tipo de servicio al que pertenece.
      semen_lote: d.tipo === "inseminacion" ? (d.semen_lote ?? null) : null,
      tecnica_inseminacion: d.tipo === "inseminacion" ? ((d.tecnica_inseminacion ?? null) as never) : null,
      embrion_codigo: esTransferencia ? (d.embrion_codigo ?? null) : null,
      tipo_transferencia: esTransferencia ? ((d.tipo_transferencia ?? null) as never) : null,
      madre_genetica_id: esTransferencia ? (d.madre_genetica_id ?? null) : null,
      madre_genetica_externa: esTransferencia ? (d.madre_genetica_externa ?? null) : null,
      responsable: d.responsable ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

