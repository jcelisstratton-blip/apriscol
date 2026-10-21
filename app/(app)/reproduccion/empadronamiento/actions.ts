"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { diasHasta, hoyBogota, sumarDias } from "@/lib/fechas";
import { PRESTAMO_MAX_DIAS } from "@/lib/semental-externo";
import { aptitud, DURACION_MAX_DIAS, VALORES_CC } from "@/lib/empadronamiento";
import { decimal, opcional, texto } from "@/lib/validacion";
import { porcentaje } from "@/lib/endogamia";
import type { Empadronamiento, Especie } from "@/lib/tipos";
import { esRepetido } from "@/lib/validacion";
import { permisoPara } from "@/lib/permiso-servidor";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true; destino?: string } | { ok: false; error: string };
type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

const ID_UUID = z.uuid();
const destinoLote = (id: string) => `/reproduccion/empadronamiento/${id}`;
const REPETIDO_NOMBRE = "Ya tienes un empadronamiento con ese nombre. Ponle otro (por ejemplo, con el año).";

const permiso = permisoPara("reproduccion");

/** El empadronamiento existe, es de la finca y sigue abierto (o se acepta cerrado si `abierto` es falso). */
async function cargarLote(supabase: Cliente, fincaId: string, id: string, abierto = true): Promise<{ ok: false; error: string } | { ok: true; lote: Omit<Empadronamiento, "machos" | "hembras" | "excepciones"> }> {
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
const numeroHembras = z.preprocess(
  (v) => (typeof v === "string" ? Number(v.trim().replace(",", ".")) : v),
  z.number("Indica cuántas hembras tendrá el semental.").int("Las hembras del semental deben ser un número entero.").min(1, "El semental tendrá al menos 1 hembra.").max(100, "Máximo 100 hembras por semental."),
);
/** Una lista de ids que llega del formulario como texto JSON (vacío = ninguna). */
const listaIds = (mensaje: string) =>
  z.preprocess((v) => {
    if (typeof v !== "string" || v.trim() === "") return [];
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }, z.array(z.uuid(), mensaje).max(500, "Elige hasta 500 hembras a la vez."));

/** El semental de otro hato: sus datos y las condiciones del préstamo. Los textos vacíos opcionales quedan como nulos. */
const textoOpc = (max: number, msg: string) => z.string().trim().max(max, msg).optional().transform((v) => (v ? v : null));
const esquemaExterno = z
  .object({
    chip: z.string().trim().min(1, "Escribe el chip o la identificación del semental.").max(40, "El chip es muy largo (máximo 40 caracteres)."),
    nombre: z.string().trim().min(1, "Escribe el nombre del animal.").max(80, "El nombre del animal es muy largo (máximo 80 letras)."),
    hato: z.string().trim().min(1, "Escribe el nombre del hato de donde viene.").max(120, "El nombre del hato es muy largo (máximo 120 letras)."),
    propietario: textoOpc(120, "El nombre del propietario es muy largo."),
    telefono: textoOpc(30, "El teléfono es muy largo."),
    razaId: z.number("Elige la raza del semental.").int("Elige la raza del semental.").positive("Elige la raza del semental."),
    nacimiento: z.union([z.iso.date("La fecha de nacimiento no es válida."), z.literal("")]).optional().transform((v) => (v ? v : null)),
    desde: z.iso.date("Indica cuándo llega el semental."),
    hasta: z.iso.date("Indica cuándo se devuelve el semental."),
    sanidad: textoOpc(500, "Lo de sanidad es muy largo (máximo 500 letras)."),
    condiciones: textoOpc(500, "Las condiciones son muy largas (máximo 500 letras)."),
  })
  .refine((d) => d.hasta >= d.desde, { message: "La devolución no puede ser antes de la llegada.", path: ["hasta"] })
  .refine((d) => diasHasta(d.hasta, d.desde) <= PRESTAMO_MAX_DIAS, { message: `El préstamo puede durar como máximo ${PRESTAMO_MAX_DIAS} días.`, path: ["hasta"] })
  .refine((d) => !d.nacimiento || d.nacimiento <= hoyBogota(), { message: "La fecha de nacimiento no puede ser futura.", path: ["nacimiento"] });
type DatosExternoValidos = z.output<typeof esquemaExterno>;

/** Lee el semental externo que llega como texto JSON (formulario) o como objeto (acciones). */
function leerExterno(v: unknown): { ok: true; datos: DatosExternoValidos } | { ok: false; error: string } {
  let crudo = v;
  if (typeof v === "string") {
    try {
      crudo = JSON.parse(v);
    } catch {
      return { ok: false, error: "Los datos del semental no son válidos." };
    }
  }
  const r = esquemaExterno.safeParse(crudo);
  return r.success ? { ok: true, datos: r.data } : { ok: false, error: r.error.issues[0]?.message ?? "Revisa los datos del semental." };
}

/** La raza existe y es de la especie de la temporada (la base también lo exige). */
async function razaValida(supabase: Cliente, especie: Especie, razaId: number): Promise<string | null> {
  const { data } = await supabase.from("razas").select("id").eq("id", razaId).eq("especie", especie).maybeSingle();
  return data ? null : `Esa raza no es de ${especie === "caprino" ? "las cabras" : "las ovejas"}: elige una raza de la lista.`;
}

const filaExterno = (fincaId: string, especie: Especie, d: DatosExternoValidos) => ({
  finca_id: fincaId,
  especie,
  chip: d.chip,
  nombre: d.nombre,
  hato_origen: d.hato,
  propietario: d.propietario,
  telefono: d.telefono,
  raza_id: d.razaId,
  fecha_nacimiento: d.nacimiento,
  prestamo_desde: d.desde,
  prestamo_hasta: d.hasta,
  sanidad: d.sanidad,
  condiciones: d.condiciones,
});

const esquema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre al empadronamiento.").max(80, "El nombre es muy largo (máximo 80 letras)."),
  especie: z.enum(["caprino", "ovino"], "Elige la especie."),
  fecha_inicio: z.iso.date("Indica cuándo empieza la temporada."),
  duracion_dias: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number("Indica cuántos días dura la temporada.").int("Los días deben ser un número entero.").min(1, "La temporada dura al menos un día.").max(DURACION_MAX_DIAS, `La temporada no puede durar más de ${DURACION_MAX_DIAS} días.`)),
  edad_min_meses: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number("Indica la edad mínima en meses.").int("La edad debe ser un número entero de meses.").min(1, "La edad mínima es de al menos 1 mes.").max(60, "La edad mínima no puede pasar de 60 meses.")),
  peso_min_kg: decimal(z.number("El peso mínimo debe ser un número.").positive("El peso mínimo debe ser mayor que cero.").max(250, "El peso mínimo no puede pasar de 250 kg.")).pipe(z.number("Indica el peso mínimo.")),
  cc_min: z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v), z.number("Elige la condición corporal mínima.").refine((n) => (VALORES_CC as readonly number[]).includes(n), "La condición corporal va de 1 a 5, de medio en medio.")),
  /** Cuántas hembras tendrá el semental (al crear la temporada o al agregar otro semental). */
  num_hembras: opcional(numeroHembras),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  macho_id: opcional(z.uuid("El semental no es válido.")),
  /** De dónde viene el semental: de este hato o prestado por otro (sus datos van en `semental_externo`, en JSON). */
  origen: z.enum(["propio", "externo"]).default("propio"),
  semental_externo: opcional(z.string()),
  client_request_id: opcional(z.uuid()),
  empadronamiento_id: opcional(z.uuid()),
  /** Al crear: las hembras que van con el semental (lista de ids en JSON) y las que entran como excepción de endogamia. */
  hembra_ids: listaIds("Las hembras elegidas no son válidas."),
  excepcion_ids: listaIds("Las excepciones elegidas no son válidas."),
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
  const externo = d.origen === "externo" ? leerExterno(d.semental_externo) : null;
  if (externo && !externo.ok) return { error: externo.error };
  if (!externo && !d.macho_id) return { error: "Elige al menos un semental para la temporada." };
  if (externo?.ok) {
    const malaRaza = await razaValida(await crearClienteServidor(), d.especie, externo.datos.razaId);
    if (malaRaza) return { error: malaRaza };
  }
  if (d.num_hembras == null) return { error: "Indica cuántas hembras tendrá el semental." };
  if (d.hembra_ids.length !== d.num_hembras) {
    return { error: `Elegiste ${d.hembra_ids.length} de ${d.num_hembras} hembras. ${d.hembra_ids.length < d.num_hembras ? `Faltan ${d.num_hembras - d.hembra_ids.length}: elígelas o cambia el número.` : "Cambia el número o quita hembras de la lista."}` };
  }

  const supabase = await crearClienteServidor();
  if (!externo) {
    const malMacho = await machosValidos(supabase, p.finca.id, d.especie, [d.macho_id as string]);
    if (malMacho) return { error: malMacho };
  }

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

  // Si algo falla de aquí en adelante, la temporada no se crea a medias: se borra (y el semental de otro hato que se haya guardado).
  const deshacer = async (externoId: string | null) => {
    await supabase.from("empadronamientos").delete().eq("id", lote.id).eq("finca_id", p.finca.id);
    if (externoId) await supabase.from("sementales_externos").delete().eq("id", externoId).eq("finca_id", p.finca.id);
  };
  let machoId = d.macho_id as string;
  let externoId: string | null = null;
  if (externo?.ok) {
    const { data: ext, error: eExt } = await supabase.from("sementales_externos").insert(filaExterno(p.finca.id, d.especie, externo.datos)).select("id").single();
    if (eExt || !ext) {
      await deshacer(null);
      return { error: mensajeAmigable(eExt?.message ?? "") };
    }
    machoId = externoId = ext.id;
  }
  const { error: eMacho } = await supabase.from("empadronamiento_machos").insert({ finca_id: p.finca.id, empadronamiento_id: lote.id, macho_id: machoId, num_hembras: d.num_hembras, externo: externoId != null });
  if (eMacho) {
    await deshacer(externoId);
    return { error: mensajeAmigable(eMacho.message) };
  }
  if (d.hembra_ids.length > 0) {
    const r = await insertarHembras(supabase, p.finca.id, lote.id, machoId, d.hembra_ids, d.excepcion_ids);
    if (!r.ok) {
      await deshacer(externoId);
      return { error: r.error };
    }
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
  const { data: ext } = await supabase.from("empadronamiento_machos").select("macho_id").eq("empadronamiento_id", id).eq("externo", true).eq("finca_id", finca.id);
  const { error } = await supabase.from("empadronamientos").delete().eq("id", id).eq("finca_id", finca.id);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  const externos = (ext ?? []).map((e) => e.macho_id);
  if (externos.length > 0) await supabase.from("sementales_externos").delete().in("id", externos).eq("finca_id", finca.id);
  revalidatePath("/reproduccion");
  return { ok: true, destino: "/hato?vista=empadronamiento" };
}

// ───────────────────────── Sementales ─────────────────────────
/** Suma otro semental a la temporada: uno del hato (`machoId`) o uno prestado por otro hato (`externo`), con el número de hembras que tendrá. */
export async function agregarSemental(entrada: { loteId: string; numHembras: number; machoId?: string; externo?: unknown }): Promise<Resultado> {
  const p = await permiso("agregar sementales");
  if (!p.ok) return { ok: false, error: p.error };
  const n = numeroHembras.safeParse(entrada.numHembras);
  if (!n.success) return { ok: false, error: n.error.issues[0]?.message ?? "Indica cuántas hembras tendrá el semental." };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, p.finca.id, entrada.loteId);
  if (!c.ok) return { ok: false, error: c.error };
  const loteId = entrada.loteId;

  if (entrada.externo !== undefined) {
    const e = leerExterno(entrada.externo);
    if (!e.ok) return { ok: false, error: e.error };
    const malaRaza = await razaValida(supabase, c.lote.especie, e.datos.razaId);
    if (malaRaza) return { ok: false, error: malaRaza };
    const { data: ext, error: eExt } = await supabase.from("sementales_externos").insert(filaExterno(p.finca.id, c.lote.especie, e.datos)).select("id").single();
    if (eExt || !ext) return { ok: false, error: mensajeAmigable(eExt?.message ?? "") };
    const { error } = await supabase.from("empadronamiento_machos").insert({ finca_id: p.finca.id, empadronamiento_id: loteId, macho_id: ext.id, num_hembras: n.data, externo: true });
    if (error) {
      await supabase.from("sementales_externos").delete().eq("id", ext.id).eq("finca_id", p.finca.id);
      return { ok: false, error: mensajeAmigable(error.message) };
    }
    revalidatePath(destinoLote(loteId));
    return { ok: true };
  }

  const machoId = entrada.machoId ?? "";
  if (!ID_UUID.safeParse(machoId).success) return { ok: false, error: "Semental no válido." };
  const mal = await machosValidos(supabase, p.finca.id, c.lote.especie, [machoId]);
  if (mal) return { ok: false, error: mal };
  const { error } = await supabase.from("empadronamiento_machos").insert({ finca_id: p.finca.id, empadronamiento_id: loteId, macho_id: machoId, num_hembras: n.data, externo: false });
  if (error?.code === "23505") return { ok: false, error: "Ese semental ya está en la temporada." };
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath(destinoLote(loteId));
  return { ok: true };
}

/** Corrige los datos de un semental de otro hato (chip, hato, préstamo…) mientras la temporada siga abierta. */
export async function editarSementalExterno(loteId: string, machoId: string, datos: unknown): Promise<Resultado> {
  const p = await permiso("editar sementales");
  if (!p.ok) return { ok: false, error: p.error };
  if (!ID_UUID.safeParse(machoId).success) return { ok: false, error: "Semental no válido." };
  const e = leerExterno(datos);
  if (!e.ok) return { ok: false, error: e.error };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, p.finca.id, loteId);
  if (!c.ok) return { ok: false, error: c.error };
  const { data: fila } = await supabase.from("empadronamiento_machos").select("macho_id").eq("empadronamiento_id", loteId).eq("macho_id", machoId).eq("externo", true).maybeSingle();
  if (!fila) return { ok: false, error: "Ese semental no es de otro hato o no está en esta temporada." };
  const malaRaza = await razaValida(supabase, c.lote.especie, e.datos.razaId);
  if (malaRaza) return { ok: false, error: malaRaza };
  const { finca_id: _f, especie: _e, ...cambios } = filaExterno(p.finca.id, c.lote.especie, e.datos);
  void _f;
  void _e;
  const { data, error } = await supabase.from("sementales_externos").update(cambios).eq("id", machoId).eq("finca_id", p.finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese semental." };
  revalidatePath(destinoLote(loteId));
  revalidatePath("/reproduccion");
  return { ok: true };
}

/** Corrige cuántas hembras tendrá un semental (no puede quedar por debajo de las que ya tiene: la base lo exige). */
export async function cambiarNumeroHembras(loteId: string, machoId: string, numHembras: number): Promise<Resultado> {
  const p = await permiso("cambiar el número de hembras");
  if (!p.ok) return { ok: false, error: p.error };
  if (!ID_UUID.safeParse(machoId).success) return { ok: false, error: "Semental no válido." };
  const n = numeroHembras.safeParse(numHembras);
  if (!n.success) return { ok: false, error: n.error.issues[0]?.message ?? "Indica cuántas hembras tendrá el semental." };
  const supabase = await crearClienteServidor();
  const c = await cargarLote(supabase, p.finca.id, loteId);
  if (!c.ok) return { ok: false, error: c.error };
  const { data, error } = await supabase.from("empadronamiento_machos").update({ num_hembras: n.data }).eq("empadronamiento_id", loteId).eq("macho_id", machoId).eq("finca_id", p.finca.id).select("macho_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "Ese semental no está en esta temporada." };
  revalidatePath(destinoLote(loteId));
  revalidatePath("/reproduccion");
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
  const { data: borrado, error } = await supabase.from("empadronamiento_machos").delete().eq("empadronamiento_id", loteId).eq("macho_id", machoId).eq("finca_id", p.finca.id).select("externo");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  // Un semental de otro hato no tiene más vida que su temporada: al quitarlo se borran también sus datos.
  if (borrado?.some((b) => b.externo)) await supabase.from("sementales_externos").delete().eq("id", machoId).eq("finca_id", p.finca.id);
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

type ResultadoHembras = { ok: true; agregadas: number } | { ok: false; error: string };

/**
 * Asigna hembras a un semental de la temporada (la usan «agregar hembras» y «crear temporada con sus hembras»). Vuelve a comprobar aquí lo
 * que la pantalla ya filtró: que estén libres y cumplan los criterios, y que la endogamia de cada pareja no llegue al umbral de la finca
 * (salvo excepción marcada). La base lo exige otra vez.
 */
async function insertarHembras(supabase: Cliente, fincaId: string, loteId: string, machoId: string, hembraIds: string[], excepcionIds: string[]): Promise<ResultadoHembras> {
  const ids = [...new Set(hembraIds)];
  // El número de hembras que se fijó para este semental es exacto: no se asigna ni una más.
  const { data: fila } = await supabase.from("empadronamiento_machos").select("num_hembras, externo").eq("empadronamiento_id", loteId).eq("macho_id", machoId).maybeSingle();
  const limite = fila?.num_hembras ?? null;
  const esExterno = fila?.externo === true;
  if (limite != null) {
    const { count } = await supabase.from("empadronamiento_hembras").select("id", { count: "exact", head: true }).eq("empadronamiento_id", loteId).eq("macho_id", machoId);
    const ya = count ?? 0;
    if (ya + ids.length > limite) {
      const caben = Math.max(0, limite - ya);
      return { ok: false, error: `Este semental ya tiene ${ya} de ${limite} hembras: ${caben === 0 ? "no caben más" : `solo caben ${caben} más`}. Quita hembras de la lista o sube el número de este semental.` };
    }
  }
  const [cand, endo] = await Promise.all([
    supabase.rpc("empadronamiento_candidatas", { p_lote: loteId }),
    // De un semental de otro hato no hay genealogía: no se calcula endogamia (la base la deja en 0 y sin excepción).
    esExterno ? Promise.resolve({ data: ids.map((id) => ({ hembra_id: id, f: 0, sobre_umbral: false })), error: null }) : supabase.rpc("empadronamiento_endogamia", { p_lote: loteId, p_macho: machoId, p_hembras: ids }),
  ]);
  if (cand.error) return { ok: false, error: mensajeAmigable(cand.error.message) };
  if (endo.error) return { ok: false, error: mensajeAmigable(endo.error.message) };
  const porId = new Map((cand.data ?? []).map((x) => [x.animal_id, x]));
  const noAptas = ids.filter((id) => {
    const x = porId.get(id);
    return !x || aptitud(x).clase === "no";
  });
  if (noAptas.length > 0) return { ok: false, error: `${noAptas.length === 1 ? "Una de las hembras ya no está libre o no cumple" : `${noAptas.length} hembras ya no están libres o no cumplen`} los requisitos de la temporada. Vuelve a abrir la lista.` };

  const excepciones = new Set(excepcionIds);
  const bloqueadas = (endo.data ?? []).filter((e) => e.sobre_umbral && !excepciones.has(e.hembra_id));
  if (bloqueadas.length > 0) {
    const peor = Math.max(...bloqueadas.map((b) => b.f));
    return { ok: false, error: `${bloqueadas.length === 1 ? "Una pareja llega" : `${bloqueadas.length} parejas llegan`} al umbral de endogamia de tu finca (hasta ${porcentaje(peor)}). Quítalas o asígnalas como excepción.` };
  }
  if ((endo.data ?? []).length !== ids.length) return { ok: false, error: "No pudimos calcular la endogamia de alguna hembra. Vuelve a abrir la lista." };

  const filas = ids.map((id) => ({ finca_id: fincaId, empadronamiento_id: loteId, hembra_id: id, macho_id: machoId, endogamia: 0, excepcion: excepciones.has(id) }));
  const { error } = await supabase.from("empadronamiento_hembras").insert(filas);
  if (error?.code === "23505") return { ok: false, error: "Alguna de esas hembras ya estaba en la temporada." };
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  return { ok: true, agregadas: filas.length };
}

export async function asignarHembras(entrada: z.input<typeof esquemaAsignar>): Promise<ResultadoHembras> {
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

  const r = await insertarHembras(supabase, p.finca.id, d.loteId, d.machoId, d.hembraIds, d.excepcionIds);
  if (!r.ok) return r;
  revalidatePath(destinoLote(d.loteId));
  revalidatePath("/reproduccion");
  return r;
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
