"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuario } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

export type EstadoFinca = { error?: string } | undefined;

const esquema = z.object({
  nombre: z.string().trim().min(2, "Ponle un nombre a tu finca.").max(120),
  departamento: z.string().trim().max(60).optional(),
  municipio: z.string().trim().max(80).optional(),
  proposito: z.enum(["leche", "carne", "doble"]),
  especies: z.array(z.enum(["caprino", "ovino"])).min(1, "Elige al menos una especie."),
});

export async function crearFinca(_: EstadoFinca, form: FormData): Promise<EstadoFinca> {
  const user = await obtenerUsuario();
  const datos = esquema.safeParse({
    nombre: form.get("nombre"),
    departamento: form.get("departamento") || undefined,
    municipio: form.get("municipio") || undefined,
    proposito: form.get("proposito"),
    especies: form.getAll("especies"),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("fincas")
    .insert({ ...datos.data, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: mensajeAmigable(error?.message ?? "") };

  // El trigger deja la primera finca como activa; para las siguientes se marca aquí.
  await supabase.from("perfiles").update({ finca_activa_id: data.id }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function cambiarFinca(fincaId: string): Promise<{ error?: string }> {
  const user = await obtenerUsuario();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("perfiles").update({ finca_activa_id: fincaId }).eq("id", user.id);
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/", "layout");
  return {};
}
