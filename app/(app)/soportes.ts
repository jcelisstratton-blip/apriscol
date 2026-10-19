"use server";

import { randomUUID } from "node:crypto";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir } from "@/lib/permisos";
import { nombrePlan, servicioEnPlan, SERVICIOS_PLAN, type ServicioPlan } from "@/lib/planes";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { CARPETAS_SOPORTE, TIPOS_SOPORTE, type CarpetaSoporte } from "@/lib/soportes";
import type { ModuloApp } from "@/lib/tipos";

/** Carpetas cuyo respaldo es un servicio de un plan superior. */
const SERVICIO: Partial<Record<CarpetaSoporte, ServicioPlan>> = { carne: "calidad", gastos: "soportes" };
const MODULO: Record<CarpetaSoporte, ModuloApp> = { calidad: "leche", carne: "carne", sanidad: "sanidad", gastos: "contabilidad", nomina: "contabilidad" };

/**
 * El servidor arma la ruta (<finca>/<carpeta>/<uuid>.<ext>) y emite un permiso de subida de un solo uso para un documento de respaldo.
 * Además, la política de Storage solo deja escribir en la carpeta de una finca donde la persona maneja ese módulo.
 */
export async function prepararSubidaSoporte(carpeta: string, tipoMime: string): Promise<{ path: string; token: string } | { error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!(CARPETAS_SOPORTE as readonly string[]).includes(carpeta)) return { error: "No se pudo preparar la subida del documento." };
  const c = carpeta as CarpetaSoporte;
  if (!puedeEscribir(rol, MODULO[c], finca.plan)) return { error: "No tienes permiso para subir documentos aquí." };
  const servicio = SERVICIO[c];
  if (servicio && !servicioEnPlan(finca.plan, servicio)) return { error: `Subir documentos de respaldo está en el plan ${nombrePlan(SERVICIOS_PLAN[servicio].desde)}. Mejora tu plan desde «Más».` };
  const ext = TIPOS_SOPORTE[tipoMime];
  if (!ext) return { error: "Usa un documento en PDF o una foto (JPG, PNG o WebP)." };

  const path = `${finca.id}/${c}/${randomUUID()}.${ext}`;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from("soportes").createSignedUploadUrl(path);
  if (error || !data) return { error: mensajeAmigable(error?.message ?? "No se pudo preparar la subida del documento.") };
  return { path: data.path, token: data.token };
}
