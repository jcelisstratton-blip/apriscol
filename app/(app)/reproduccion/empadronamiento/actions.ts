"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota, sumarDias } from "@/lib/fechas";
import { aptitud, DURACION_MAX_DIAS, VALORES_CC } from "@/lib/empadronamiento";
import { decimal, opcional, texto } from "@/lib/validacion";
import { porcentaje } from "@/lib/endogamia";
import type { Empadronamiento } from "@/lib/tipos";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true; destino?: string } | { ok: false; error: string };
type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

const ID_UUID = z.uuid();
const esRepetido = (e: { code?: string; message: string }) => e.code === "23505" && /client_req/.test(e.message);
const destinoLote = (id: string) => `/reproduccion/empadronamiento/${id}`;
const REPETIDO_NOMBRE = "Ya tienes un empadronamiento con ese nombre. Ponle otro (por ejemplo, con el año).";

async function permiso(verbo: string) {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "reproduccion")) return { ok: false, error: `No tienes permiso para ${verbo} en esta finca.` } as const;
  return { ok: true, finca, rol } as const;
}

/** El empadronamiento existe, es de la finca y sigue abierto (o se acepta cerrado si `abierto` es falso). */
async function cargarLote(supabase: Cliente, fincaId: string, id: string, abierto = true): Promise<{ ok: false; error: string } | { ok: true; lote: Empadronamiento }> {
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Empadronamiento no válido." };
  const { data } = await supabase.from("empadronamientos").select("*").eq("id", id).eq("finca_id", fincaId).maybeSingle();
  if (!data) return { ok: false, error: "No encontramos ese empadronamiento." };
  if (abierto && data.cerrado_en) return { ok: false, error: "Este empadronamiento ya está cerrado: es parte de la historia y no se cambia." };
  return { ok: true, lote: data };
}

/** Los machos existen, son de la finca, de la especie del lote y siguen en el hato. */
async function machosValidos(supabase: Cliente, fincaId: string, especie: string, ids: string[]) {
  const { data } = await supabase.from("animales").select("id, sexo, especie, estado").in("id", ids).eq("finca_id", fincaId).is("deleted_at", null);
  const buenos = (data ?? []).filter((m) => m.sexo === "macho" && m.especie === especie && m.estado === "activo");
  return buenos.length === new Set(ids).size ? null : "Los sementales deben ser machos activos de tu hato y de la misma especie del empadronamiento.";
}

// ───────────────────────── Crear y editar ─────────────────────────
const esquema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre al empadronamiento.").max(80, "El nombre es muy largo (máximo 80 letras)."),
  especie: z.enum(["caprino", "ovino"], "Elige la especie."),
  fecha_inicio: z.iso.date("Indica cuándo empieza la temporada."),
  duracion_dias: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number("Indica cuántos días dura la temporada.").int("Los días deben ser un número entero.").min(1, "La temporada dura al menos un día.").max(DURACION_MAX_DIAS, `La temporada no puede durar más de ${DURACION_MAX_DIAS} días.`)),
  edad_min_meses: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number("Indica la edad mínima en meses.").int("La edad debe ser un número entero de meses.").min(1, "La edad mínima es de al menos 1 mes.").max(60, "La edad mínima no puede pasar de 60 meses.")),
  peso_min_kg: decimal(z.number("El peso mínimo debe ser un número.").positive("El peso mínimo debe ser mayor que cero.").max(250, "El peso mínimo no puede pasar de 250 kg.")).pipe(z.number("Indica el peso mínimo.")),
  cc_min: z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v), z.number("Elige la condición corporal mínima.").refine((n) => (VALORES_CC as readonly number[]).includes(n), "La condición corporal va de 1 a 5, de medio en medio.")),
  hembras_por_macho: opcional(z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number("Las hembras por semental deben ser un número.").int("Las hembras por semental deben ser un número entero.").min(1, "Mínimo 1 hembra por semental.").max(100, "Máximo 100 hembras por semental."))),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  macho_id: opcional(z.uuid("El semental no es válido.")),
  client_request_id: opcional(z.uuid()),
  empadronamiento_id: opcional(z.uuid()),
});

function fechasValidas(inicio: string, duracion: number, hoy: string) {
  if (inicio < sumarDias(hoy, -366) || inicio > sumarDias(hoy, 366)) return "La fecha de inicio debe estar dentro de un año de hoy.";
  return null;
}

export async function crearEmpadronamiento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("crear empadronamientos");
  if (!p.ok) return { error: p.error };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const malaFecha = fechasValidas(d.fecha_inicio, d.duracion_dias, hoyBogota());
  if (malaFecha) return { error: malaFecha };
  if (!d.macho_id) return { error: "Elige al menos un semental para la temporada." };

  const supabase = await crearClienteServidor();
  const malMacho = await machosValidos(supabase, p.finca.id, d.especie, [d.macho_id]);
  if (malMacho) return { error: malMacho };

  const { data: lote, error } = await supabase
    .from("empadronamientos")
    .insert({
      finca_id: p.finca.id,
      especie: d.especie,
      nombre: d.nombre,
      fecha_inicio: d.fecha_inicio,
      fecha_fin_prevista: sumarDias(d.fecha_inicio, d.duracion_dias),
      edad_min_meses: d.edad_min_meses,
      peso_min_kg: Math.round(d.peso_min_kg * 10) / 10,
      cc_min: d.cc_min,
      hembras_por_macho: d.hembras_por_macho ?? null,
      observaciones: d.observaciones ?? null,
      client_request_id: d.client_request_id ?? null,
    })
    .select("id")
    .single();
  if (error?.code === "23505" && /empadronamientos_nombre/.test(error.message)) return { error: REPETIDO_NOMBRE };
  if (error && esRepetido(error)) {
    // La misma solicitud llegó dos veces: se lleva a la temporada que ya se creó.
    const { data: previo } = await supabase.from("empadronamientos").select("id").eq("finca_id", p.finca.id).eq("client_request_id", d.client_request_id ?? "").maybeSingle();
    if (previo) redirect(`${destinoLote(previo.id)}?guardado=1`);
  }
  if (error || !lote) return { error: mensajeAmigable(error?.message ?? "") };

  const { error: eMacho } = await supabase.from("empadronamiento_machos").insert({ finca_id: p.finca.id, empadronamiento_id: lote.id, macho_id: d.macho_id });
  if (eMacho) {
    await supabase.from("empadronamientos").delete().eq("id", lote.id).eq("finca_id", p.finca.id);
    return { error: mensajeAmigable(eMacho.message) };
  }
  revalidatePath("/reproduccion");
  redirect(`${destinoLote(lote.id)}?guardado=1`);
}

export async function editarEmpadronamiento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar empadronamientos");
  if (!p.ok) return { error: p.error };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (!d.empadronamiento_id) return { error: "No encontramos ese empadronamiento." };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, p.finca.id, d.empadronamiento_id, false);
  if (!c.ok) return { error: c.error };

  // Un empadronamiento cerrado solo deja corregir sus observaciones.
  const cambios = c.lote.cerrado_en
    ? { observaciones: d.observaciones ?? null }
    : {
        nombre: d.nombre,
        fecha_inicio: d.fecha_inicio,
        fecha_fin_prevista: sumarDias(d.fecha_inicio, d.duracion_dias),
        edad_min_meses: d.edad_min_meses,
        peso_min_kg: Math.round(d.peso_min_kg * 10) / 10,
        cc_min: d.cc_min,
        hembras_por_macho: d.hembras_por_macho ?? null,
        observaciones: d.observaciones ?? null,
      };
  if (!c.lote.cerrado_en) {
    const malaFecha = fechasValidas(d.fecha_inicio, d.duracion_dias, hoyBogota());
    if (malaFecha) return { error: malaFecha };
  }
  const { data, error } = await supabase.from("empadronamientos").update(cambios).eq("id", c.lote.id).eq("finca_id", p.finca.id).select("id");
  if (error?.code === "23505") return { error: REPETIDO_NOMBRE };
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese empadronamiento." };
  revalidatePath("/reproduccion");
  redirect(`${destinoLote(c.lote.id)}?guardado=1`);
}

export async function eliminarEmpadronamiento(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar empadronamientos." };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, finca.id, id, false);
  if (!c.ok) return { ok: false, error: c.error };
  if (c.lote.cerrado_en) return { ok: false, error: "Un empadronamiento cerrado queda como historia: ya generó los servicios de sus hembras y no se elimina." };
  const { error } = await supabase.from("empadronamientos").delete().eq("id", id).eq("finca_id", finca.id);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/reproduccion");
  return { ok: true, destino: "/hato?vista=empadronamiento" };
}

// ───────────────────────── Sementales ─────────────────────────
export async function agregarSemental(loteId: string, machoId: string): Promise<Resultado> {
  const p = await permiso("agregar sementales");
  if (!p.ok) return { ok: false, error: p.error };
  if (!ID_UUID.safeParse(machoId).success) return { ok: false, error: "Semental no válido." };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, p.finca.id, loteId);
  if (!c.ok) return { ok: false, error: c.error };
  const mal = await machosValidos(supabase, p.finca.id, c.lote.especie, [machoId]);
  if (mal) return { ok: false, error: mal };
  const { error } = await supabase.from("empadronamiento_machos").insert({ finca_id: p.finca.id, empadronamiento_id: loteId, macho_id: machoId });
  if (error?.code === "23505") return { ok: false, error: "Ese semental ya está en la temporada." };
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath(destinoLote(loteId));
  return { ok: true };
}

export async function quitarSemental(loteId: string, machoId: string): Promise<Resultado> {
  const p = await permiso("quitar sementales");
  if (!p.ok) return { ok: false, error: p.error };
  if (!puedeGestionar(p.rol)) return { ok: false, error: "Solo el propietario o un administrador puede quitar sementales." };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, p.finca.id, loteId);
  if (!c.ok) return { ok: false, error: c.error };
  const { count } = await supabase.from("empadronamiento_hembras").select("id", { count: "exact", head: true }).eq("empadronamiento_id", loteId).eq("macho_id", machoId);
  if ((count ?? 0) > 0) return { ok: false, error: `Ese semental tiene ${count} ${count === 1 ? "hembra asignada" : "hembras asignadas"}. Quítalas primero.` };
  const { error } = await supabase.from("empadronamiento_machos").delete().eq("empadronamiento_id", loteId).eq("macho_id", machoId).eq("finca_id", p.finca.id);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath(destinoLote(loteId));
  return { ok: true };
}

// ───────────────────────── Hembras ─────────────────────────
const esquemaAsignar = z.object({
  loteId: z.uuid(),
  machoId: z.uuid(),
  hembraIds: z.array(z.uuid()).min(1, "Elige al menos una hembra.").max(500, "Elige hasta 500 hembras a la vez."),
  /** Hembras cuya pareja llega al umbral y aun así se asignan (decisión consciente de la persona). */
  excepcionIds: z.array(z.uuid()).max(500).default([]),
});

/**
 * Asigna hembras al semental de la temporada. Vuelve a comprobar aquí lo que la pantalla ya filtró: que cumplan los criterios y que la
 * endogamia de cada pareja no llegue al umbral de la finca (salvo excepción marcada). La base lo exige otra vez.
 */
export async function asignarHembras(entrada: z.input<typeof esquemaAsignar>): Promise<{ ok: true; agregadas: number } | { ok: false; error: string }> {
  const p = await permiso("asignar hembras");
  if (!p.ok) return { ok: false, error: p.error };
  const datos = esquemaAsignar.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, p.finca.id, d.loteId);
  if (!c.ok) return { ok: false, error: c.error };
  const { data: semental } = await supabase.from("empadronamiento_machos").select("macho_id").eq("empadronamiento_id", d.loteId).eq("macho_id", d.machoId).maybeSingle();
  if (!semental) return { ok: false, error: "Ese semental no está en esta temporada." };

  const ids = [...new Set(d.hembraIds)];
  const [cand, endo] = await Promise.all([
    supabase.rpc("empadronamiento_candidatas", { p_lote: d.loteId }),
    supabase.rpc("empadronamiento_endogamia", { p_lote: d.loteId, p_macho: d.machoId, p_hembras: ids }),
  ]);
  if (cand.error) return { ok: false, error: mensajeAmigable(cand.error.message) };
  if (endo.error) return { ok: false, error: mensajeAmigable(endo.error.message) };
  const porId = new Map((cand.data ?? []).map((x) => [x.animal_id, x]));
  const noAptas = ids.filter((id) => {
    const x = porId.get(id);
    return !x || aptitud(x).clase === "no";
  });
  if (noAptas.length > 0) return { ok: false, error: `${noAptas.length === 1 ? "Una de las hembras ya no cumple" : `${noAptas.length} hembras ya no cumplen`} los criterios de la temporada. Vuelve a abrir la lista.` };

  const excepciones = new Set(d.excepcionIds);
  const bloqueadas = (endo.data ?? []).filter((e) => e.sobre_umbral && !excepciones.has(e.hembra_id));
  if (bloqueadas.length > 0) {
    const peor = Math.max(...bloqueadas.map((b) => b.f));
    return { ok: false, error: `${bloqueadas.length === 1 ? "Una pareja llega" : `${bloqueadas.length} parejas llegan`} al umbral de endogamia de tu finca (hasta ${porcentaje(peor)}). Quítalas o asígnalas como excepción.` };
  }
  if ((endo.data ?? []).length !== ids.length) return { ok: false, error: "No pudimos calcular la endogamia de alguna hembra. Vuelve a abrir la lista." };

  const filas = ids.map((id) => ({ finca_id: p.finca.id, empadronamiento_id: d.loteId, hembra_id: id, macho_id: d.machoId, endogamia: 0, excepcion: excepciones.has(id) }));
  const { error } = await supabase.from("empadronamiento_hembras").insert(filas);
  if (error?.code === "23505") return { ok: false, error: "Alguna de esas hembras ya estaba en la temporada." };
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath(destinoLote(d.loteId));
  revalidatePath("/reproduccion");
  return { ok: true, agregadas: filas.length };
}

export async function quitarHembra(loteId: string, hembraId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede quitar hembras de una temporada." };
  if (!ID_UUID.safeParse(hembraId).success) return { ok: false, error: "Hembra no válida." };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, finca.id, loteId);
  if (!c.ok) return { ok: false, error: c.error };
  const { error } = await supabase.from("empadronamiento_hembras").delete().eq("empadronamiento_id", loteId).eq("hembra_id", hembraId).eq("finca_id", finca.id);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath(destinoLote(loteId));
  revalidatePath("/reproduccion");
  return { ok: true };
}

// ───────────────────────── Cierre ─────────────────────────
const esquemaCierre = z.object({ loteId: z.uuid(), cierre: z.iso.date("Indica la fecha de cierre."), base: z.iso.date("La fecha base no es válida.").nullable().optional() });

/** Cierra la temporada: cada hembra queda servida por su semental, con su fecha prevista de parto (147 días ovinos, 150 caprinos). */
export async function cerrarEmpadronamiento(entrada: z.input<typeof esquemaCierre>): Promise<{ ok: true; servicios: number } | { ok: false; error: string }> {
  const p = await permiso("cerrar empadronamientos");
  if (!p.ok) return { ok: false, error: p.error };
  const datos = esquemaCierre.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa las fechas." };
  const d = datos.data;
  if (d.cierre > hoyBogota()) return { ok: false, error: "La fecha de cierre no puede ser futura: cierra la temporada cuando termine." };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, p.finca.id, d.loteId);
  if (!c.ok) return { ok: false, error: c.error };
  const { data, error } = await supabase.rpc("cerrar_empadronamiento", { p_lote: d.loteId, p_cierre: d.cierre, p_base: d.base ?? null });
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath(destinoLote(d.loteId));
  revalidatePath("/reproduccion");
  revalidatePath("/hato");
  return { ok: true, servicios: data?.servicios_creados ?? 0 };
}
