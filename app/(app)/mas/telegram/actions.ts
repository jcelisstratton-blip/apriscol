"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Un código de un solo uso (15 minutos) para vincular el Telegram de la persona con su finca activa. Solo se guarda su huella en la base de datos. */
export async function crearCodigoTelegram(): Promise<Resultado<{ codigo: string }>> {
  const { finca } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("telegram_crear_codigo", { p_finca: finca.id });
  if (error || !data) return { ok: false, error: mensajeAmigable(error?.message ?? "No se pudo crear el código. Intenta de nuevo.") };
  revalidatePath("/mas/telegram");
  return { ok: true, codigo: data };
}

/** La persona deja de recibir avisos en ese Telegram (el chat queda libre para vincular otro). */
export async function desvincularTelegram(): Promise<Resultado> {
  const { finca } = await obtenerContexto();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("telegram_desvincular", { p_finca: finca.id });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/mas/telegram");
  return { ok: true };
}
