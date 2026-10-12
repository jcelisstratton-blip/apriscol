"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { RESULTADOS, TIPOS_FOTO } from "@/lib/ferias";
import { leerNumero } from "@/lib/numeros";

export type EstadoForm = { error?: string } | undefined;

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacio, s.optional());
/** Un número escrito a la colombiana: «25.000» son veinticinco mil, no veinticinco. */
const numero = (s: z.ZodType<number>) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), opcional(s));

// ───────────────────────── Feria ─────────────────────────
const esquemaFeria = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre de la feria.").max(160),
  nivel: z.enum(["local", "regional", "nacional", "internacional"]),
  departamento: opcional(z.string().trim().max(60)),
  municipio: opcional(z.string().trim().max(80)),
  fecha_inicio: z.iso.date("Indica la fecha de la feria."),
});

const esquemaEdicionFeria = esquemaFeria.extend({ feria_id: z.uuid() });

/** Corrige los datos de una feria. Lo que se deja vacío queda vacío. */
export async function editarFeria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) return { error: "No tienes permiso para editar ferias en esta finca." };
  const datos = esquemaEdicionFeria.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("ferias")
    .update({
      nombre: d.nombre,
      nivel: d.nivel,
      departamento: d.departamento ?? null,
      municipio: d.municipio ?? null,
      fecha_inicio: d.fecha_inicio,
    })
    .eq("id", d.feria_id)
    .eq("finca_id", finca.id)
    .select("id");
  if (error) return { error: error.code === "23505" ? "Ya registraste una feria con ese nombre y esa fecha." : mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos esa feria." };

  revalidatePath("/ferias");
  revalidatePath(`/ferias/${d.feria_id}`);
  redirect(`/ferias/${d.feria_id}?guardado=1`);
}

/** Elimina una feria con todas sus participaciones y las fotos de sus premios. No se puede deshacer. */
export async function eliminarFeria(feriaId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) return { ok: false, error: "No tienes permiso para eliminar ferias en esta finca." };
  if (!z.uuid().safeParse(feriaId).success) return { ok: false, error: "Feria no válida." };

  const supabase = await crearClienteServidor();
  const { data: fotos } = await supabase.from("participaciones_feria").select("foto_path").eq("feria_id", feriaId).eq("finca_id", finca.id);
  const { data, error } = await supabase.from("ferias").delete().eq("id", feriaId).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa feria." };

  // Las participaciones se borran en cascada; sus fotos se limpian de Storage (si falla, solo queda un archivo suelto).
  const rutas = (fotos ?? []).map((f) => f.foto_path).filter((r): r is string => Boolean(r));
  if (rutas.length > 0) await supabase.storage.from("premios").remove(rutas);

  revalidatePath("/ferias");
  revalidatePath("/hato", "layout");
  return { ok: true };
}

// ───────────────────────── Foto del premio ─────────────────────────
/**
 * El servidor arma la ruta (<finca>/<uuid>.<ext>) y emite un permiso de subida de un solo uso.
 * Además, la política de Storage solo deja escribir en la carpeta de una finca donde la persona puede gestionar ferias.
 */
export async function prepararSubidaFoto(tipoMime: string): Promise<{ path: string; token: string } | { error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) return { error: "No tienes permiso para subir fotos en esta finca." };
  const ext = TIPOS_FOTO[tipoMime];
  if (!ext) return { error: "Usa una foto en formato JPG, PNG o WebP." };

  const path = `${finca.id}/${randomUUID()}.${ext}`;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from("premios").createSignedUploadUrl(path);
  if (error || !data) return { error: mensajeAmigable(error?.message ?? "No se pudo preparar la subida de la foto.") };
  return { path: data.path, token: data.token };
}

// ───────────────────────── Participación y premio ─────────────────────────
const esquemaParticipacion = z.object({
  feria_id: z.union([z.uuid("Elige la feria."), z.literal("nueva")], "Elige la feria."),
  animal_id: z.uuid("Elige el animal."),
  categoria: z.string().trim().min(1, "Escribe la categoría en la que concursó.").max(160),
  resultado: z.enum(RESULTADOS as [string, ...string[]]),
  puesto: numero(z.coerce.number().int("El puesto debe ser un número entero.").min(1).max(99)),
  puntaje: numero(z.coerce.number().min(0, "El puntaje no puede ser negativo.").max(9999)),
  premio_descripcion: opcional(z.string().trim().max(200)),
  premio_en_dinero: numero(z.coerce.number().min(0, "El premio en dinero no puede ser negativo.").max(9_999_999_999)),
  observaciones: opcional(z.string().trim().max(1000)),
  foto_path: opcional(z.string().max(200)),
  client_request_id: opcional(z.uuid()),
});

export async function crearParticipacion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) return { error: "No tienes permiso para registrar premios en esta finca." };
  const datos = esquemaParticipacion.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;

  // La ruta de la foto debe ser de la carpeta de esta finca (la base también lo exige).
  if (d.foto_path && !new RegExp(`^${finca.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(d.foto_path)) {
    return { error: "La foto no es válida. Súbela de nuevo." };
  }

  const supabase = await crearClienteServidor();

  // Se puede registrar la feria desde el mismo premio: si ya existe (mismo nombre y fecha) se reutiliza.
  let feriaId = d.feria_id;
  if (feriaId === "nueva") {
    const nueva = esquemaFeria.safeParse(Object.fromEntries(form));
    if (!nueva.success) return { error: nueva.error.issues[0]?.message };
    const { data: creada, error: errFeria } = await supabase.from("ferias").insert({ ...nueva.data, finca_id: finca.id }).select("id").single();
    if (creada) {
      feriaId = creada.id;
    } else if (errFeria?.code === "23505") {
      const { data: delDia } = await supabase.from("ferias").select("id, nombre").eq("finca_id", finca.id).eq("fecha_inicio", nueva.data.fecha_inicio);
      const igual = (delDia ?? []).find((f) => f.nombre.trim().toLowerCase() === nueva.data.nombre.toLowerCase());
      if (!igual) return { error: "Ya registraste esa feria con esa fecha." };
      feriaId = igual.id;
    } else {
      return { error: mensajeAmigable(errFeria?.message ?? "") };
    }
  }

  const { error } = await supabase.from("participaciones_feria").insert({
    finca_id: finca.id,
    feria_id: feriaId,
    animal_id: d.animal_id,
    categoria: d.categoria,
    resultado: d.resultado as (typeof RESULTADOS)[number],
    puesto: d.puesto ?? null,
    puntaje: d.puntaje ?? null,
    premio_descripcion: d.premio_descripcion ?? null,
    premio_en_dinero: d.premio_en_dinero ?? null,
    observaciones: d.observaciones ?? null,
    foto_path: d.foto_path ?? null,
    client_request_id: d.client_request_id ?? null,
  });

  if (error) {
    const repetida = error.code === "23505" && !/client_req/.test(error.message);
    if (error.code === "23505" && /client_req/.test(error.message)) {
      // Doble toque: ya se guardó.
    } else {
      return { error: repetida ? "Ese animal ya tiene registrada esa categoría en esta feria." : mensajeAmigable(error.message) };
    }
  }

  revalidatePath("/ferias");
  revalidatePath(`/ferias/${feriaId}`);
  revalidatePath(`/hato/${d.animal_id}`);
  redirect(`/hato/${d.animal_id}?guardado=1`);
}

// Al corregir un premio la feria debe ser una ya registrada (la feria nueva solo se crea al registrar el premio).
const esquemaEdicionParticipacion = esquemaParticipacion
  .omit({ client_request_id: true, feria_id: true })
  .extend({ participacion_id: z.uuid(), feria_id: z.uuid("Elige la feria.") });

/** Corrige un premio: feria, animal, categoría, resultado, premio y foto. Si cambia o se quita la foto, el archivo viejo se borra. */
export async function editarParticipacion(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) return { error: "No tienes permiso para editar premios en esta finca." };
  const datos = esquemaEdicionParticipacion.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;

  if (d.foto_path && !new RegExp(`^${finca.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(d.foto_path)) {
    return { error: "La foto no es válida. Súbela de nuevo." };
  }

  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase
    .from("participaciones_feria")
    .select("id, feria_id, animal_id, foto_path")
    .eq("id", d.participacion_id)
    .eq("finca_id", finca.id)
    .maybeSingle();
  if (!actual) return { error: "No encontramos ese premio." };

  const fotoNueva = d.foto_path ?? null;

  const { error } = await supabase
    .from("participaciones_feria")
    .update({
      feria_id: d.feria_id,
      animal_id: d.animal_id,
      categoria: d.categoria,
      resultado: d.resultado as (typeof RESULTADOS)[number],
      puesto: d.puesto ?? null,
      puntaje: d.puntaje ?? null,
      premio_descripcion: d.premio_descripcion ?? null,
      premio_en_dinero: d.premio_en_dinero ?? null,
      observaciones: d.observaciones ?? null,
      foto_path: fotoNueva,
    })
    .eq("id", d.participacion_id)
    .eq("finca_id", finca.id);
  if (error) {
    return { error: error.code === "23505" ? "Ese animal ya tiene registrada esa categoría en esta feria." : mensajeAmigable(error.message) };
  }

  // La foto anterior ya no se usa: se borra de Storage (si falla, solo queda un archivo suelto).
  if (actual.foto_path && actual.foto_path !== fotoNueva) await supabase.storage.from("premios").remove([actual.foto_path]);

  revalidatePath("/ferias");
  revalidatePath(`/ferias/${actual.feria_id}`);
  revalidatePath(`/ferias/${d.feria_id}`);
  revalidatePath(`/hato/${actual.animal_id}`);
  revalidatePath(`/hato/${d.animal_id}`);
  redirect(`/hato/${d.animal_id}?guardado=1`);
}

/** Elimina un premio y su foto. No se puede deshacer. Devuelve el animal al que pertenecía. */
export async function eliminarParticipacion(participacionId: string): Promise<{ ok: true; animalId: string } | { ok: false; error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) return { ok: false, error: "No tienes permiso para eliminar premios en esta finca." };
  if (!z.uuid().safeParse(participacionId).success) return { ok: false, error: "Premio no válido." };

  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase
    .from("participaciones_feria")
    .select("feria_id, animal_id, foto_path")
    .eq("id", participacionId)
    .eq("finca_id", finca.id)
    .maybeSingle();
  if (!actual) return { ok: false, error: "No encontramos ese premio." };

  const { error } = await supabase.from("participaciones_feria").delete().eq("id", participacionId).eq("finca_id", finca.id);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (actual.foto_path) await supabase.storage.from("premios").remove([actual.foto_path]);

  revalidatePath("/ferias");
  revalidatePath(`/ferias/${actual.feria_id}`);
  revalidatePath(`/hato/${actual.animal_id}`);
  return { ok: true, animalId: actual.animal_id };
}
