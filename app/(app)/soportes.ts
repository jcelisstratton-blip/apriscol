"use server";

import { randomUUID } from "node:crypto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { CARPETAS_SOPORTE, TIPOS_SOPORTE, type CarpetaSoporte } from "@/lib/soportes";
import type { ModuloApp } from "@/lib/tipos";

const MODULO: Record<CarpetaSoporte, ModuloApp> = { calidad: "leche", carne: "carne", sanidad: "sanidad" };

/**
 * El servidor arma la ruta (<finca>/<carpeta>/<uuid>.<ext>) y emite un permiso de subida de un solo uso para un documento de respaldo.
 * Además, la política de Storage solo deja escribir en la carpeta de una finca donde la persona maneja ese módulo.
 */
export async function prepararSubidaSoporte(carpeta: string, tipoMime: string): Promise<{ path: string; token: string } | { error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!(CARPETAS_SOPORTE as readonly string[]).includes(carpeta)) return { error: "No se pudo preparar la subida del documento." };
  const c = carpeta as CarpetaSoporte;
  if (!puedeEscribir(rol, MODULO[c])) return { error: "No tienes permiso para subir documentos aquí." };
  const ext = TIPOS_SOPORTE[tipoMime];
  if (!ext) return { error: "Usa un documento en PDF o una foto (JPG, PNG o WebP)." };

  const path = `${finca.id}/${c}/${randomUUID()}.${ext}`;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from("soportes").createSignedUploadUrl(path);
  if (error || !data) return { error: mensajeAmigable(error?.message ?? "No se pudo preparar la subida del documento.") };
  return { path: data.path, token: data.token };
}
