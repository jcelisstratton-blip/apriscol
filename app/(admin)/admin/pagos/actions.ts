"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esAdminPlataforma } from "@/lib/contexto";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import type { FilaAuditoriaAdmin, FilaPagoAdmin } from "@/lib/tipos";

export type ResultadoPago = { ok: true; detalle: string } | { ok: false; error: string };

/** Un tramo de la lista de pagos, con la búsqueda por finca o correo hecha en la base. */
export async function cargarPagos(buscar: string, desde: number, cantidad: number): Promise<{ filas: FilaPagoAdmin[]; total: number }> {
  if (!(await esAdminPlataforma())) throw new Error("No tienes permiso para esto.");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_listar_pagos", { p_buscar: buscar.slice(0, 80), p_desde: desde, p_cantidad: cantidad });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaPagoAdmin[];
  return { filas, total: Number(filas[0]?.total ?? 0) };
}

/** Un tramo de la bitácora del superadmin. */
export async function cargarAuditoria(desde: number, cantidad: number): Promise<{ filas: FilaAuditoriaAdmin[]; total: number }> {
  if (!(await esAdminPlataforma())) throw new Error("No tienes permiso para esto.");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("admin_listar_auditoria", { p_desde: desde, p_cantidad: cantidad });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaAuditoriaAdmin[];
  return { filas, total: Number(filas[0]?.total ?? 0) };
}

/** Anula el último pago de una finca y la deja como estaba antes. El motivo es obligatorio y queda en la bitácora. */
export async function anularPago(pagoId: string, motivo: string): Promise<ResultadoPago> {
  if (!(await esAdminPlataforma())) return { ok: false, error: "No tienes permiso para esto." };
  if (motivo.trim().length < 5) return { ok: false, error: "Escribe el motivo de la anulación (al menos 5 letras)." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("admin_anular_pago", { p_pago: pagoId, p_motivo: motivo.trim().slice(0, 300) });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/planes");
  revalidatePath("/admin/auditoria");
  return { ok: true, detalle: "Pago anulado: la finca volvió a como estaba antes." };
}
