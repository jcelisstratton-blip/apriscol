"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

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
