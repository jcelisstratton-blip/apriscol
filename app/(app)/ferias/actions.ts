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

export type EstadoForm = { error?: string } | undefined;

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacio, s.optional());
const numero = (s: z.ZodType<number>) => z.preprocess((v) => (typeof v === "string" ? v.replace(",", ".") : v), opcional(s));

// ───────────────────────── Feria ─────────────────────────
const esquemaFeria = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre de la feria.").max(160),
  nivel: z.enum(["local", "regional", "nacional", "internacional"]),
  departamento: opcional(z.string().trim().max(60)),
  municipio: opcional(z.string().trim().max(80)),
  fecha_inicio: z.iso.date("Indica desde qué día es la feria."),
  fecha_fin: opcional(z.iso.date("La fecha final no es válida.")),
  organizador: opcional(z.string().trim().max(160)),
});

export async function crearFeria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) return { error: "No tienes permiso para registrar ferias en esta finca." };
  const datos = esquemaFeria.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  if (datos.data.fecha_fin && datos.data.fecha_fin < datos.data.fecha_inicio) {
    return { error: "La feria no puede terminar antes de empezar." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("ferias").insert({ ...datos.data, finca_id: finca.id }).select("id").single();
  if (error || !data) {
    const duplicada = error?.code === "23505";
    return { error: duplicada ? "Ya registraste esa feria con la misma fecha de inicio." : mensajeAmigable(error?.message ?? "") };
  }
  revalidatePath("/ferias");
  const volver = form.get("animal");
  redirect(typeof volver === "string" && /^[0-9a-f-]{36}$/i.test(volver)
    ? `/ferias/participacion/nueva?feria=${data.id}&animal=${volver}`
    : `/ferias/${data.id}`);
}

const esquemaEdicionFeria = esquemaFeria.extend({ feria_id: z.uuid() });

/** Corrige los datos de una feria. Lo que se deja vacío queda vacío. */
export async function editarFeria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "ferias")) return { error: "No tienes permiso para editar ferias en esta finca." };
  const datos = esquemaEdicionFeria.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  if (d.fecha_fin && d.fecha_fin < d.fecha_inicio) return { error: "La feria no puede terminar antes de empezar." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("ferias")
    .update({
      nombre: d.nombre,
      nivel: d.nivel,
      departamento: d.departamento ?? null,
      municipio: d.municipio ?? null,
      fecha_inicio: d.fecha_inicio,
      fecha_fin: d.fecha_fin ?? null,
      organizador: d.organizador ?? null,
    })
    .eq("id", d.feria_id)
    .eq("finca_id", finca.id)
    .select("id");
  if (error) return { error: error.code === "23505" ? "Ya registraste una feria con ese nombre y esa fecha de inicio." : mensajeAmigable(error.message) };
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
  feria_id: z.uuid("Elige la feria."),
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
  const { error } = await supabase.from("participaciones_feria").insert({
    finca_id: finca.id,
    feria_id: d.feria_id,
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
  revalidatePath(`/ferias/${d.feria_id}`);
  revalidatePath(`/hato/${d.animal_id}`);
  redirect(`/ferias/${d.feria_id}`);
}
