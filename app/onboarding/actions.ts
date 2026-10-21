"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto, obtenerUsuario } from "@/lib/contexto";
import { puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { BUCKET_LOGOS, TIPOS_LOGO, rutaLogoValida } from "@/lib/logo-finca";

export type EstadoFinca = { error?: string } | undefined;

const esquema = z.object({
  nombre: z.string().trim().min(2, "Ponle un nombre a tu finca.").max(120),
  departamento: z.string().trim().max(60).optional(),
  municipio: z.string().trim().max(80).optional(),
  vereda: z.string().trim().max(80).optional(),
  proposito: z.enum(["leche", "carne", "doble"]),
  especies: z.array(z.enum(["caprino", "ovino"])).min(1, "Elige al menos una especie."),
});

export async function crearFinca(_: EstadoFinca, form: FormData): Promise<EstadoFinca> {
  const user = await obtenerUsuario();
  const datos = esquema.safeParse({
    nombre: form.get("nombre"),
    departamento: form.get("departamento") || undefined,
    municipio: form.get("municipio") || undefined,
    vereda: form.get("vereda") || undefined,
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
  const { data: perfil } = await supabase.from("perfiles").select("libro_resuelto_en").eq("id", user.id).maybeSingle();
  revalidatePath("/", "layout");
  // Paso único: traer los animales que ya estén en el registro genealógico (se ofrece solo la primera vez).
  redirect(perfil?.libro_resuelto_en ? "/" : "/onboarding/animales");
}

/**
 * El servidor arma la ruta del logo (<finca>/<uuid>.<ext>) y emite un permiso de subida de un solo uso. Además, la política de Storage solo deja
 * escribir en la carpeta de una finca que la persona gestiona (propietario o administrador).
 */
export async function prepararSubidaLogo(tipoMime: string): Promise<{ path: string; token: string } | { error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { error: "Solo el propietario o un administrador puede cambiar el logo de la finca." };
  const ext = TIPOS_LOGO[tipoMime];
  if (!ext) return { error: "Usa una imagen en formato JPG, PNG o WebP." };
  const path = `${finca.id}/${randomUUID()}.${ext}`;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from(BUCKET_LOGOS).createSignedUploadUrl(path);
  if (error || !data) return { error: mensajeAmigable(error?.message ?? "No se pudo preparar la subida del logo.") };
  return { path: data.path, token: data.token };
}

/** Corrige los datos de la finca activa. Solo propietario o administrador. */
export async function editarFinca(_: EstadoFinca, form: FormData): Promise<EstadoFinca> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { error: "Solo el propietario o un administrador puede cambiar los datos de la finca." };
  const datos = esquema.safeParse({
    nombre: form.get("nombre"),
    departamento: form.get("departamento") || undefined,
    municipio: form.get("municipio") || undefined,
    vereda: form.get("vereda") || undefined,
    proposito: form.get("proposito"),
    especies: form.getAll("especies"),
  });
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;

  // Logo (opcional): vacío = sin logo. Una ruta nueva debe ser un archivo de ESTA finca (la base también lo exige).
  const logoNuevo = String(form.get("logo_path") ?? "").trim() || null;
  if (logoNuevo && !rutaLogoValida(logoNuevo, finca.id)) return { error: "El logo no es válido. Súbelo de nuevo." };

  // No se puede quitar una especie de la que todavía hay animales registrados (activos o dados de baja).
  const supabase = await crearClienteServidor();
  for (const quitada of finca.especies.filter((e) => !d.especies.includes(e))) {
    const { count } = await supabase
      .from("animales")
      .select("id", { count: "exact", head: true })
      .eq("finca_id", finca.id)
      .eq("especie", quitada)
      .is("deleted_at", null);
    if ((count ?? 0) > 0) {
      const nombre = quitada === "caprino" ? "cabras" : "ovejas";
      return { error: `No puedes quitar las ${nombre}: tienes ${count} animales de esa especie registrados.` };
    }
  }

  const { error } = await supabase
    .from("fincas")
    .update({ nombre: d.nombre, departamento: d.departamento ?? null, municipio: d.municipio ?? null, vereda: d.vereda ?? null, proposito: d.proposito, especies: d.especies, logo_path: logoNuevo })
    .eq("id", finca.id);
  if (error) return { error: mensajeAmigable(error.message) };

  // El logo anterior ya no se usa: se borra su archivo (si falla, queda un archivo suelto sin efecto).
  if (finca.logo_path && finca.logo_path !== logoNuevo) await supabase.storage.from(BUCKET_LOGOS).remove([finca.logo_path]);

  revalidatePath("/", "layout");
  redirect("/mas?guardado=1");
}

export async function cambiarFinca(fincaId: string): Promise<{ error?: string }> {
  const user = await obtenerUsuario();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("perfiles").update({ finca_activa_id: fincaId }).eq("id", user.id);
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/", "layout");
  return {};
}
