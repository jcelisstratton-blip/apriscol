"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota, sumarDias } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";

type Resultado = { ok: true } | { ok: false; error: string };
export type EstadoReglas = { error?: string; ok?: boolean } | undefined;

// ───────────────────────── Reglas de ceba de la finca ─────────────────────────
const num = (mensaje: string, min: number, max: number, entero = false) => {
  let n = z.number(mensaje).min(min, mensaje).max(max, mensaje);
  if (entero) n = n.int("Escribe un número entero, sin decimales.");
  return z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? Number.NaN) : v), n);
};

const esquemaReglas = z.object({
  especie: z.enum(["caprino", "ovino"], "Elige la especie."),
  hembra_partos_proxima: num("Los partos para avisar deben estar entre 1 y 20.", 1, 20, true),
  hembra_partos_toca: num("Los partos en que ya le toca deben estar entre 1 y 20.", 1, 20, true),
  hembra_anios_proxima: num("La edad para avisar de las hembras debe estar entre 1 y 20 años.", 1, 20),
  hembra_anios_toca: num("La edad en que ya le toca a una hembra debe estar entre 1 y 20 años.", 1, 20),
  macho_meses_proxima: num("La edad para avisar de los machos debe estar entre 1 y 36 meses.", 1, 36, true),
  macho_meses_toca: num("La edad en que toca decidir sobre un macho debe estar entre 1 y 36 meses.", 1, 36, true),
  reproductor_anios_viejo: num("La edad del reproductor debe estar entre 2 y 20 años.", 2, 20),
  dias_entre_pesajes: num("Los días entre pesos de machos y animales en ceba deben estar entre 7 y 365.", 7, 365, true),
  hembra_dias_entre_pesajes: num("Los días entre pesos de las hembras deben estar entre 7 y 365.", 7, 365, true),
});

/** Guarda las reglas de ceba de una especie. Las edades de las hembras y del reproductor se escriben en años; se guardan en meses. */
export async function guardarReglasCeba(_: EstadoReglas, form: FormData): Promise<EstadoReglas> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "carne", finca.plan)) return { error: "No tienes permiso para cambiar las reglas de ceba en esta finca." };
  const datos = esquemaReglas.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (d.hembra_partos_proxima > d.hembra_partos_toca) return { error: "Los partos para avisar no pueden ser más que los partos en que ya le toca." };
  if (d.hembra_anios_proxima > d.hembra_anios_toca) return { error: "La edad para avisar de una hembra no puede ser mayor que la edad en que ya le toca." };
  if (d.macho_meses_proxima > d.macho_meses_toca) return { error: "La edad para avisar de un macho no puede ser mayor que la edad en que toca decidir." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("reglas_ceba").upsert(
    {
      finca_id: finca.id,
      especie: d.especie,
      hembra_partos_proxima: d.hembra_partos_proxima,
      hembra_partos_toca: d.hembra_partos_toca,
      hembra_meses_proxima: Math.round(d.hembra_anios_proxima * 12),
      hembra_meses_toca: Math.round(d.hembra_anios_toca * 12),
      macho_meses_proxima: d.macho_meses_proxima,
      macho_meses_toca: d.macho_meses_toca,
      reproductor_meses_viejo: Math.round(d.reproductor_anios_viejo * 12),
      dias_entre_pesajes: d.dias_entre_pesajes,
      hembra_dias_entre_pesajes: d.hembra_dias_entre_pesajes,
    },
    { onConflict: "finca_id,especie" },
  );
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  revalidatePath("/");
  return { ok: true };
}

/** Vuelve a los valores sugeridos de una especie (borra la regla propia de la finca). */
export async function restablecerReglasCeba(especie: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "carne", finca.plan)) return { ok: false, error: "No tienes permiso para cambiar las reglas de ceba en esta finca." };
  const e = z.enum(["caprino", "ovino"]).safeParse(especie);
  if (!e.success) return { ok: false, error: "Especie no válida." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("reglas_ceba").delete().eq("finca_id", finca.id).eq("especie", e.data);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  revalidatePath("/");
  return { ok: true };
}

// ───────────────────────── Decisiones sobre un candidato ─────────────────────────
const esquemaPosponer = z.object({ animalId: z.uuid(), meses: z.union([z.literal(1), z.literal(3), z.literal(6)]) });

async function permisoAnimal(verbo: string) {
  const { finca, rol } = await obtenerContexto();
  // Cambiar un animal exige además poder editar el hato.
  if (!puedeEscribir(rol, "carne", finca.plan) || !puedeEscribir(rol, "hato", finca.plan)) return { ok: false, error: `No tienes permiso para ${verbo} en esta finca.` } as const;
  return { ok: true, finca } as const;
}

/** «Recordármelo después»: durante 1, 3 o 6 meses el animal no aparece como candidato. */
export async function posponerCeba(entrada: z.input<typeof esquemaPosponer>): Promise<Resultado & { hasta?: string }> {
  const p = await permisoAnimal("aplazar este aviso");
  if (!p.ok) return p;
  const d = esquemaPosponer.safeParse(entrada);
  if (!d.success) return { ok: false, error: "Elige por cuánto tiempo aplazarlo." };
  const hasta = sumarDias(hoyBogota(), d.data.meses * 30);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("animales").update({ ceba_pospuesto_hasta: hasta }).eq("id", d.data.animalId).eq("finca_id", p.finca.id).eq("estado", "activo").is("deleted_at", null).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese animal en el hato." };
  revalidatePath("/carne");
  revalidatePath("/");
  revalidatePath(`/hato/${d.data.animalId}`);
  return { ok: true, hasta };
}

/** Quita el «recordármelo después»: el animal vuelve a aparecer si todavía cumple. */
export async function quitarAplazamientoCeba(animalId: string): Promise<Resultado> {
  const p = await permisoAnimal("cambiar este aviso");
  if (!p.ok) return p;
  if (!z.uuid().safeParse(animalId).success) return { ok: false, error: "Animal no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("animales").update({ ceba_pospuesto_hasta: null }).eq("id", animalId).eq("finca_id", p.finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese animal." };
  revalidatePath("/carne");
  revalidatePath("/");
  revalidatePath(`/hato/${animalId}`);
  return { ok: true };
}

const esquemaUso = z.object({ animalId: z.uuid(), uso: z.enum(["reproductor", "carne"], "Elige para qué es.") });

/** Para qué es un macho: reproductor o de carne (un macho de carne queda listo para ponerlo en un lote). */
export async function definirUsoMacho(entrada: z.input<typeof esquemaUso>): Promise<Resultado> {
  const p = await permisoAnimal("cambiar el uso de este macho");
  if (!p.ok) return p;
  const d = esquemaUso.safeParse(entrada);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("animales").update({ uso_macho: d.data.uso }).eq("id", d.data.animalId).eq("finca_id", p.finca.id).eq("sexo", "macho").eq("estado", "activo").select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese macho en el hato." };
  revalidatePath("/carne");
  revalidatePath("/");
  revalidatePath("/hato");
  revalidatePath(`/hato/${d.data.animalId}`);
  return { ok: true };
}
