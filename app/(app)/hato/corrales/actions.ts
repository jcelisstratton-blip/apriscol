"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import { DIAS_DESCANSO_DEFECTO, DIAS_OCUPACION_DEFECTO, MOTIVOS, PISOS, TIPOS_UBICACION, USOS } from "@/lib/corrales";
import { DIRECCION_CORRALES } from "@/lib/hato";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacio, s.optional());
const entero = (mensaje: string, min: number, max: number) =>
  z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), z.number(mensaje).int(mensaje).min(min, mensaje).max(max, mensaje));
const ID_UUID = z.uuid();

// ───────────────────────── Instalaciones (corrales y potreros) ─────────────────────────
const esquemaUbicacion = z
  .object({
    tipo: z.enum(TIPOS_UBICACION as [string, ...string[]], "Elige si es un corral o un potrero."),
    nombre: z.string().trim().min(1, "Ponle un nombre.").max(80, "El nombre es muy largo (máximo 80 letras)."),
    uso: z.enum(USOS as [string, ...string[]], "Elige para qué se usa."),
    capacidad: opcional(entero("La capacidad debe ser un número entero de animales (de 1 a 5.000).", 1, 5000)),
    area_m2: z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? undefined : (leerNumero(v) ?? v)) : v), z.number("El área debe ser un número.").positive("El área debe ser mayor que cero.").max(99_999_999, "El área es muy grande.").optional()),
    piso: opcional(z.enum(PISOS as [string, ...string[]])),
    agua: z.preprocess((v) => v !== "no", z.boolean()),
    dias_ocupacion_max: opcional(entero("Los días de ocupación deben ser un número entero (de 1 a 60).", 1, 60)),
    dias_descanso_min: opcional(entero("Los días de descanso deben ser un número entero (de 1 a 180).", 1, 180)),
    observaciones: opcional(z.string().trim().max(500, "Las observaciones son muy largas (máximo 500 letras).")),
    ubicacion_id: opcional(z.uuid()),
  })
  .refine((d) => d.tipo !== "corral" || d.capacidad != null, { message: "Indica cuántos animales caben en el corral: así se avisa si se llena de más.", path: ["capacidad"] })
  .refine((d) => !(d.tipo === "potrero" && d.uso === "cuarentena"), { message: "La cuarentena va en un corral aislado, no en un potrero.", path: ["uso"] });

const REPETIDA = "Ya tienes una instalación con ese nombre. Ponle otro.";

function datosUbicacion(d: z.output<typeof esquemaUbicacion>) {
  const potrero = d.tipo === "potrero";
  return {
    tipo: d.tipo as "corral" | "potrero",
    nombre: d.nombre,
    uso: d.uso as never,
    capacidad: d.capacidad ?? null,
    area_m2: d.area_m2 ?? null,
    piso: (d.piso as never) ?? null,
    agua: d.agua,
    // Los días de rotación solo cuentan en potreros; en un corral quedan los valores de la guía.
    dias_ocupacion_max: potrero ? (d.dias_ocupacion_max ?? DIAS_OCUPACION_DEFECTO) : DIAS_OCUPACION_DEFECTO,
    dias_descanso_min: potrero ? (d.dias_descanso_min ?? DIAS_DESCANSO_DEFECTO) : DIAS_DESCANSO_DEFECTO,
    observaciones: d.observaciones ?? null,
  };
}

export async function crearUbicacion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "corrales")) return { error: "No tienes permiso para crear instalaciones en esta finca." };
  const datos = esquemaUbicacion.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("ubicaciones").insert({ finca_id: finca.id, ...datosUbicacion(datos.data) }).select("id").single();
  if (error?.code === "23505") return { error: REPETIDA };
  if (error || !data) return { error: mensajeAmigable(error?.message ?? "") };
  revalidatePath("/hato");
  revalidatePath("/corrales");
  redirect(`/hato/corrales/${data.id}?guardado=1`);
}

export async function editarUbicacion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "corrales")) return { error: "No tienes permiso para editar instalaciones en esta finca." };
  const datos = esquemaUbicacion.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  if (!datos.data.ubicacion_id) return { error: "No encontramos esa instalación." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("ubicaciones").update(datosUbicacion(datos.data)).eq("id", datos.data.ubicacion_id).eq("finca_id", finca.id).select("id");
  if (error?.code === "23505") return { error: REPETIDA };
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos esa instalación." };
  revalidatePath("/hato");
  revalidatePath("/corrales");
  redirect(`/hato/corrales/${datos.data.ubicacion_id}?guardado=1`);
}

/** Archivar una instalación (deja de ofrecerse para mover animales; su historial se conserva) o volver a activarla. */
export async function cambiarActivaUbicacion(id: string, activa: boolean): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "corrales")) return { ok: false, error: "No tienes permiso para cambiar instalaciones en esta finca." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Instalación no válida." };
  const supabase = await crearClienteServidor();
  if (!activa) {
    const { count } = await supabase.from("movimientos_animales").select("id", { count: "exact", head: true }).eq("ubicacion_id", id).is("hasta", null);
    if ((count ?? 0) > 0) return { ok: false, error: `Todavía hay ${count} ${count === 1 ? "animal" : "animales"} ahí. Muévelos antes de archivarla.` };
  }
  const { data, error } = await supabase.from("ubicaciones").update({ activa }).eq("id", id).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa instalación." };
  revalidatePath("/hato");
  revalidatePath("/corrales");
  return { ok: true };
}

/** Elimina una instalación que nunca tuvo animales. Si ya tiene historial, se archiva (el historial no se pierde). */
export async function eliminarUbicacion(id: string): Promise<Resultado & { destino?: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar instalaciones." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Instalación no válida." };
  const supabase = await crearClienteServidor();
  const { count } = await supabase.from("movimientos_animales").select("id", { count: "exact", head: true }).eq("ubicacion_id", id);
  if ((count ?? 0) > 0) return { ok: false, error: "Esta instalación ya tiene historial de animales: no se elimina, pero puedes archivarla." };
  const { data, error } = await supabase.from("ubicaciones").delete().eq("id", id).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa instalación." };
  revalidatePath("/hato");
  revalidatePath("/corrales");
  return { ok: true, destino: DIRECCION_CORRALES };
}

// ───────────────────────── Mover animales ─────────────────────────
const esquemaMover = z.object({
  destino: opcional(z.uuid("El destino no es válido.")),
  sin_destino: z.preprocess((v) => v === "si", z.boolean()),
  fecha: z.iso.date("Indica la fecha del movimiento."),
  motivo: z.enum(MOTIVOS as [string, ...string[]], "Elige el motivo."),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
  animal: opcional(z.uuid()),
  /** El destino al que se vuelve al terminar (la instalación desde la que se llegó). */
  volver: opcional(z.uuid()),
});

/** Mueve a los animales elegidos a una instalación (o los saca de la que tienen) y deja el movimiento en el historial de cada uno. */
export async function moverAnimales(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "corrales")) return { error: "No tienes permiso para mover animales en esta finca." };
  const datos = esquemaMover.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const ids = [...new Set(form.getAll("animal_id").map(String))];
  if (ids.length === 0) return { error: "Elige al menos un animal." };
  if (ids.length > 1000) return { error: "Son demasiados animales a la vez (máximo 1000)." };
  if (!ids.every((i) => ID_UUID.safeParse(i).success)) return { error: "Hay un animal que no es válido. Elígelos de nuevo." };
  if (d.fecha > hoyBogota()) return { error: "La fecha no puede ser futura: registra lo que ya se movió." };
  if (!d.sin_destino && !d.destino) return { error: "Elige a dónde van los animales." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("mover_animales", { p_finca: finca.id, p_ubicacion: d.sin_destino ? null : (d.destino ?? null), p_animales: ids, p_fecha: d.fecha, p_motivo: d.motivo, p_observaciones: d.observaciones ?? "" });
  if (error) return { error: mensajeAmigable(error.message) };

  revalidatePath("/hato");
  revalidatePath("/corrales");
  revalidatePath("/");
  for (const a of ids.slice(0, 50)) revalidatePath(`/hato/${a}`);
  redirect(d.animal ? `/hato/${d.animal}?guardado=1#ubicacion` : d.volver ? `/hato/corrales/${d.volver}?guardado=1` : `${DIRECCION_CORRALES}&guardado=1`);
}

// ───────────────────────── Corregir un movimiento ─────────────────────────
const esquemaEditarMovimiento = z.object({
  movimiento_id: z.uuid("El movimiento no es válido."),
  ubicacion_id: z.uuid("Elige la instalación."),
  desde: z.iso.date("Indica desde cuándo estuvo ahí."),
  motivo: z.enum(MOTIVOS as [string, ...string[]], "Elige el motivo."),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
  /** Si se llegó desde una instalación, al guardar se vuelve a ella; si no, a la ficha del animal. */
  volver: opcional(z.uuid()),
});

/** Corrige un movimiento ya registrado: a qué instalación fue el animal, desde cuándo, el motivo y la nota. */
export async function editarMovimiento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "corrales")) return { error: "No tienes permiso para editar movimientos en esta finca." };
  const datos = esquemaEditarMovimiento.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (d.desde > hoyBogota()) return { error: "La fecha de entrada no puede ser futura." };
  const supabase = await crearClienteServidor();
  const { data: mov } = await supabase.from("movimientos_animales").select("animal_id").eq("id", d.movimiento_id).eq("finca_id", finca.id).maybeSingle();
  if (!mov) return { error: "No encontramos ese movimiento." };
  const { error } = await supabase.rpc("editar_movimiento", { p_id: d.movimiento_id, p_ubicacion: d.ubicacion_id, p_desde: d.desde, p_motivo: d.motivo, p_observaciones: d.observaciones ?? "" });
  if (error) return { error: mensajeAmigable(error.message) };

  revalidatePath("/hato");
  revalidatePath("/corrales");
  revalidatePath("/");
  revalidatePath(`/hato/${mov.animal_id}`);
  redirect(d.volver ? `/hato/corrales/${d.volver}?guardado=1` : `/hato/${mov.animal_id}?guardado=1#ubicacion`);
}
