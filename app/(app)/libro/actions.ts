"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import type { RespuestaSolicitud } from "@/lib/tipos";

export type EstadoFormReclamo = { error?: string; resultado?: RespuestaSolicitud } | undefined;

const esquema = z.object({
  tipo: z.enum(["CC", "CE", "NIT"]),
  documento: z
    .string()
    .trim()
    .regex(/^[0-9.\-\s]{5,20}$/, "Escribe solo el número del documento, sin letras."),
  mensaje: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(500).optional()),
});

export async function solicitarReclamo(_: EstadoFormReclamo, form: FormData): Promise<EstadoFormReclamo> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { error: "Solo el propietario o un administrador de la finca puede reclamar animales." };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("solicitar_reclamo", {
    p_finca: finca.id,
    p_tipo: datos.data.tipo,
    p_documento: datos.data.documento,
    p_mensaje: datos.data.mensaje,
  });
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/libro/reclamar");
  return { resultado: data as RespuestaSolicitud };
}
