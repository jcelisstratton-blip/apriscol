"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import type { RespuestaTraer } from "@/lib/tipos";

export type EstadoFormTraer = { error?: string; resultado?: RespuestaTraer } | undefined;

const esquema = z.object({
  documento: z
    .string()
    .trim()
    .regex(/^[0-9.\-\s]{5,20}$/, "Escribe solo el número del documento, sin letras."),
  chip: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9*.\-\s]{4,30}$/, "Escribe el microchip tal como aparece en el animal o en su registro."),
});

export async function traerAnimales(_: EstadoFormTraer, form: FormData): Promise<EstadoFormTraer> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { error: "Solo el propietario o un administrador de la finca puede traer animales." };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("traer_animales_libro", { p_finca: finca.id, p_documento: datos.data.documento, p_chip: datos.data.chip });
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/libro/traer");
  revalidatePath("/hato");
  return { resultado: data as RespuestaTraer };
}
