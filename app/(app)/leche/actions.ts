"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";

export type ResultadoOrdeno =
  | { ok: true; litros: number; descartada: boolean; motivo: string | null }
  | { ok: false; error: string };

const esquema = z.object({
  animalId: z.uuid(),
  fecha: z.iso.date(),
  jornada: z.enum(["manana", "tarde", "noche", "unico"]),
  litros: z.number().min(0, "Los litros no pueden ser negativos.").max(15, "Más de 15 litros en un ordeño no es posible. Revisa el dato."),
  descartar: z.boolean(),
  solicitud: z.uuid().optional(),
});

/** Guarda (o corrige) el ordeño de un animal en una jornada. La base marca sola la leche en periodo de retiro. */
export async function guardarOrdeno(entrada: z.input<typeof esquema>): Promise<ResultadoOrdeno> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche")) return { ok: false, error: "No tienes permiso para registrar ordeños en esta finca." };

  const datos = esquema.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Dato inválido." };
  const d = datos.data;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("ordenos")
    .upsert(
      {
        finca_id: finca.id,
        animal_id: d.animalId,
        fecha: d.fecha,
        jornada: d.jornada,
        litros: d.litros,
        descartada: d.descartar,
        motivo_descarte: d.descartar ? "otro" : null,
        client_request_id: d.solicitud ?? null,
      },
      { onConflict: "animal_id,fecha,jornada" },
    )
    .select("litros, descartada, motivo_descarte")
    .single();
  if (error || !data) return { ok: false, error: mensajeAmigable(error?.message ?? "") };

  revalidatePath("/");
  return { ok: true, litros: Number(data.litros), descartada: data.descartada, motivo: data.motivo_descarte };
}

export type ResultadoLactancias = { ok: true; agregadas: number; omitidas: number } | { ok: false; error: string };

const esquemaOrdeno = z.object({
  animalIds: z.array(z.uuid()).min(1, "Elige al menos una hembra.").max(500, "Elige hasta 500 hembras a la vez."),
  fechaParto: z.iso.date("La fecha no es válida."),
});

/** Pone hembras en ordeño: abre su lactancia con la fecha aproximada de su último parto. Salta las que ya están en leche. */
export async function ponerEnOrdeno(entrada: z.input<typeof esquemaOrdeno>): Promise<ResultadoLactancias> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche")) return { ok: false, error: "No tienes permiso para esto en esta finca." };
  const datos = esquemaOrdeno.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Dato inválido." };
  const { animalIds, fechaParto } = datos.data;
  if (fechaParto > hoyBogota()) return { ok: false, error: "La fecha del parto no puede ser futura." };

  const supabase = await crearClienteServidor();
  const [{ data: hembras }, { data: previas }] = await Promise.all([
    supabase.from("animales").select("id, fecha_nacimiento").in("id", animalIds).eq("finca_id", finca.id).eq("sexo", "hembra").eq("estado", "activo").is("deleted_at", null),
    supabase.from("lactancias").select("animal_id, numero, fecha_secado").in("animal_id", animalIds).eq("finca_id", finca.id),
  ]);

  const abiertas = new Set((previas ?? []).filter((l) => !l.fecha_secado).map((l) => l.animal_id));
  const maxNumero = new Map<string, number>();
  for (const l of previas ?? []) maxNumero.set(l.animal_id, Math.max(maxNumero.get(l.animal_id) ?? 0, l.numero));

  const filas = (hembras ?? [])
    .filter((a) => !abiertas.has(a.id) && (!a.fecha_nacimiento || a.fecha_nacimiento < fechaParto))
    .map((a) => ({ finca_id: finca.id, animal_id: a.id, numero: (maxNumero.get(a.id) ?? 0) + 1, fecha_parto: fechaParto }));

  if (filas.length > 0) {
    const { error } = await supabase.from("lactancias").insert(filas);
    if (error) return { ok: false, error: mensajeAmigable(error.message) };
  }
  revalidatePath("/leche");
  revalidatePath("/");
  return { ok: true, agregadas: filas.length, omitidas: animalIds.length - filas.length };
}

/** Saca a una hembra del ordeño (la seca): cierra su lactancia abierta hoy. */
export async function sacarDelOrdeno(animalId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche")) return { ok: false, error: "No tienes permiso para esto en esta finca." };
  if (!z.uuid().safeParse(animalId).success) return { ok: false, error: "Animal no válido." };

  const supabase = await crearClienteServidor();
  const { data: lac } = await supabase.from("lactancias").select("id, fecha_parto").eq("animal_id", animalId).eq("finca_id", finca.id).is("fecha_secado", null).maybeSingle();
  if (!lac) return { ok: false, error: "Ese animal no tiene una lactancia abierta." };
  const hoy = hoyBogota();
  const { error } = await supabase.from("lactancias").update({ fecha_secado: hoy > lac.fecha_parto ? hoy : lac.fecha_parto }).eq("id", lac.id);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/leche");
  revalidatePath("/");
  return { ok: true };
}
