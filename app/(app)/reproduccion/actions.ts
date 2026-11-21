"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { INDICADORES_PALPACION, MAX_CRIAS, METODOS_DIAGNOSTICO, RESULTADOS_DIAGNOSTICO, TIPOS_PARTO, VIABILIDADES } from "@/lib/reproduccion";
import { camposClinicosParto, datosPorTipoParto, esquemaCria, prepararParto } from "@/lib/parto-reglas";
import { MENSAJE_SIN_SERVICIO, MENSAJE_YA_VACIA, servicioVigente } from "@/lib/servicio-vigente";
import type { IndicadorPalpacion, MetodoDiagnostico, ResultadoDiagnostico, ViabilidadFetal } from "@/lib/tipos";
import { reglasDiagnostico } from "@/lib/diagnostico-reglas";
import { hembraActiva, leerServicio } from "@/lib/servicio-reglas";
import { decimal, opcional, texto } from "@/lib/validacion";
import { esRepetido, noFutura } from "@/lib/validacion";
import { permisoPara } from "@/lib/permiso-servidor";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true; destino?: string } | { ok: false; error: string };

const ID_UUID = z.uuid();
const destinoFicha = (hembra: string) => `/hato/${hembra}?guardado=1#reproduccion`;

const permiso = permisoPara("reproduccion");

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;


export async function crearServicio(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar servicios");
  if (!p.ok) return { error: p.error };
  const supabase = await crearClienteServidor();
  const l = await leerServicio(Object.fromEntries(form), p.finca.id, supabase);
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
  const l = await leerServicio(Object.fromEntries(form), p.finca.id, supabase);
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
  client_request_id: opcional(z.uuid()),
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
  const reglas = reglasDiagnostico(
    { ...d, metodo: d.metodo as MetodoDiagnostico, resultado: d.resultado as ResultadoDiagnostico, viabilidad_fetal: (d.viabilidad_fetal ?? null) as ViabilidadFetal | null, indicador_palpacion: (d.indicador_palpacion ?? null) as IndicadorPalpacion | null },
    servicioFecha,
  );
  if ("error" in reglas) return { error: reglas.error } as const;
  const propios = reglas.propios;

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
  const { error } = await supabase.from("diagnosticos_gestacion").insert({ finca_id: p.finca.id, hembra_id: l.d.hembra_id, servicio_id: l.servicioId, ...l.fila, client_request_id: l.d.client_request_id ?? null });
  // Doble toque: la misma solicitud ya se guardó (client_request_id único por finca) → seguimos a la ficha.
  if (error && !(esRepetido(error) && l.d.client_request_id)) return { error: mensajeAmigable(error.message) };
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
export async function crearParto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar partos");
  if (!p.ok) return { error: p.error };
  const supabase = await crearClienteServidor();
  const listo = await prepararParto(supabase, p.finca.id, Object.fromEntries(form));
  if ("error" in listo) return { error: listo.error };

  // Un solo paso en la base: el parto, sus crías y los animales de las crías con arete (todo o nada; la lactancia la abre un disparador).
  const { data: r, error } = await supabase.rpc("registrar_parto", listo.args as never);
  if (error || !r) return { error: mensajeAmigable(error?.message ?? "No se pudo guardar el parto.") };
  const { repetido, sin_crear: fallos } = r as { repetido: boolean; sin_crear: string[] };
  // Doble toque: este parto ya se guardó con sus crías; no se repite.
  if (repetido) redirect(destinoFicha(listo.madreId));

  revalidatePath("/reproduccion");
  revalidatePath("/hato");
  revalidatePath("/leche");
  revalidatePath(`/hato/${listo.madreId}`);
  // Si alguna cría no se pudo crear como animal, se dice en la ficha (el parto y las demás ya quedaron).
  redirect(fallos.length ? `/hato/${listo.madreId}?guardado=1&sin_crear=${encodeURIComponent(fallos.join(","))}#reproduccion` : destinoFicha(listo.madreId));
}

const esquemaEdicionParto = z.object({
  madre_id: z.uuid(),
  parto_id: z.uuid("No encontramos ese parto."),
  fecha: z.iso.date("Indica la fecha del parto."),
  tipo: z.enum(TIPOS_PARTO as [string, ...string[]], "Elige qué pasó."),
  ...camposClinicosParto,
});

/** Una cría que se corrige: sexo, peso y si nació viva o muerta (solo las que todavía no son un animal del hato). */
const esquemaCriaEdicion = esquemaCria.pick({ sexo: true, vivo: true, peso: true }).extend({ id: z.uuid() });

/** Corrige la fecha, el tipo y los datos clínicos de un parto, y el sexo, el peso y el estado (viva o muerta) de sus crías que aún no son animales del hato. Pasar de aborto a parto (o al revés) cambia la lactancia: en ese caso se elimina y se registra de nuevo. */
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
  let criasEditadas: z.infer<typeof esquemaCriaEdicion>[] = [];
  const bruto = form.get("crias_edit");
  if (typeof bruto === "string" && bruto) {
    let json: unknown;
    try {
      json = JSON.parse(bruto);
    } catch {
      return { error: "No se entendieron los datos de las crías. Revísalos." };
    }
    const r = z.array(esquemaCriaEdicion).max(MAX_CRIAS).safeParse(json);
    if (!r.success) return { error: r.error.issues[0]?.message ?? "Revisa los datos de las crías." };
    criasEditadas = r.data;
  }
  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase.from("partos").select("id, tipo, servicio_id").eq("id", d.parto_id).eq("finca_id", p.finca.id).eq("madre_id", d.madre_id).maybeSingle();
  if (!actual) return { error: "No encontramos ese parto." };
  if ((actual.tipo === "aborto") !== (d.tipo === "aborto")) return { error: "No se puede cambiar un parto a aborto (ni al revés): elimina el registro y créalo de nuevo." };
  if (criasEditadas.length > 0) {
    const { error: errorCrias } = await supabase.rpc("corregir_crias", {
      p_finca: p.finca.id,
      p_parto: d.parto_id,
      p_crias: criasEditadas.map((x) => ({ id: x.id, sexo: x.sexo ?? null, peso: x.peso ?? null, vivo: x.vivo })),
    });
    if (errorCrias) return { error: mensajeAmigable(errorCrias.message) };
  }
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
