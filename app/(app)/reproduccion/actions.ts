"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { CAUSAS_ABORTO, INDICADORES_PALPACION, MAX_CRIAS, METODOS_DIAGNOSTICO, RESULTADOS_DIAGNOSTICO, TECNICAS_INSEMINACION, TIPOS_PARTO, TIPOS_SERVICIO, TIPOS_TRANSFERENCIA, VIABILIDADES } from "@/lib/reproduccion";
import { diasHasta } from "@/lib/fechas";
import { datosPorTipoParto } from "@/lib/parto-reglas";
import { MENSAJE_SIN_SERVICIO, MENSAJE_YA_VACIA, servicioVigente } from "@/lib/servicio-vigente";
import type { DiagnosticoGestacion } from "@/lib/tipos";
import { leerNumero } from "@/lib/numeros";
import { decimal, opcional, texto } from "@/lib/validacion";
import { esRepetido, noFutura } from "@/lib/validacion";
import { permisoPara } from "@/lib/permiso-servidor";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true; destino?: string } | { ok: false; error: string };

const ID_UUID = z.uuid();
const destinoFicha = (hembra: string) => `/hato/${hembra}?guardado=1#reproduccion`;

const permiso = permisoPara("reproduccion");

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** La hembra existe, es de la finca y sigue en el hato. */
async function hembraActiva(supabase: Cliente, fincaId: string, id: string) {
  const { data } = await supabase.from("animales").select("id, especie, vocacion, fecha_nacimiento, sexo, estado").eq("id", id).eq("finca_id", fincaId).is("deleted_at", null).maybeSingle();
  if (!data) return { error: "No encontramos esa hembra." } as const;
  if (data.sexo !== "hembra") return { error: "Esto solo se registra sobre una hembra." } as const;
  if (data.estado !== "activo") return { error: "Esa hembra ya salió del hato." } as const;
  return { hembra: data } as const;
}

// ───────────────────────── Servicios (monta, inseminación, transferencia) ─────────────────────────
const esquemaServicio = z.object({
  hembra_id: z.uuid("Elige la hembra."),
  fecha: z.iso.date("Indica la fecha del servicio."),
  tipo: z.enum(TIPOS_SERVICIO as [string, ...string[]], "Elige el tipo de servicio."),
  macho_id: opcional(z.uuid("El reproductor no es válido.")),
  macho_externo: texto(80, "El nombre del macho es muy largo."),
  semen_lote: texto(60, "El código de la pajilla es muy largo."),
  tecnica_inseminacion: opcional(z.enum(TECNICAS_INSEMINACION as [string, ...string[]], "Elige el tipo de inseminación.")),
  tipo_transferencia: opcional(z.enum(TIPOS_TRANSFERENCIA as [string, ...string[]], "Elige el tipo de transferencia.")),
  embrion_codigo: texto(60, "El código del embrión es muy largo."),
  madre_genetica_id: opcional(z.uuid("La madre genética no es válida.")),
  madre_genetica_externa: texto(80, "El nombre de la madre genética es muy largo."),
  responsable: texto(120, "El nombre del responsable es muy largo."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  servicio_id: opcional(z.uuid()),
});

async function leerServicio(form: FormData, fincaId: string, supabase: Cliente) {
  const datos = esquemaServicio.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  if (d.macho_id && d.macho_externo) return { error: "Elige un reproductor de tu hato o escribe el de otra finca, no los dos." } as const;
  if (d.madre_genetica_id && d.madre_genetica_externa) return { error: "Elige la madre genética de tu hato o escribe la de otra finca, no las dos." } as const;
  // Cada tipo de servicio pide lo suyo: la monta, un reproductor; la inseminación, pajilla y técnica; la transferencia, embrión, tipo y madre genética.
  if (!d.macho_id && !d.macho_externo) {
    return { error: d.tipo === "monta_natural" ? "Elige el reproductor que hizo la monta." : d.tipo === "inseminacion" ? "Indica el reproductor donante del semen." : "Indica el padre genético del embrión." } as const;
  }
  if (d.tipo === "inseminacion") {
    if (!d.semen_lote) return { error: "Escribe el código o banco de la pajilla." } as const;
    if (!d.tecnica_inseminacion) return { error: "Elige el tipo de inseminación." } as const;
  }
  if (d.tipo === "transferencia_embrionaria") {
    if (!d.embrion_codigo) return { error: "Escribe el código o lote del embrión." } as const;
    if (!d.tipo_transferencia) return { error: "Elige el tipo de transferencia." } as const;
    if (!d.madre_genetica_id && !d.madre_genetica_externa) return { error: "Indica la madre genética, la hembra donante del óvulo." } as const;
  }
  const h = await hembraActiva(supabase, fincaId, d.hembra_id);
  if ("error" in h) return { error: h.error } as const;
  if (h.hembra.fecha_nacimiento && d.fecha <= h.hembra.fecha_nacimiento) return { error: "El servicio debe ser posterior al nacimiento de la hembra." } as const;
  if (d.madre_genetica_id) {
    if (d.madre_genetica_id === d.hembra_id) return { error: "La madre genética debe ser otra hembra: la que recibe el embrión es la receptora." } as const;
    const { data: mg } = await supabase.from("animales").select("id, sexo, especie").eq("id", d.madre_genetica_id).eq("finca_id", fincaId).is("deleted_at", null).maybeSingle();
    if (!mg || mg.sexo !== "hembra") return { error: "La madre genética debe ser una hembra de tu hato." } as const;
    if (mg.especie !== h.hembra.especie) return { error: "La madre genética debe ser de la misma especie que la receptora." } as const;
  }
  if (d.macho_id) {
    const { data: m } = await supabase.from("animales").select("id, sexo, especie").eq("id", d.macho_id).eq("finca_id", fincaId).is("deleted_at", null).maybeSingle();
    if (!m || m.sexo !== "macho") return { error: "El reproductor debe ser un macho de tu hato." } as const;
    if (m.especie !== h.hembra.especie) return { error: "El reproductor debe ser de la misma especie que la hembra." } as const;
  }
  const esTransferencia = d.tipo === "transferencia_embrionaria";
  return {
    d,
    fila: {
      fecha: d.fecha,
      tipo: d.tipo as never,
      macho_id: d.macho_id ?? null,
      macho_externo: d.macho_externo ?? null,
      // Cada dato solo se guarda en el tipo de servicio al que pertenece.
      semen_lote: d.tipo === "inseminacion" ? (d.semen_lote ?? null) : null,
      tecnica_inseminacion: d.tipo === "inseminacion" ? ((d.tecnica_inseminacion ?? null) as never) : null,
      embrion_codigo: esTransferencia ? (d.embrion_codigo ?? null) : null,
      tipo_transferencia: esTransferencia ? ((d.tipo_transferencia ?? null) as never) : null,
      madre_genetica_id: esTransferencia ? (d.madre_genetica_id ?? null) : null,
      madre_genetica_externa: esTransferencia ? (d.madre_genetica_externa ?? null) : null,
      responsable: d.responsable ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

export async function crearServicio(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar servicios");
  if (!p.ok) return { error: p.error };
  const supabase = await crearClienteServidor();
  const l = await leerServicio(form, p.finca.id, supabase);
  if ("error" in l) return { error: l.error };
  const { error } = await supabase.from("servicios").insert({ finca_id: p.finca.id, hembra_id: l.d.hembra_id, ...l.fila, client_request_id: l.d.client_request_id ?? null });
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  revalidatePath("/reproduccion");
  revalidatePath(`/hato/${l.d.hembra_id}`);
  redirect(destinoFicha(l.d.hembra_id));
}

export async function editarServicio(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar servicios");
  if (!p.ok) return { error: p.error };
  const supabase = await crearClienteServidor();
  const l = await leerServicio(form, p.finca.id, supabase);
  if ("error" in l) return { error: l.error };
  if (!l.d.servicio_id) return { error: "No encontramos ese servicio." };
  const { data, error } = await supabase.from("servicios").update(l.fila).eq("id", l.d.servicio_id).eq("finca_id", p.finca.id).eq("hembra_id", l.d.hembra_id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese servicio." };
  revalidatePath("/reproduccion");
  revalidatePath(`/hato/${l.d.hembra_id}`);
  redirect(destinoFicha(l.d.hembra_id));
}

export async function eliminarServicio(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar servicios." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Servicio no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("servicios").delete().eq("id", id).eq("finca_id", finca.id).select("hembra_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese servicio." };
  revalidatePath("/reproduccion");
  revalidatePath(`/hato/${data[0].hembra_id}`);
  return { ok: true, destino: `/hato/${data[0].hembra_id}#reproduccion` };
}

// ───────────────────────── Diagnóstico de gestación ─────────────────────────
const entero = (min: number, max: number, mensaje: string) => decimal(z.number(mensaje).int(mensaje).min(min, mensaje).max(max, mensaje));

const esquemaDiagnostico = z.object({
  hembra_id: z.uuid("Elige la hembra."),
  fecha: z.iso.date("Indica la fecha del diagnóstico."),
  metodo: z.enum(METODOS_DIAGNOSTICO as [string, ...string[]], "Elige cómo se hizo."),
  resultado: z.enum(RESULTADOS_DIAGNOSTICO as [string, ...string[]], "Elige el resultado."),
  dias_gestacion: entero(1, 200, "Los días de gestación deben ser un número entero entre 1 y 200."),
  num_fetos: entero(1, 4, "Elige cuántos fetos se ven."),
  viabilidad_fetal: opcional(z.enum(VIABILIDADES as [string, ...string[]], "Indica si hay latido.")),
  indicador_palpacion: opcional(z.enum(INDICADORES_PALPACION as [string, ...string[]], "Elige qué indicó la preñez.")),
  condicion_corporal: decimal(z.number("La condición corporal debe estar entre 1 y 5.").min(1, "La condición corporal debe estar entre 1 y 5.").max(5, "La condición corporal debe estar entre 1 y 5.")),
  prueba_nombre: texto(80, "El nombre de la prueba es muy largo."),
  prueba_resultado: texto(120, "El resultado de la prueba es muy largo."),
  responsable: texto(120, "El nombre de quien hizo el diagnóstico es muy largo."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  diagnostico_id: opcional(z.uuid()),
});

/**
 * Lee y valida un diagnóstico. Al crear, el servidor busca el servicio activo de la hembra (el navegador no lo elige) y sin él no se guarda; al editar,
 * el diagnóstico conserva el servicio que ya tenía. Cada método guarda solo sus datos: ecografía, palpación u otra prueba.
 */
async function leerDiagnostico(form: FormData, fincaId: string, supabase: Cliente) {
  const datos = esquemaDiagnostico.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  const h = await hembraActiva(supabase, fincaId, d.hembra_id);
  if ("error" in h) return { error: h.error } as const;

  let servicioId: string | null = null;
  let servicioFecha: string | null = null;
  if (d.diagnostico_id) {
    const { data: previo } = await supabase.from("diagnosticos_gestacion").select("servicio_id").eq("id", d.diagnostico_id).eq("finca_id", fincaId).eq("hembra_id", d.hembra_id).maybeSingle();
    if (!previo) return { error: "No encontramos ese diagnóstico." } as const;
    servicioId = previo.servicio_id;
    if (servicioId) {
      const { data: s } = await supabase.from("servicios").select("fecha").eq("id", servicioId).eq("finca_id", fincaId).maybeSingle();
      servicioFecha = s?.fecha ?? null;
    }
  } else {
    const v = await servicioVigente(supabase, fincaId, d.hembra_id);
    if (!v.servicio) return { error: v.razon === "ya_vacia" ? MENSAJE_YA_VACIA : MENSAJE_SIN_SERVICIO } as const;
    servicioId = v.servicio.id;
    servicioFecha = v.servicio.fecha;
  }
  if (servicioFecha && d.fecha < servicioFecha) return { error: "El diagnóstico no puede ser anterior al servicio." } as const;

  const sinEco = { dias_gestacion: null, num_fetos: null, viabilidad_fetal: null };
  const sinPalpacion = { indicador_palpacion: null, condicion_corporal: null };
  const sinPrueba = { prueba_nombre: null, prueba_resultado: null };
  let propios: Pick<DiagnosticoGestacion, "dias_gestacion" | "num_fetos" | "viabilidad_fetal" | "indicador_palpacion" | "condicion_corporal" | "prueba_nombre" | "prueba_resultado">;

  if (d.metodo === "ecografia") {
    // Una hembra vacía no tiene nada que estimar: la ecografía solo guarda sus datos si se vio algo.
    if (d.resultado === "vacia") propios = { ...sinEco, ...sinPalpacion, ...sinPrueba };
    else {
      if (d.resultado === "gestante") {
        if (d.dias_gestacion == null) return { error: "Indica los días de gestación que calculó el ecografista." } as const;
        if (d.num_fetos == null) return { error: "Elige cuántos fetos se ven." } as const;
        if (!d.viabilidad_fetal) return { error: "Indica si el feto tiene latido." } as const;
        if (d.viabilidad_fetal === "sin_actividad") return { error: "Sin actividad fetal no se confirma una gestación: elige «Dudoso» para repetir la ecografía o «Vacía»." } as const;
      }
      if (d.dias_gestacion != null && servicioFecha && d.dias_gestacion > diasHasta(d.fecha, servicioFecha) + 10) {
        return { error: `La ecografía calcula ${d.dias_gestacion} días de gestación, pero el servicio fue hace ${diasHasta(d.fecha, servicioFecha)} días.` } as const;
      }
      propios = { dias_gestacion: d.dias_gestacion ?? null, num_fetos: d.num_fetos ?? null, viabilidad_fetal: (d.viabilidad_fetal ?? null) as never, ...sinPalpacion, ...sinPrueba };
    }
  } else if (d.metodo === "palpacion") {
    if (!d.indicador_palpacion) return { error: "Elige el indicador de la palpación." } as const;
    if (d.indicador_palpacion === "retorno_celo" && d.resultado === "gestante") return { error: "Si volvió a celo no quedó gestante: elige «Vacía» o «Dudoso»." } as const;
    if (d.resultado === "vacia" && d.condicion_corporal == null) return { error: "Indica la condición corporal: sirve para decidir si la hembra vuelve al lote de reproducción." } as const;
    propios = { ...sinEco, indicador_palpacion: d.indicador_palpacion as never, condicion_corporal: d.condicion_corporal ?? null, ...sinPrueba };
  } else {
    if (!d.prueba_nombre) return { error: "Escribe el nombre de la prueba o del kit que se usó." } as const;
    if (!d.prueba_resultado) return { error: "Escribe el resultado de la prueba o su valor de referencia." } as const;
    propios = { ...sinEco, ...sinPalpacion, prueba_nombre: d.prueba_nombre, prueba_resultado: d.prueba_resultado };
  }

  return {
    d,
    servicioId,
    fila: { fecha: d.fecha, metodo: d.metodo as never, resultado: d.resultado as never, ...propios, responsable: d.responsable ?? null, observaciones: d.observaciones ?? null },
  } as const;
}

export async function crearDiagnostico(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar diagnósticos");
  if (!p.ok) return { error: p.error };
  const supabase = await crearClienteServidor();
  const l = await leerDiagnostico(form, p.finca.id, supabase);
  if ("error" in l) return { error: l.error };
  const { error } = await supabase.from("diagnosticos_gestacion").insert({ finca_id: p.finca.id, hembra_id: l.d.hembra_id, servicio_id: l.servicioId, ...l.fila });
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/reproduccion");
  revalidatePath(`/hato/${l.d.hembra_id}`);
  redirect(destinoFicha(l.d.hembra_id));
}

export async function editarDiagnostico(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar diagnósticos");
  if (!p.ok) return { error: p.error };
  const supabase = await crearClienteServidor();
  const l = await leerDiagnostico(form, p.finca.id, supabase);
  if ("error" in l) return { error: l.error };
  if (!l.d.diagnostico_id) return { error: "No encontramos ese diagnóstico." };
  const { data, error } = await supabase.from("diagnosticos_gestacion").update(l.fila).eq("id", l.d.diagnostico_id).eq("finca_id", p.finca.id).eq("hembra_id", l.d.hembra_id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese diagnóstico." };
  revalidatePath("/reproduccion");
  revalidatePath(`/hato/${l.d.hembra_id}`);
  redirect(destinoFicha(l.d.hembra_id));
}

export async function eliminarDiagnostico(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar diagnósticos." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Diagnóstico no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("diagnosticos_gestacion").delete().eq("id", id).eq("finca_id", finca.id).select("hembra_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese diagnóstico." };
  revalidatePath("/reproduccion");
  revalidatePath(`/hato/${data[0].hembra_id}`);
  return { ok: true, destino: `/hato/${data[0].hembra_id}#reproduccion` };
}

// ───────────────────────── Partos (con sus crías) ─────────────────────────
const esquemaCria = z.object({
  sexo: z.enum(["hembra", "macho"], "Indica el sexo de cada cría.").nullable().optional(),
  vivo: z.boolean(),
  // El peso llega como lo escribió la persona («3,2»); un texto que no es número no se descarta en silencio.
  peso: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : (leerNumero(v) ?? v)) : (v ?? undefined)),
    z.number("El peso de la cría debe ser un número, como 3,2.").min(0.1, "El peso al nacer debe estar entre 0,1 y 15 kg.").max(15, "El peso al nacer debe estar entre 0,1 y 15 kg.").optional(),
  ),
  arete: z.string().trim().max(40, "El arete es muy largo.").optional(),
  nombre: z.string().trim().max(60, "El nombre es muy largo.").optional(),
});

/** Lo clínico de un parto: complicaciones y observaciones de todos; causa del aborto; y el médico y el protocolo de una cesárea. */
const camposClinicosParto = {
  complicaciones: texto(1000, "Las complicaciones son muy largas."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  causa_aborto: opcional(z.enum(CAUSAS_ABORTO as [string, ...string[]], "Elige la causa aparente del aborto.")),
  asistido_por: texto(120, "El nombre de quien asistió es muy largo."),
  protocolo_posoperatorio: texto(1000, "El protocolo posoperatorio es muy largo."),
};

const esquemaParto = z.object({
  madre_id: z.uuid("Elige la hembra."),
  fecha: z.iso.date("Indica la fecha del parto."),
  tipo: z.enum(TIPOS_PARTO as [string, ...string[]], "Elige qué pasó."),
  servicio_id: opcional(z.uuid()),
  ...camposClinicosParto,
  crias: opcional(z.string().max(5000)),
  client_request_id: opcional(z.uuid()),
  parto_id: opcional(z.uuid()),
});

export type CriaEntrada = z.infer<typeof esquemaCria>;

function leerCrias(texto: string | undefined, tipo: string) {
  if (tipo === "aborto") return { crias: [] as CriaEntrada[] } as const;
  let bruto: unknown;
  try {
    bruto = texto ? JSON.parse(texto) : [];
  } catch {
    return { error: "No se entendieron los datos de las crías. Revísalos." } as const;
  }
  const r = z.array(esquemaCria).max(MAX_CRIAS, `Máximo ${MAX_CRIAS} crías por parto.`).safeParse(bruto);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Revisa los datos de las crías." } as const;
  if (r.data.length === 0) return { error: "Registra al menos una cría (si nació muerta, márcala como no viva)." } as const;
  return { crias: r.data } as const;
}

export async function crearParto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar partos");
  if (!p.ok) return { error: p.error };
  const datos = esquemaParto.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura };
  const clinico = datosPorTipoParto(d);
  if ("error" in clinico) return { error: clinico.error };
  const c = leerCrias(d.crias, d.tipo);
  if ("error" in c) return { error: c.error };

  const supabase = await crearClienteServidor();
  const h = await hembraActiva(supabase, p.finca.id, d.madre_id);
  if ("error" in h) return { error: h.error };
  if (h.hembra.fecha_nacimiento && d.fecha <= h.hembra.fecha_nacimiento) return { error: "El parto debe ser posterior al nacimiento de la hembra." };

  let servicio: { id: string; macho_id: string | null; macho_externo: string | null; fecha: string } | null = null;
  if (d.servicio_id) {
    const { data: s } = await supabase.from("servicios").select("id, macho_id, macho_externo, fecha").eq("id", d.servicio_id).eq("finca_id", p.finca.id).eq("hembra_id", d.madre_id).maybeSingle();
    if (!s) return { error: "No encontramos el servicio de este parto." };
    if (d.fecha <= s.fecha) return { error: "El parto debe ser posterior al servicio." };
    servicio = s;
  }

  // Los aretes de las crías que se crean como animales no pueden repetirse (ni entre ellas ni con el hato): se comprueba antes de guardar nada.
  const aretes = c.crias.map((x) => x.arete).filter((a): a is string => Boolean(a));
  if (new Set(aretes.map((a) => a.toLowerCase())).size !== aretes.length) return { error: "Dos crías tienen el mismo arete. Cámbialo." };
  if (aretes.length) {
    const { data: ya } = await supabase.from("animales").select("numero_arete").eq("finca_id", p.finca.id).in("numero_arete", aretes);
    if (ya && ya.length > 0) return { error: `El arete ${ya[0].numero_arete} ya está en tu hato. Usa otro para la cría.` };
  }
  if (c.crias.some((x) => x.arete && !x.vivo)) return { error: "Una cría que nació muerta no se crea como animal: quita su arete." };
  if (c.crias.some((x) => x.arete && !x.sexo)) return { error: "Indica el sexo de la cría que vas a crear como animal." };

  // Un solo paso en la base: el parto, sus crías y los animales de las crías con arete (todo o nada; la lactancia la abre un disparador).
  const { data: r, error } = await supabase.rpc("registrar_parto", {
    p_finca: p.finca.id,
    p_parto: {
      madre_id: d.madre_id,
      servicio_id: servicio?.id ?? null,
      fecha: d.fecha,
      tipo: d.tipo,
      ...clinico.datos,
      client_request_id: d.client_request_id ?? null,
      padre_id: servicio?.macho_id ?? null,
      padre_externo: servicio?.macho_externo ?? null,
    },
    p_crias: c.crias.map((x) => ({ arete: x.arete ?? null, nombre: x.nombre || null, sexo: x.sexo ?? null, peso: x.peso ?? null, vivo: x.vivo })),
  });
  if (error || !r) return { error: mensajeAmigable(error?.message ?? "No se pudo guardar el parto.") };
  const { repetido, sin_crear: fallos } = r as { repetido: boolean; sin_crear: string[] };
  // Doble toque: este parto ya se guardó con sus crías; no se repite.
  if (repetido) redirect(destinoFicha(d.madre_id));

  revalidatePath("/reproduccion");
  revalidatePath("/hato");
  revalidatePath("/leche");
  revalidatePath(`/hato/${d.madre_id}`);
  // Si alguna cría no se pudo crear como animal, se dice en la ficha (el parto y las demás ya quedaron).
  redirect(fallos.length ? `/hato/${d.madre_id}?guardado=1&sin_crear=${encodeURIComponent(fallos.join(","))}#reproduccion` : destinoFicha(d.madre_id));
}

const esquemaEdicionParto = z.object({
  madre_id: z.uuid(),
  parto_id: z.uuid("No encontramos ese parto."),
  fecha: z.iso.date("Indica la fecha del parto."),
  tipo: z.enum(TIPOS_PARTO as [string, ...string[]], "Elige qué pasó."),
  ...camposClinicosParto,
});

/** Corrige la fecha, el tipo y los datos clínicos de un parto (las crías se corrigen desde su ficha). Pasar de aborto a parto (o al revés) cambia la lactancia: en ese caso se elimina y se registra de nuevo. */
export async function editarParto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar partos");
  if (!p.ok) return { error: p.error };
  const datos = esquemaEdicionParto.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura };
  const clinico = datosPorTipoParto(d);
  if ("error" in clinico) return { error: clinico.error };
  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase.from("partos").select("id, tipo, servicio_id").eq("id", d.parto_id).eq("finca_id", p.finca.id).eq("madre_id", d.madre_id).maybeSingle();
  if (!actual) return { error: "No encontramos ese parto." };
  if ((actual.tipo === "aborto") !== (d.tipo === "aborto")) return { error: "No se puede cambiar un parto a aborto (ni al revés): elimina el registro y créalo de nuevo." };
  const { error } = await supabase.from("partos").update({ fecha: d.fecha, tipo: d.tipo as never, ...clinico.datos }).eq("id", d.parto_id).eq("finca_id", p.finca.id);
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/reproduccion");
  revalidatePath(`/hato/${d.madre_id}`);
  redirect(destinoFicha(d.madre_id));
}

/**
 * Elimina un parto y sus crías (los animales que se crearon desde ellas no se tocan). Si el parto abrió una lactancia sin ordeños, esa
 * lactancia se elimina también; si ya tiene ordeños, no se puede eliminar el parto. Solo propietario o administrador.
 */
export async function eliminarParto(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar partos." };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Parto no válido." };
  const supabase = await crearClienteServidor();
  // Un solo paso en la base: comprueba que la lactancia que abrió no tiene ordeños y borra la lactancia y el parto (todo o nada).
  const { data: madreId, error } = await supabase.rpc("eliminar_parto", { p_finca: finca.id, p_parto: id });
  if (error || !madreId) return { ok: false, error: mensajeAmigable(error?.message ?? "No encontramos ese parto.") };
  revalidatePath("/reproduccion");
  revalidatePath("/leche");
  revalidatePath(`/hato/${madreId}`);
  return { ok: true, destino: `/hato/${madreId}#reproduccion` };
}

// ───────────────────────── Partos que ya había tenido ─────────────────────────
const esquemaPrevios = z.object({
  animalId: z.uuid(),
  partos: decimal(z.coerce.number("Los partos deben ser un número.").int("Los partos deben ser un número entero.").min(0, "Los partos no pueden ser negativos.").max(30, "Revisa el dato: más de 30 partos no es posible.")),
});

/** Cuántos partos había tenido la hembra antes de registrarlos aquí (vacío = no se sabe). De este número depende el aviso de pasar a ceba. */
export async function guardarPartosPrevios(entrada: { animalId: string; partos: string }): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato", finca.plan)) return { ok: false, error: "No tienes permiso para editar animales en esta finca." };
  const datos = esquemaPrevios.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("animales")
    .update({ partos_previos: datos.data.partos ?? null })
    .eq("id", datos.data.animalId)
    .eq("finca_id", finca.id)
    .eq("sexo", "hembra")
    .select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa hembra." };
  revalidatePath(`/hato/${datos.data.animalId}`);
  revalidatePath("/carne");
  return { ok: true };
}
