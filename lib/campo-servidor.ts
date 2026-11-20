import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, PlanId, RolFinca } from "@/lib/tipos";
import { leerTodo } from "@/lib/consultas";
import { leerCeba } from "@/lib/ceba-servidor";
import { hembrasEnLeche } from "@/lib/ordeno-servidor";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { puedeEscribir } from "@/lib/permisos";
import { litros as fmtLitros } from "@/lib/fechas";
import { errorFecha, errorLitros, errorPeso, redondearPeso, type AnimalPesar, type EnvioCampo, type HembraCampo, type ReferenciaCampo, type RespuestaEnvio } from "@/lib/campo";

/**
 * El servidor del registro sin señal: la copia mínima de la finca para el celular y el guardado de lo que llega desde la bandeja del celular.
 * Lo usan `app/api/campo/referencia` y `app/api/campo/enviar`; corre con la sesión de la persona (RLS) y se prueba con una base falsa
 * (`tests/campo.test.mjs`). Regla de oro: un envío del celular **nunca reemplaza** un dato que ya estaba guardado por otra solicitud.
 */

type Cliente = SupabaseClient<Database>;

/** Qué puede registrar sin señal cada rol en su plan: los mismos módulos que la captura de leche y la pesada con señal. */
export function permisosCampo(rol: RolFinca, plan: PlanId): { leche: boolean; pesos: boolean } {
  return { leche: puedeEscribir(rol, "leche", plan), pesos: puedeEscribir(rol, "carne", plan) };
}

/** La copia de la finca que se guarda en el celular: solo lo indispensable para capturar (aretes, nombres, turnos, retiro y último peso). */
export async function leerReferenciaCampo(
  supabase: Cliente,
  ctx: { usuarioId: string; finca: { id: string; nombre: string; plan: PlanId }; rol: RolFinca },
  hoy: string,
  ahora = new Date(),
): Promise<ReferenciaCampo> {
  const puede = permisosCampo(ctx.rol, ctx.finca.plan);
  const fincaId = ctx.finca.id;
  const [leche, ceba, todos] = await Promise.all([
    puede.leche ? hembrasEnLeche(supabase, fincaId) : null,
    puede.pesos ? leerCeba(supabase, fincaId, hoy) : null,
    puede.pesos
      ? leerTodo((d, h) => supabase.from("animales").select("id, numero_arete, nombre").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null).order("id").range(d, h))
      : null,
  ]);

  const ordeno: HembraCampo[] = (leche?.animales ?? []).map((a) => ({
    id: a.id,
    arete: a.numero_arete,
    nombre: a.nombre,
    turnos: a.turnos_ordeno,
    retiroLecheHasta: leche?.retiros[a.id] ?? null,
  }));

  const pesar: AnimalPesar[] = (todos?.data ?? [])
    .map((a) => {
      const c = ceba?.datos.get(a.id);
      return {
        id: a.id,
        arete: a.numero_arete,
        nombre: a.nombre,
        ceba: ceba?.ids.has(a.id) ?? false,
        ultimoPeso: c?.peso_ultimo != null ? Number(c.peso_ultimo) : null,
        ultimaFecha: c?.fecha_ultimo ?? null,
      };
    })
    .sort((a, b) => Number(b.ceba) - Number(a.ceba) || a.arete.localeCompare(b.arete, "es", { numeric: true }));

  return { version: 1, generadaEn: ahora.toISOString(), hoy, usuario: { id: ctx.usuarioId }, finca: { id: fincaId, nombre: ctx.finca.nombre }, puede, ordeno, pesar };
}

// ───────────── Lo que llega del celular ─────────────

const uuid = z.uuid();
const fecha = z.iso.date();
export const esquemaEnvio = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("ordeno"), id: uuid, fincaId: uuid, animalId: uuid, fecha, jornada: z.enum(["manana", "tarde", "noche"]), litros: z.number(), descartar: z.boolean() }),
  z.object({ tipo: z.literal("peso"), id: uuid, fincaId: uuid, animalId: uuid, fecha, peso: z.number() }),
]);

const rechazo = (error: string): RespuestaEnvio => ({ ok: false, codigo: "rechazado", error });
const conflicto = (error: string): RespuestaEnvio => ({ ok: false, codigo: "conflicto", error });
const esDuplicado = (e: { code?: string } | null) => e?.code === "23505";

/** El animal sigue en el hato de esa finca (un envío tardío puede llegar después de una venta o una muerte). */
async function animalActivo(supabase: Cliente, fincaId: string, animalId: string) {
  const { data } = await supabase.from("animales").select("id, numero_arete, sexo, estado").eq("finca_id", fincaId).eq("id", animalId).is("deleted_at", null).maybeSingle();
  return data;
}

/** Guarda un ordeño hecho sin señal. Reenviar el mismo registro no duplica; si ya había otro dato en esa jornada, no lo toca. */
export async function guardarOrdenoCampo(supabase: Cliente, e: Extract<EnvioCampo, { tipo: "ordeno" }>, hoy: string): Promise<RespuestaEnvio> {
  const problema = errorFecha(e.fecha, hoy) ?? errorLitros(e.litros);
  if (problema) return rechazo(problema);
  const animal = await animalActivo(supabase, e.fincaId, e.animalId);
  if (!animal) return rechazo("Ese animal ya no está en esta finca.");
  if (animal.estado !== "activo") return rechazo(`${animal.numero_arete} ya salió del hato: no se guardó su ordeño.`);
  if (animal.sexo !== "hembra") return rechazo(`${animal.numero_arete} es macho: el ordeño se registra sobre una hembra.`);

  const existente = () =>
    supabase.from("ordenos").select("litros, client_request_id").eq("finca_id", e.fincaId).eq("animal_id", e.animalId).eq("fecha", e.fecha).eq("jornada", e.jornada).maybeSingle();
  const decidir = (fila: { litros: number; client_request_id: string | null }): RespuestaEnvio =>
    fila.client_request_id === e.id
      ? { ok: true, estado: "ya_estaba" }
      : conflicto(`Ya había ${fmtLitros(Number(fila.litros))} L de ${animal.numero_arete} en esa jornada, registrados por otra persona o desde otro aparato. No se cambió: si el tuyo es el correcto, corrígelo en la captura de leche.`);

  const previo = await existente();
  if (previo.data) return decidir(previo.data);

  const { error } = await supabase.from("ordenos").insert({
    finca_id: e.fincaId,
    animal_id: e.animalId,
    fecha: e.fecha,
    jornada: e.jornada,
    litros: e.litros,
    descartada: e.descartar,
    motivo_descarte: e.descartar ? "otro" : null,
    client_request_id: e.id,
  });
  if (!error) return { ok: true, estado: "guardado" };
  if (esDuplicado(error)) {
    // Dos envíos a la vez (dos pestañas, un reintento): el que llegó primero ya quedó; se decide contra él.
    const ahora = await existente();
    if (ahora.data) return decidir(ahora.data);
    return { ok: true, estado: "ya_estaba" };
  }
  return rechazo(mensajeAmigable(error.message));
}

/** Guarda un peso hecho sin señal. Un peso por animal y día: si ya había otro ese día, no lo toca. */
export async function guardarPesoCampo(supabase: Cliente, e: Extract<EnvioCampo, { tipo: "peso" }>, hoy: string): Promise<RespuestaEnvio> {
  const problema = errorFecha(e.fecha, hoy) ?? errorPeso(e.peso);
  if (problema) return rechazo(problema);
  const animal = await animalActivo(supabase, e.fincaId, e.animalId);
  if (!animal) return rechazo("Ese animal ya no está en esta finca.");
  if (animal.estado !== "activo") return rechazo(`${animal.numero_arete} ya salió del hato: no se guardó su peso.`);

  const existente = () => supabase.from("pesajes").select("peso_kg, client_request_id").eq("finca_id", e.fincaId).eq("animal_id", e.animalId).eq("fecha", e.fecha).maybeSingle();
  const decidir = (fila: { peso_kg: number; client_request_id: string | null }): RespuestaEnvio =>
    fila.client_request_id === e.id
      ? { ok: true, estado: "ya_estaba" }
      : conflicto(`${animal.numero_arete} ya tenía un peso ese día (${Number(fila.peso_kg).toLocaleString("es-CO")} kg). No se cambió: si el tuyo es el correcto, corrígelo en su ficha.`);

  const previo = await existente();
  if (previo.data) return decidir(previo.data);

  const { error } = await supabase.from("pesajes").insert({ finca_id: e.fincaId, animal_id: e.animalId, fecha: e.fecha, peso_kg: redondearPeso(e.peso), client_request_id: e.id });
  if (!error) return { ok: true, estado: "guardado" };
  if (esDuplicado(error)) {
    const ahora = await existente();
    if (ahora.data) return decidir(ahora.data);
    return { ok: true, estado: "ya_estaba" };
  }
  return rechazo(mensajeAmigable(error.message));
}
