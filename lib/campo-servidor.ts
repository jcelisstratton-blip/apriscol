import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Cobertura, Database, Especie, EstadoRepro, PlanId, RolFinca, Vocacion } from "@/lib/tipos";
import { leerTodo } from "@/lib/consultas";
import { leerCeba } from "@/lib/ceba-servidor";
import { hembrasEnLeche } from "@/lib/ordeno-servidor";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { puedeEscribir } from "@/lib/permisos";
import { litros as fmtLitros } from "@/lib/fechas";
import {
  CONDICIONES, MAX_DIAS_GESTACION, errorFecha, errorLitros, errorPeso, redondearPeso,
  type AnimalHato, type AnimalPesar, type EnvioCampo, type HembraCampo, type HembraRepro, type MachoCampo, type RazaCampo, type ReferenciaCampo, type RespuestaEnvio,
} from "@/lib/campo";
import { reglasDiagnostico } from "@/lib/diagnostico-reglas";
import { esquemaAnimal, fotoValida, prepararAnimalNuevo } from "@/lib/animal-nuevo";
import { MENSAJE_SIN_SERVICIO, MENSAJE_YA_VACIA, servicioVigente } from "@/lib/servicio-vigente";
import { ETIQUETA_RESULTADO } from "@/lib/reproduccion";
import { formatoFecha } from "@/lib/fechas";

/**
 * El servidor del registro sin señal: la copia mínima de la finca para el celular y el guardado de lo que llega desde la bandeja del celular.
 * Lo usan `app/api/campo/referencia` y `app/api/campo/enviar`; corre con la sesión de la persona (RLS) y se prueba con una base falsa
 * (`tests/campo.test.mjs`). Regla de oro: un envío del celular **nunca reemplaza** un dato que ya estaba guardado por otra solicitud.
 */

type Cliente = SupabaseClient<Database>;

/** Qué puede registrar sin señal cada rol en su plan: los mismos módulos que la captura de leche y la pesada con señal. */
export function permisosCampo(rol: RolFinca, plan: PlanId): ReferenciaCampo["puede"] {
  return { leche: puedeEscribir(rol, "leche", plan), pesos: puedeEscribir(rol, "carne", plan), reproduccion: puedeEscribir(rol, "reproduccion", plan), hato: puedeEscribir(rol, "hato", plan) };
}

/** La copia de la finca que se guarda en el celular: solo lo indispensable para capturar (aretes, nombres, turnos, retiro y último peso). */
export async function leerReferenciaCampo(
  supabase: Cliente,
  ctx: { usuarioId: string; finca: { id: string; nombre: string; plan: PlanId; especies: Especie[]; proposito: Vocacion }; rol: RolFinca },
  hoy: string,
  ahora = new Date(),
): Promise<ReferenciaCampo> {
  const puede = permisosCampo(ctx.rol, ctx.finca.plan);
  const fincaId = ctx.finca.id;
  const [leche, ceba, todos, repro, razasDB, hatoDB] = await Promise.all([
    puede.leche ? hembrasEnLeche(supabase, fincaId) : null,
    puede.pesos ? leerCeba(supabase, fincaId, hoy) : null,
    puede.pesos || puede.reproduccion
      ? leerTodo((d, h) => supabase.from("animales").select("id, numero_arete, nombre, sexo, especie, fecha_nacimiento").eq("finca_id", fincaId).eq("estado", "activo").is("deleted_at", null).order("id").range(d, h))
      : null,
    puede.reproduccion
      ? leerTodo((d, h) => supabase.from("v_repro_hembras").select("animal_id, estado, ultimo_servicio").eq("finca_id", fincaId).order("animal_id").range(d, h))
      : null,
    puede.hato ? supabase.from("razas").select("id, especie, nombre, cobertura").in("especie", ctx.finca.especies).order("nombre") : null,
    // Para padre y madre (también los que ya salieron del hato) y para avisar si un arete ya existe.
    puede.hato
      ? leerTodo((d, h) => supabase.from("animales").select("id, numero_arete, nombre, sexo, especie, estado").eq("finca_id", fincaId).is("deleted_at", null).order("id").range(d, h))
      : null,
  ]);

  const ordeno: HembraCampo[] = (leche?.animales ?? []).map((a) => ({
    id: a.id,
    arete: a.numero_arete,
    nombre: a.nombre,
    turnos: a.turnos_ordeno,
    retiroLecheHasta: leche?.retiros[a.id] ?? null,
  }));

  const activos = todos?.data ?? [];
  const pesar: AnimalPesar[] = (puede.pesos ? activos : [])
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

  const porArete = (a: { arete: string }, b: { arete: string }) => a.arete.localeCompare(b.arete, "es", { numeric: true });
  const estadoDe = new Map((repro?.data ?? []).map((r) => [r.animal_id, r]));
  const hembras: HembraRepro[] = puede.reproduccion
    ? activos
        .filter((a) => a.sexo === "hembra")
        .map((a) => {
          const r = estadoDe.get(a.id);
          return { id: a.id, arete: a.numero_arete, nombre: a.nombre, especie: a.especie, nacimiento: a.fecha_nacimiento ?? null, estado: (r?.estado ?? "sin_datos") as EstadoRepro, ultimoServicio: r?.ultimo_servicio ?? null };
        })
        .sort(porArete)
    : [];
  const machos: MachoCampo[] = puede.reproduccion
    ? activos.filter((a) => a.sexo === "macho").map((a) => ({ id: a.id, arete: a.numero_arete, nombre: a.nombre, especie: a.especie })).sort(porArete)
    : [];

  const razas: RazaCampo[] = ((razasDB?.data ?? []) as { id: number; especie: Especie; nombre: string; cobertura: Cobertura | null }[]).map((r) => ({ id: r.id, especie: r.especie, nombre: r.nombre, cobertura: r.cobertura ?? null }));
  const animales: AnimalHato[] = (hatoDB?.data ?? [])
    .map((a) => ({ id: a.id, arete: a.numero_arete, nombre: a.nombre, sexo: a.sexo as AnimalHato["sexo"], especie: a.especie as Especie, activo: a.estado === "activo" }))
    .sort(porArete);

  return {
    version: 3,
    generadaEn: ahora.toISOString(),
    hoy,
    usuario: { id: ctx.usuarioId },
    finca: { id: fincaId, nombre: ctx.finca.nombre },
    puede,
    ordeno,
    pesar,
    hembras,
    machos,
    especies: puede.hato ? ctx.finca.especies : [],
    proposito: ctx.finca.proposito,
    razas,
    animales,
  };
}

// ───────────── Lo que llega del celular ─────────────

const uuid = z.uuid();
const fecha = z.iso.date();
export const esquemaEnvio = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("ordeno"), id: uuid, fincaId: uuid, animalId: uuid, fecha, jornada: z.enum(["manana", "tarde", "noche"]), litros: z.number(), descartar: z.boolean() }),
  z.object({ tipo: z.literal("peso"), id: uuid, fincaId: uuid, animalId: uuid, fecha, peso: z.number() }),
  z.object({ tipo: z.literal("monta"), id: uuid, fincaId: uuid, animalId: uuid, fecha, machoId: uuid.nullable(), machoExterno: z.string().trim().max(80).nullable() }),
  z.object({
    tipo: z.literal("diagnostico"),
    id: uuid,
    fincaId: uuid,
    animalId: uuid,
    fecha,
    metodo: z.enum(["ecografia", "palpacion"]),
    resultado: z.enum(["gestante", "vacia", "dudoso"]),
    diasGestacion: z.number().int().min(1).max(MAX_DIAS_GESTACION).nullish(),
    numFetos: z.number().int().min(1).max(4).nullish(),
    viabilidad: z.enum(["latido", "sin_actividad"]).nullish(),
    indicador: z.enum(["ausencia_celo", "retorno_celo", "llenado_uterino", "revision_manual"]).nullish(),
    condicion: z.number().refine((n) => CONDICIONES.includes(n)).nullish(),
  }),
  z.object({ tipo: z.literal("animal"), id: uuid, fincaId: uuid, animalId: uuid, fecha, campos: z.record(z.string(), z.string().max(1000)) }),
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

/** La hembra sigue en el hato, es hembra y es de esa finca. */
type HembraActiva = { numero_arete: string; especie: string; fecha_nacimiento: string | null };
async function hembraActivaCampo(supabase: Cliente, fincaId: string, id: string): Promise<{ error: string } | { hembra: HembraActiva }> {
  const { data } = await supabase.from("animales").select("id, numero_arete, sexo, estado, especie, fecha_nacimiento").eq("finca_id", fincaId).eq("id", id).is("deleted_at", null).maybeSingle();
  if (!data) return { error: "Esa hembra ya no está en esta finca." };
  if (data.sexo !== "hembra") return { error: `${data.numero_arete} es macho: esto se registra sobre una hembra.` };
  if (data.estado !== "activo") return { error: `${data.numero_arete} ya salió del hato: no se guardó.` };
  return { hembra: { numero_arete: data.numero_arete, especie: data.especie, fecha_nacimiento: data.fecha_nacimiento ?? null } };
}

/**
 * Guarda una monta natural hecha sin señal: hembra, reproductor (del hato o de otra finca) y fecha, con las mismas reglas de la ficha. Reenviar
 * no duplica; si ya había otro servicio de esa hembra ese día (otra persona u otro aparato), no se agrega otro.
 */
export async function guardarMontaCampo(supabase: Cliente, e: Extract<EnvioCampo, { tipo: "monta" }>, hoy: string): Promise<RespuestaEnvio> {
  const problema = errorFecha(e.fecha, hoy);
  if (problema) return rechazo(problema);
  const externo = e.machoExterno?.trim() || null;
  if (!e.machoId && !externo) return rechazo("Elige el reproductor que hizo la monta.");
  if (e.machoId && externo) return rechazo("Elige un reproductor de tu hato o escribe el de otra finca, no los dos.");
  const h = await hembraActivaCampo(supabase, e.fincaId, e.animalId);
  if ("error" in h) return rechazo(h.error);
  const hembra = h.hembra;
  if (hembra.fecha_nacimiento && e.fecha <= hembra.fecha_nacimiento) return rechazo("El servicio debe ser posterior al nacimiento de la hembra.");
  if (e.machoId) {
    const { data: m } = await supabase.from("animales").select("id, numero_arete, sexo, especie").eq("finca_id", e.fincaId).eq("id", e.machoId).is("deleted_at", null).maybeSingle();
    if (!m || m.sexo !== "macho") return rechazo("El reproductor debe ser un macho de tu hato.");
    if (m.especie !== hembra.especie) return rechazo("El reproductor debe ser de la misma especie que la hembra.");
  }

  const mismos = await supabase.from("servicios").select("client_request_id, tipo").eq("finca_id", e.fincaId).eq("hembra_id", e.animalId).eq("fecha", e.fecha);
  const filas = (mismos.data ?? []) as { client_request_id: string | null }[];
  if (filas.some((f) => f.client_request_id === e.id)) return { ok: true, estado: "ya_estaba" };
  if (filas.length > 0) return conflicto(`${hembra.numero_arete} ya tenía un servicio registrado ese día por otra persona o desde otro aparato. No se agregó otro: revísalo en su ficha.`);

  const { error } = await supabase.from("servicios").insert({ finca_id: e.fincaId, hembra_id: e.animalId, fecha: e.fecha, tipo: "monta_natural", macho_id: e.machoId, macho_externo: e.machoId ? null : externo, client_request_id: e.id });
  if (!error) return { ok: true, estado: "guardado" };
  if (esDuplicado(error)) return { ok: true, estado: "ya_estaba" };
  return rechazo(mensajeAmigable(error.message));
}

/**
 * Guarda un diagnóstico de gestación hecho sin señal (ecografía o palpación). El servicio al que cuelga lo elige el servidor, como en la ficha, y
 * las reglas son las mismas (`reglasDiagnostico`). Reenviar no duplica; si ya había otro diagnóstico de ese servicio ese día, no se agrega otro.
 */
export async function guardarDiagnosticoCampo(supabase: Cliente, e: Extract<EnvioCampo, { tipo: "diagnostico" }>, hoy: string): Promise<RespuestaEnvio> {
  const problema = errorFecha(e.fecha, hoy);
  if (problema) return rechazo(problema);
  // Un reenvío de algo que ya llegó: antes de cualquier otra regla (el diagnóstico pudo cambiar el estado de la hembra).
  const ya = await supabase.from("diagnosticos_gestacion").select("id").eq("finca_id", e.fincaId).eq("client_request_id", e.id).maybeSingle();
  if (ya.data) return { ok: true, estado: "ya_estaba" };
  const h = await hembraActivaCampo(supabase, e.fincaId, e.animalId);
  if ("error" in h) return rechazo(h.error);
  const v = await servicioVigente(supabase, e.fincaId, e.animalId);
  if (!v.servicio) return rechazo(`${h.hembra.numero_arete}: ${v.razon === "ya_vacia" ? MENSAJE_YA_VACIA : MENSAJE_SIN_SERVICIO}`);

  const reglas = reglasDiagnostico(
    {
      fecha: e.fecha,
      metodo: e.metodo,
      resultado: e.resultado,
      dias_gestacion: e.diasGestacion ?? null,
      num_fetos: e.numFetos ?? null,
      viabilidad_fetal: e.viabilidad ?? null,
      indicador_palpacion: e.indicador ?? null,
      condicion_corporal: e.condicion ?? null,
    },
    v.servicio.fecha,
  );
  if ("error" in reglas) return rechazo(`${h.hembra.numero_arete}: ${reglas.error}`);

  const mismos = await supabase.from("diagnosticos_gestacion").select("resultado, client_request_id").eq("finca_id", e.fincaId).eq("servicio_id", v.servicio.id).eq("fecha", e.fecha);
  const otro = ((mismos.data ?? []) as { resultado: string; client_request_id: string | null }[]).find((f) => f.client_request_id !== e.id);
  if (otro) {
    const que = ETIQUETA_RESULTADO[otro.resultado as keyof typeof ETIQUETA_RESULTADO] ?? otro.resultado;
    return conflicto(`${h.hembra.numero_arete} ya tenía un diagnóstico el ${formatoFecha(e.fecha, { day: "numeric", month: "short" })} (${que}), hecho por otra persona o desde otro aparato. No se agregó otro: revísalo en su ficha.`);
  }

  const { error } = await supabase.from("diagnosticos_gestacion").insert({
    finca_id: e.fincaId,
    hembra_id: e.animalId,
    servicio_id: v.servicio.id,
    fecha: e.fecha,
    metodo: e.metodo,
    resultado: e.resultado,
    ...reglas.propios,
    client_request_id: e.id,
  });
  if (!error) return { ok: true, estado: "guardado" };
  if (esDuplicado(error)) return { ok: true, estado: "ya_estaba" };
  return rechazo(mensajeAmigable(error.message));
}

/**
 * Crea un animal registrado sin señal con la misma función y las mismas reglas que el formulario con señal (`esquemaAnimal`, `prepararAnimalNuevo`,
 * `registrar_animal`). El identificador del registro es su `client_request_id`: reenviarlo devuelve el mismo animal. Si el arete ya existe (otra
 * persona lo creó mientras tanto), no se crea otro: pasa a «Pendientes con error».
 */
export async function guardarAnimalCampo(supabase: Cliente, e: Extract<EnvioCampo, { tipo: "animal" }>, especiesFinca: readonly Especie[]): Promise<RespuestaEnvio> {
  const datos = esquemaAnimal.safeParse({ ...e.campos, client_request_id: e.id });
  if (!datos.success) return rechazo(datos.error.issues[0]?.message ?? "Revisa los datos del animal.");
  if (!fotoValida(datos.data.foto_path, e.fincaId)) return rechazo("La foto no es válida: agrégala desde la ficha del animal.");
  const listo = prepararAnimalNuevo(datos.data, especiesFinca);
  if ("error" in listo) return rechazo(listo.error);
  const { data: id, error } = await supabase.rpc("registrar_animal", { p_finca: e.fincaId, p_animal: listo.animal, p_fecha_ultimo_parto: listo.fechaUltimoParto });
  if (!error && id) return { ok: true, estado: "guardado" };
  if (error && /animales_arete_uk|numero_arete/i.test(error.message)) {
    return conflicto(`Ya hay un animal con el arete ${datos.data.numero_arete} en la finca (lo registró otra persona o se creó desde otro aparato). No se creó otro: revisa el arete y corrígelo antes de reintentar.`);
  }
  return rechazo(mensajeAmigable(error?.message ?? "No se pudo registrar el animal."));
}
