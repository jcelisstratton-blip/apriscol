"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota, sumarDias } from "@/lib/fechas";
import { CONFORMACIONES, GRASAS_VISCERALES, TIPOS_PESAJE } from "@/lib/carne";
import { decimal, opcional, texto } from "@/lib/validacion";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true; destino?: string } | { ok: false; error: string };

const ID_UUID = z.uuid();
const esRepetido = (e: { code?: string; message: string }) => e.code === "23505" && /client_req/.test(e.message);
const NOMBRE_REPETIDO = "Ya tienes un lote con ese nombre. Elige otro.";
const esNombreRepetido = (e: { code?: string; message: string }) => e.code === "23505" && /lotes_ceba_nombre/.test(e.message);
const noFutura = (fecha: string) => (fecha > hoyBogota() ? "La fecha no puede ser futura: registra lo que ya pasó." : null);

async function permiso(verbo: string) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "carne")) return { ok: false, error: `No tienes permiso para ${verbo} en esta finca.` } as const;
  return { ok: true, finca, rol } as const;
}

// ───────────────────────── Lotes de ceba ─────────────────────────
const esquemaLote = z.object({
  nombre: z.string("Ponle un nombre al lote.").trim().min(1, "Ponle un nombre al lote.").max(80, "El nombre del lote es muy largo."),
  fecha_inicio: z.iso.date("Indica la fecha en que empieza el lote."),
  peso_meta_kg: decimal(z.coerce.number("El peso meta debe ser un número.").positive("El peso meta debe ser mayor que cero.").max(250, "El peso meta no puede pasar de 250 kg.")),
  cerrado_en: opcional(z.iso.date("La fecha de cierre no es válida.")),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  lote_id: opcional(z.uuid()),
});

function leerLote(form: FormData) {
  const datos = esquemaLote.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  if (d.cerrado_en && d.cerrado_en < d.fecha_inicio) return { error: "El lote no puede cerrarse antes de empezar." } as const;
  return {
    d,
    fila: {
      nombre: d.nombre,
      fecha_inicio: d.fecha_inicio,
      peso_meta_kg: d.peso_meta_kg ?? null,
      cerrado_en: d.cerrado_en ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

export async function crearLote(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("crear lotes");
  if (!p.ok) return { error: p.error };
  const l = leerLote(form);
  if ("error" in l) return { error: l.error };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("lotes_ceba").insert({ finca_id: p.finca.id, ...l.fila, cerrado_en: null, client_request_id: l.d.client_request_id ?? null }).select("id").maybeSingle();
  if (error && esNombreRepetido(error)) return { error: NOMBRE_REPETIDO };
  // Doble toque: el servidor ya guardó este envío; se busca el lote para llevar a la persona a él.
  let id = data?.id;
  if (error && esRepetido(error) && l.d.client_request_id) {
    id = (await supabase.from("lotes_ceba").select("id").eq("finca_id", p.finca.id).eq("client_request_id", l.d.client_request_id).maybeSingle()).data?.id;
  } else if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  redirect(id ? `/carne/lotes/${id}?guardado=1` : "/carne?vista=lotes&guardado=1");
}

export async function editarLote(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar lotes");
  if (!p.ok) return { error: p.error };
  const l = leerLote(form);
  if ("error" in l) return { error: l.error };
  if (!l.d.lote_id) return { error: "No encontramos ese lote." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("lotes_ceba").update(l.fila).eq("id", l.d.lote_id).eq("finca_id", p.finca.id).select("id");
  if (error && esNombreRepetido(error)) return { error: NOMBRE_REPETIDO };
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese lote." };
  revalidatePath("/carne");
  redirect(`/carne/lotes/${l.d.lote_id}?guardado=1`);
}

/** Elimina un lote y su consumo de alimento. Los animales no se tocan: solo quedan sin lote. Solo propietario o administrador. */
export async function eliminarLote(loteId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar lotes." };
  if (!ID_UUID.safeParse(loteId).success) return { ok: false, error: "Lote no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("lotes_ceba").delete().eq("id", loteId).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese lote." };
  revalidatePath("/carne");
  revalidatePath("/hato");
  return { ok: true, destino: "/carne?vista=lotes" };
}

const esquemaAsignar = z.object({
  loteId: z.uuid().nullable(),
  animales: z.array(z.uuid("Hay un animal que no es válido.")).min(1, "Elige al menos un animal.").max(500, "Son demasiados animales a la vez (máximo 500)."),
});

/** Pone animales en un lote de ceba (o los saca de él con `loteId: null`). El lote debe estar abierto. */
export async function asignarLote(entrada: z.input<typeof esquemaAsignar>): Promise<{ ok: true; cambiados: number } | { ok: false; error: string }> {
  const p = await permiso("cambiar los lotes");
  if (!p.ok) return { ok: false, error: p.error };
  const datos = esquemaAsignar.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const { loteId, animales } = datos.data;
  const supabase = await crearClienteServidor();
  if (loteId) {
    const { data: lote } = await supabase.from("lotes_ceba").select("id, cerrado_en").eq("id", loteId).eq("finca_id", p.finca.id).maybeSingle();
    if (!lote) return { ok: false, error: "No encontramos ese lote." };
    if (lote.cerrado_en) return { ok: false, error: "Ese lote ya está cerrado. Elige uno abierto o vuelve a abrirlo." };
  }
  const { data, error } = await supabase.from("animales").update({ lote_ceba_id: loteId }).eq("finca_id", p.finca.id).eq("estado", "activo").is("deleted_at", null).in("id", animales).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  revalidatePath("/hato");
  for (const a of animales.slice(0, 20)) revalidatePath(`/hato/${a}`);
  return { ok: true, cambiados: data?.length ?? 0 };
}

// ───────────────────────── Pesajes ─────────────────────────
const MAX_PESO = 250;
const pesoValido = z.coerce.number("El peso debe ser un número.").positive("El peso debe ser mayor que cero.").max(MAX_PESO, `El peso no puede pasar de ${MAX_PESO} kg.`);

const esquemaPesoRapido = z.object({
  animalId: z.uuid(),
  fecha: z.iso.date(),
  peso: z.number("El peso debe ser un número.").positive("El peso debe ser mayor que cero.").max(MAX_PESO, `El peso no puede pasar de ${MAX_PESO} kg.`),
});

/** Guarda (o corrige) el peso de un animal en un día: es el registro rápido de Hato → Ceba. Un solo peso por animal y día. */
export async function guardarPeso(entrada: z.input<typeof esquemaPesoRapido>): Promise<{ ok: true; peso: number } | { ok: false; error: string }> {
  const p = await permiso("registrar pesos");
  if (!p.ok) return { ok: false, error: p.error };
  const datos = esquemaPesoRapido.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const hoy = hoyBogota();
  if (d.fecha > hoy) return { ok: false, error: "No se puede registrar el peso de un día que todavía no llega." };
  if (d.fecha < sumarDias(hoy, -365)) return { ok: false, error: "Solo se pueden registrar pesos de hasta un año atrás." };
  const peso = Math.round(d.peso * 10) / 10;
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id").eq("id", d.animalId).eq("finca_id", p.finca.id).eq("estado", "activo").is("deleted_at", null).maybeSingle();
  if (!animal) return { ok: false, error: "No encontramos ese animal o ya salió del hato." };
  const { error } = await supabase.from("pesajes").upsert({ finca_id: p.finca.id, animal_id: d.animalId, fecha: d.fecha, peso_kg: peso }, { onConflict: "animal_id,fecha" });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  revalidatePath(`/hato/${d.animalId}`);
  return { ok: true, peso };
}

const esquemaPesaje = z.object({
  animal_id: z.uuid("Elige el animal."),
  fecha: z.iso.date("Indica la fecha."),
  peso_kg: decimal(pesoValido).pipe(z.number("Indica el peso.")),
  tipo: z.enum(TIPOS_PESAJE as [string, ...string[]], "Elige qué tipo de pesaje es."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  pesaje_id: opcional(z.uuid()),
});

function leerPesaje(form: FormData) {
  const datos = esquemaPesaje.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  return { d, fila: { fecha: d.fecha, peso_kg: Math.round(d.peso_kg * 10) / 10, tipo: d.tipo as never, observaciones: d.observaciones ?? null } } as const;
}

const REPETIDO_PESAJE = "Ese animal ya tiene un peso registrado ese día. Edita ese peso en lugar de crear otro.";

export async function crearPesaje(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar pesos");
  if (!p.ok) return { error: p.error };
  const l = leerPesaje(form);
  if ("error" in l) return { error: l.error };
  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id").eq("id", l.d.animal_id).eq("finca_id", p.finca.id).eq("estado", "activo").is("deleted_at", null).maybeSingle();
  if (!animal) return { error: "No encontramos ese animal o ya salió del hato." };
  const { error } = await supabase.from("pesajes").insert({ finca_id: p.finca.id, animal_id: l.d.animal_id, ...l.fila, client_request_id: l.d.client_request_id ?? null });
  if (error && error.code === "23505" && /pesajes_animal_fecha/.test(error.message)) return { error: REPETIDO_PESAJE };
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  revalidatePath(`/hato/${l.d.animal_id}`);
  redirect(`/hato/${l.d.animal_id}?guardado=1#crecimiento`);
}

export async function editarPesaje(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar pesos");
  if (!p.ok) return { error: p.error };
  const l = leerPesaje(form);
  if ("error" in l) return { error: l.error };
  if (!l.d.pesaje_id) return { error: "No encontramos ese peso." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("pesajes").update(l.fila).eq("id", l.d.pesaje_id).eq("finca_id", p.finca.id).eq("animal_id", l.d.animal_id).select("id");
  if (error && error.code === "23505") return { error: REPETIDO_PESAJE };
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese peso." };
  revalidatePath("/carne");
  revalidatePath(`/hato/${l.d.animal_id}`);
  redirect(`/hato/${l.d.animal_id}?guardado=1#crecimiento`);
}

export async function eliminarPesaje(pesajeId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar pesos." };
  if (!ID_UUID.safeParse(pesajeId).success) return { ok: false, error: "Peso no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("pesajes").delete().eq("id", pesajeId).eq("finca_id", finca.id).select("animal_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese peso." };
  revalidatePath("/carne");
  revalidatePath(`/hato/${data[0].animal_id}`);
  return { ok: true, destino: `/hato/${data[0].animal_id}#crecimiento` };
}

// ───────────────────────── Consumo de alimento ─────────────────────────
const esquemaConsumo = z.object({
  lote_id: z.uuid("Elige el lote."),
  fecha: z.iso.date("Indica la fecha."),
  kg_alimento: decimal(z.coerce.number("Los kilos deben ser un número.").positive("Los kilos deben ser mayores que cero.").max(100000, "Los kilos son demasiados. Revisa el dato.")).pipe(z.number("Indica cuántos kilos de alimento se dieron.")),
  alimento: texto(80, "El nombre del alimento es muy largo."),
  costo: decimal(z.coerce.number("El costo debe ser un número.").min(0, "El costo no puede ser negativo.").max(99_999_999_999_999, "El costo es demasiado alto. Revisa el dato.")),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  consumo_id: opcional(z.uuid()),
});

function leerConsumo(form: FormData) {
  const datos = esquemaConsumo.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  return {
    d,
    fila: { fecha: d.fecha, kg_alimento: Math.round(d.kg_alimento * 10) / 10, alimento: d.alimento ?? null, costo: d.costo == null ? null : Math.round(d.costo), observaciones: d.observaciones ?? null },
  } as const;
}

export async function crearConsumo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar alimento");
  if (!p.ok) return { error: p.error };
  const l = leerConsumo(form);
  if ("error" in l) return { error: l.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("consumo_lote").insert({ finca_id: p.finca.id, lote_id: l.d.lote_id, ...l.fila, client_request_id: l.d.client_request_id ?? null });
  if (error && error.code === "23503") return { error: "No encontramos ese lote." };
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  redirect(`/carne/lotes/${l.d.lote_id}?guardado=1#consumo`);
}

export async function editarConsumo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar el alimento");
  if (!p.ok) return { error: p.error };
  const l = leerConsumo(form);
  if ("error" in l) return { error: l.error };
  if (!l.d.consumo_id) return { error: "No encontramos ese registro." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("consumo_lote").update(l.fila).eq("id", l.d.consumo_id).eq("finca_id", p.finca.id).eq("lote_id", l.d.lote_id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese registro." };
  revalidatePath("/carne");
  redirect(`/carne/lotes/${l.d.lote_id}?guardado=1#consumo`);
}

export async function eliminarConsumo(consumoId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar registros de alimento." };
  if (!ID_UUID.safeParse(consumoId).success) return { ok: false, error: "Registro no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("consumo_lote").delete().eq("id", consumoId).eq("finca_id", finca.id).select("lote_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese registro." };
  revalidatePath("/carne");
  return { ok: true, destino: `/carne/lotes/${data[0].lote_id}#consumo` };
}

// ───────────────────────── Canales (rendimiento al beneficio) ─────────────────────────
const esquemaCanal = z.object({
  animal_id: z.uuid("Elige el animal."),
  fecha: z.iso.date("Indica la fecha del beneficio."),
  peso_vivo_kg: decimal(z.coerce.number("El peso en vivo debe ser un número.").positive("El peso en vivo debe ser mayor que cero.").max(250, "El peso en vivo no puede pasar de 250 kg.")),
  peso_canal_caliente_kg: decimal(z.coerce.number("El peso de la canal debe ser un número.").positive("El peso de la canal debe ser mayor que cero.").max(200, "El peso de la canal no puede pasar de 200 kg.")).pipe(z.number("Indica cuánto pesó la canal caliente.")),
  peso_canal_fria_kg: decimal(z.coerce.number("El peso de la canal fría debe ser un número.").positive("El peso de la canal fría debe ser mayor que cero.").max(200, "El peso de la canal no puede pasar de 200 kg.")),
  conformacion: opcional(z.enum(CONFORMACIONES as [string, ...string[]], "La conformación no es válida.")),
  engrasamiento: decimal(z.coerce.number("El engrasamiento debe ser un número.").int("El engrasamiento debe ser de 1 a 5.").min(1, "El engrasamiento debe ser de 1 a 5.").max(5, "El engrasamiento debe ser de 1 a 5.")),
  grasa_dorsal_mm: decimal(z.coerce.number("La grasa dorsal debe ser un número.").min(0, "La grasa dorsal no puede ser negativa.").max(40, "La grasa dorsal no puede pasar de 40 mm.")),
  grasa_visceral: opcional(z.enum(GRASAS_VISCERALES as [string, ...string[]], "La grasa visceral no es válida.")),
  planta: texto(120, "El nombre de la planta es muy largo."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  canal_id: opcional(z.uuid()),
});

function leerCanal(form: FormData) {
  const datos = esquemaCanal.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  if (d.peso_vivo_kg != null && d.peso_canal_caliente_kg > d.peso_vivo_kg) return { error: "La canal no puede pesar más que el animal vivo. Revisa los pesos." } as const;
  if (d.peso_canal_fria_kg != null && d.peso_canal_fria_kg > d.peso_canal_caliente_kg) return { error: "La canal fría no puede pesar más que la caliente: al enfriarse pierde peso." } as const;
  return {
    d,
    fila: {
      fecha: d.fecha,
      peso_vivo_kg: d.peso_vivo_kg ?? null,
      peso_canal_caliente_kg: d.peso_canal_caliente_kg,
      peso_canal_fria_kg: d.peso_canal_fria_kg ?? null,
      conformacion: (d.conformacion ?? null) as never,
      engrasamiento: d.engrasamiento ?? null,
      grasa_dorsal_mm: d.grasa_dorsal_mm ?? null,
      grasa_visceral: (d.grasa_visceral ?? null) as never,
      planta: d.planta ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

const destinoCanal = (animal: string) => `/hato/${animal}?guardado=1#salida`;

export async function crearCanal(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar canales");
  if (!p.ok) return { error: p.error };
  const l = leerCanal(form);
  if ("error" in l) return { error: l.error };
  const supabase = await crearClienteServidor();
  const { data: baja } = await supabase.from("bajas").select("tipo").eq("animal_id", l.d.animal_id).eq("finca_id", p.finca.id).maybeSingle();
  if (!baja || baja.tipo !== "sacrificio") return { error: "Solo se registra la canal de un animal que salió del hato por sacrificio." };
  const { error } = await supabase.from("canales").insert({ finca_id: p.finca.id, animal_id: l.d.animal_id, ...l.fila, client_request_id: l.d.client_request_id ?? null });
  if (error && error.code === "23505" && /canales_animal_uk/.test(error.message)) return { error: "Ese animal ya tiene su canal registrada. Edítala en lugar de crear otra." };
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  revalidatePath(`/hato/${l.d.animal_id}`);
  redirect(destinoCanal(l.d.animal_id));
}

export async function editarCanal(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar canales");
  if (!p.ok) return { error: p.error };
  const l = leerCanal(form);
  if ("error" in l) return { error: l.error };
  if (!l.d.canal_id) return { error: "No encontramos esa canal." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("canales").update(l.fila).eq("id", l.d.canal_id).eq("finca_id", p.finca.id).eq("animal_id", l.d.animal_id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos esa canal." };
  revalidatePath("/carne");
  revalidatePath(`/hato/${l.d.animal_id}`);
  redirect(destinoCanal(l.d.animal_id));
}

export async function eliminarCanal(canalId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar canales." };
  if (!ID_UUID.safeParse(canalId).success) return { ok: false, error: "Canal no válida." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("canales").delete().eq("id", canalId).eq("finca_id", finca.id).select("animal_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa canal." };
  revalidatePath("/carne");
  revalidatePath(`/hato/${data[0].animal_id}`);
  return { ok: true, destino: `/hato/${data[0].animal_id}#salida` };
}
