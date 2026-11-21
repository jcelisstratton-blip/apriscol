import type { SupabaseClient } from "@supabase/supabase-js";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import type { Database, Tercero } from "@/lib/tipos";

type Cliente = SupabaseClient<Database>;

/**
 * El proveedor o comprador con ese nombre: si ya existe (aunque cambie una mayúscula) se devuelve el que había, y si era solo de un tipo y ahora se
 * usa en el otro, pasa a «ambos»; si no, se crea. Así nunca quedan dos con el mismo nombre. Lo usan el selector con señal (`crearTercero`) y la compra
 * anotada sin señal con un proveedor nuevo (`guardarCompraCampo`). `nombre` ya viene validado (sin espacios a los lados, hasta 120 letras).
 */
export async function asegurarTercero(supabase: Cliente, fincaId: string, nombre: string, tipo: "proveedor" | "comprador" | "ambos"): Promise<{ tercero: Tercero } | { error: string }> {
  const { data: previos } = await supabase.from("finca_terceros").select("*").eq("finca_id", fincaId).ilike("nombre", nombre.replace(/[%_\\]/g, (c) => `\\${c}`)).limit(5);
  const igual = (previos ?? []).find((t) => t.nombre.trim().toLowerCase() === nombre.toLowerCase());
  if (igual) {
    if (!igual.activo || (igual.tipo !== "ambos" && igual.tipo !== tipo)) {
      const { data, error } = await supabase.from("finca_terceros").update({ activo: true, tipo: igual.tipo === tipo ? igual.tipo : "ambos" }).eq("id", igual.id).eq("finca_id", fincaId).select("*").single();
      if (error || !data) return { error: mensajeAmigable(error?.message ?? "") };
      return { tercero: data as Tercero };
    }
    return { tercero: igual as Tercero };
  }
  const { data, error } = await supabase.from("finca_terceros").insert({ finca_id: fincaId, nombre, tipo }).select("*").single();
  if (error || !data) return { error: mensajeAmigable(error?.message ?? "") };
  return { tercero: data as Tercero };
}
