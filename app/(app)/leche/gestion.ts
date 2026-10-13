"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { decimal, opcional, texto } from "@/lib/validacion";
import { DESTINOS_LECHE, MOMENTOS_FRIO, RESIDUOS, TIPOS_MANTENIMIENTO } from "@/lib/leche-calidad";
import { soporteValido } from "@/lib/soportes";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true; destino?: string } | { ok: false; error: string };

const ID_UUID = z.uuid();

const DESTINO_TABLA = {
  analisis_leche: "/leche?vista=calidad",
  despachos_leche: "/leche?vista=despachos",
  controles_frio: "/leche?vista=frio",
  mantenimiento_ordeno: "/leche?vista=frio",
} as const;
type Tabla = keyof typeof DESTINO_TABLA;

/** A dónde vuelve la persona al guardar: la lista de la pestaña (con el aviso «Cambios guardados») o, si es de un animal, su ficha. */
const volverA = (tabla: Tabla, animal?: string | null) =>
  animal ? `/hato/${animal}?guardado=1#calidad` : `${DESTINO_TABLA[tabla]}&guardado=1`;

const revalidar = (animal?: string | null) => {
  revalidatePath("/leche");
  if (animal) revalidatePath(`/hato/${animal}`);
};

/** Doble toque: el servidor ya guardó el mismo envío (`client_request_id` repetido). */
const esRepetido = (e: { code?: string; message: string }) => e.code === "23505" && /client_req/.test(e.message);

async function permiso(verbo: "registrar" | "editar") {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "leche", finca.plan)) return { error: `No tienes permiso para ${verbo} datos de leche en esta finca.` } as const;
  return { finca, rol } as const;
}

const fechaNoFutura = (fecha: string) => (fecha > hoyBogota() ? "La fecha no puede ser futura: registra lo que ya pasó." : null);

// ───────────────────────── Análisis de calidad ─────────────────────────
const esquemaAnalisis = z.object({
  animal_id: opcional(z.uuid()),
  muestra: texto(80, "El nombre de la muestra es muy largo."),
  fecha: z.iso.date("Indica la fecha."),
  grasa_pct: decimal(z.coerce.number("La grasa debe ser un número.").min(0, "La grasa no puede ser negativa.").max(20, "La grasa no puede pasar de 20 %.")),
  proteina_pct: decimal(z.coerce.number("La proteína debe ser un número.").min(0, "La proteína no puede ser negativa.").max(15, "La proteína no puede pasar de 15 %.")),
  rcs_miles_ml: decimal(z.coerce.number("El recuento debe ser un número.").int("El recuento debe ser un número entero.").min(0, "El recuento no puede ser negativo.").max(100000, "El recuento es demasiado alto. Revisa el dato.")),
  solidos_totales_pct: decimal(z.coerce.number("Los sólidos totales deben ser un número.").min(0, "Los sólidos totales no pueden ser negativos.").max(30, "Los sólidos totales no pueden pasar de 30 %.")),
  lactosa_pct: decimal(z.coerce.number("La lactosa debe ser un número.").min(0, "La lactosa no puede ser negativa.").max(10, "La lactosa no puede pasar de 10 %.")),
  // El punto de congelación siempre es negativo: quien escribe «0,535» quiere decir -0,535.
  crioscopia_c: decimal(z.coerce.number("La crioscopia debe ser un número.").min(-1, "La crioscopia debe estar entre -1 y 0 °C.").max(1, "La crioscopia debe estar entre -1 y 0 °C.")),
  residuos_antibioticos: opcional(z.enum(RESIDUOS as [string, ...string[]], "El resultado de residuos no es válido.")),
  soporte_path: opcional(z.string().max(200)),
  volver: opcional(z.string().max(120)),
  laboratorio: texto(120, "El nombre del laboratorio es muy largo."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  analisis_id: opcional(z.uuid()),
});

function leerAnalisis(form: FormData, fincaId: string, exigirDocumento: boolean) {
  const datos = esquemaAnalisis.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = fechaNoFutura(d.fecha);
  if (futura) return { error: futura } as const;
  const crioscopia = d.crioscopia_c == null ? null : -Math.abs(d.crioscopia_c);
  if (crioscopia !== null && (crioscopia <= -1 || crioscopia >= 0)) return { error: "La crioscopia debe estar entre -1 y 0 °C." } as const;
  // La pureza y los residuos son del tanque o del lote, no de un animal suelto.
  const esTanque = !d.animal_id;
  const residuos = esTanque ? (d.residuos_antibioticos ?? null) : null;
  const criosc = esTanque ? crioscopia : null;
  if (d.grasa_pct == null && d.proteina_pct == null && d.rcs_miles_ml == null && d.solidos_totales_pct == null && d.lactosa_pct == null && criosc == null && residuos == null) {
    return { error: "Indica al menos un resultado del análisis." } as const;
  }
  if (!soporteValido(d.soporte_path, fincaId, "calidad")) return { error: "El documento no es válido. Adjúntalo de nuevo." } as const;
  if (exigirDocumento && !d.soporte_path) return { error: "Adjunta el documento con los resultados (el informe del laboratorio o la foto de la prueba)." } as const;
  return {
    d,
    fila: {
      animal_id: d.animal_id ?? null,
      muestra: d.animal_id ? null : (d.muestra ?? null),
      fecha: d.fecha,
      grasa_pct: d.grasa_pct ?? null,
      proteina_pct: d.proteina_pct ?? null,
      solidos_totales_pct: d.solidos_totales_pct ?? null,
      lactosa_pct: d.lactosa_pct ?? null,
      rcs_miles_ml: d.rcs_miles_ml ?? null,
      crioscopia_c: criosc,
      residuos_antibioticos: residuos as never,
      soporte_path: d.soporte_path ?? null,
      laboratorio: d.laboratorio ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

export async function crearAnalisis(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar");
  if ("error" in p) return { error: p.error };
  const l = leerAnalisis(form, p.finca.id, true);
  if ("error" in l) return { error: l.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("analisis_leche").insert({ finca_id: p.finca.id, ...l.fila, client_request_id: l.d.client_request_id ?? null });
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  revalidar(l.fila.animal_id);
  // Si venía de los controles de un despacho, vuelve allá para terminar de responderlos.
  const vuelta = l.d.volver && /^\/leche\/despachos\/[0-9a-f-]{36}\/controles$/i.test(l.d.volver) ? l.d.volver : null;
  redirect(vuelta ?? volverA("analisis_leche", l.fila.animal_id));
}

export async function editarAnalisis(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar");
  if ("error" in p) return { error: p.error };
  const l = leerAnalisis(form, p.finca.id, false);
  if ("error" in l) return { error: l.error };
  if (!l.d.analisis_id) return { error: "No encontramos ese análisis." };
  const supabase = await crearClienteServidor();
  // El animal de un análisis no se cambia al editar: si estaba mal, se elimina y se registra de nuevo.
  const { animal_id, ...cambios } = l.fila;
  void animal_id;
  const { data, error } = await supabase.from("analisis_leche").update(cambios).eq("id", l.d.analisis_id).eq("finca_id", p.finca.id).select("id, animal_id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese análisis." };
  revalidar(data[0].animal_id);
  redirect(volverA("analisis_leche", data[0].animal_id));
}

// ───────────────────────── Despachos ─────────────────────────
const esquemaDespacho = z.object({
  fecha: z.iso.date("Indica la fecha."),
  litros: decimal(z.coerce.number("Los litros deben ser un número.").positive("Los litros deben ser mayores que cero.").max(1_000_000, "Los litros son demasiados. Revisa el dato.")).pipe(z.number("Indica cuántos litros se despacharon.")),
  destino_tipo: z.enum(DESTINOS_LECHE as [string, ...string[]], "Elige el destino."),
  comprador: texto(120, "El nombre del comprador es muy largo."),
  tanque: texto(80, "El nombre del tanque es muy largo."),
  guia: texto(60, "La guía o factura es muy larga."),
  precio_litro: decimal(z.coerce.number("El precio debe ser un número.").min(0, "El precio no puede ser negativo.").max(1_000_000, "El precio es demasiado alto. Revisa el dato.")),
  temperatura_c: decimal(z.coerce.number("La temperatura debe ser un número.").min(-10, "La temperatura no es válida.").max(60, "La temperatura no es válida.")),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  despacho_id: opcional(z.uuid()),
});

function leerDespacho(form: FormData) {
  const datos = esquemaDespacho.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = fechaNoFutura(d.fecha);
  if (futura) return { error: futura } as const;
  return {
    d,
    fila: {
      fecha: d.fecha,
      litros: d.litros,
      destino_tipo: d.destino_tipo as never,
      comprador: d.comprador ?? null,
      tanque: d.tanque ?? null,
      guia: d.guia ?? null,
      precio_litro: d.precio_litro ?? null,
      temperatura_c: d.temperatura_c ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

export async function crearDespacho(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar");
  if ("error" in p) return { error: p.error };
  const l = leerDespacho(form);
  if ("error" in l) return { error: l.error };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("despachos_leche").insert({ finca_id: p.finca.id, ...l.fila, client_request_id: l.d.client_request_id ?? null }).select("id").maybeSingle();
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  // Doble toque: ya se guardó; se busca el despacho para llevar a la persona a sus controles.
  let id = data?.id;
  if (error && l.d.client_request_id) {
    id = (await supabase.from("despachos_leche").select("id").eq("finca_id", p.finca.id).eq("client_request_id", l.d.client_request_id).maybeSingle()).data?.id;
  }
  revalidar();
  // Un despacho recién registrado va directo a sus controles de calidad (residuos, crioscopia, composición, células): responderlos o
  // dejar constancia de que no se hicieron.
  redirect(id ? `/leche/despachos/${id}/controles?nuevo=1` : volverA("despachos_leche"));
}

export async function editarDespacho(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar");
  if ("error" in p) return { error: p.error };
  const l = leerDespacho(form);
  if ("error" in l) return { error: l.error };
  if (!l.d.despacho_id) return { error: "No encontramos ese despacho." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("despachos_leche").update(l.fila).eq("id", l.d.despacho_id).eq("finca_id", p.finca.id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese despacho." };
  revalidar();
  redirect(volverA("despachos_leche"));
}

// ───────────────────────── Cadena de frío ─────────────────────────
const esquemaFrio = z.object({
  fecha: z.iso.date("Indica la fecha."),
  hora: opcional(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora no es válida.")),
  momento: z.enum(MOMENTOS_FRIO as [string, ...string[]], "Elige cuándo se midió."),
  temperatura_c: decimal(z.coerce.number("La temperatura debe ser un número.").min(-10, "La temperatura no es válida.").max(60, "La temperatura no es válida.")).pipe(z.number("Indica la temperatura.")),
  equipo: texto(80, "El nombre del tanque o equipo es muy largo."),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  control_id: opcional(z.uuid()),
});

function leerFrio(form: FormData) {
  const datos = esquemaFrio.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = fechaNoFutura(d.fecha);
  if (futura) return { error: futura } as const;
  return {
    d,
    fila: {
      fecha: d.fecha,
      hora: d.hora ?? null,
      momento: d.momento as never,
      temperatura_c: d.temperatura_c,
      equipo: d.equipo ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

export async function crearFrio(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar");
  if ("error" in p) return { error: p.error };
  const l = leerFrio(form);
  if ("error" in l) return { error: l.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("controles_frio").insert({ finca_id: p.finca.id, ...l.fila, client_request_id: l.d.client_request_id ?? null });
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  revalidar();
  redirect(volverA("controles_frio"));
}

export async function editarFrio(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar");
  if ("error" in p) return { error: p.error };
  const l = leerFrio(form);
  if ("error" in l) return { error: l.error };
  if (!l.d.control_id) return { error: "No encontramos esa medición." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("controles_frio").update(l.fila).eq("id", l.d.control_id).eq("finca_id", p.finca.id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos esa medición." };
  revalidar();
  redirect(volverA("controles_frio"));
}

// ───────────────────────── Mantenimiento del equipo ─────────────────────────
const esquemaMantenimiento = z.object({
  fecha: z.iso.date("Indica la fecha."),
  tipo: z.enum(TIPOS_MANTENIMIENTO as [string, ...string[]], "Elige qué se hizo."),
  equipo: texto(80, "El nombre del equipo es muy largo."),
  presion_kpa: decimal(z.coerce.number("La presión debe ser un número.").min(0, "La presión no puede ser negativa.").max(100, "La presión de vacío no puede pasar de 100 kPa.")),
  responsable: texto(120, "El nombre del responsable es muy largo."),
  proxima_fecha: opcional(z.iso.date("La fecha de la próxima vez no es válida.")),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  mantenimiento_id: opcional(z.uuid()),
});

function leerMantenimiento(form: FormData) {
  const datos = esquemaMantenimiento.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = fechaNoFutura(d.fecha);
  if (futura) return { error: futura } as const;
  if (d.proxima_fecha && d.proxima_fecha <= d.fecha) return { error: "La próxima vez debe ser después de la fecha de esta." } as const;
  return {
    d,
    fila: {
      fecha: d.fecha,
      tipo: d.tipo as never,
      equipo: d.equipo ?? null,
      // La presión solo tiene sentido al medir el vacío.
      presion_kpa: d.tipo === "presion_vacio" ? (d.presion_kpa ?? null) : null,
      responsable: d.responsable ?? null,
      proxima_fecha: d.proxima_fecha ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

export async function crearMantenimiento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar");
  if ("error" in p) return { error: p.error };
  const l = leerMantenimiento(form);
  if ("error" in l) return { error: l.error };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("mantenimiento_ordeno").insert({ finca_id: p.finca.id, ...l.fila, client_request_id: l.d.client_request_id ?? null });
  if (error && !esRepetido(error)) return { error: mensajeAmigable(error.message) };
  revalidar();
  redirect(volverA("mantenimiento_ordeno"));
}

export async function editarMantenimiento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar");
  if ("error" in p) return { error: p.error };
  const l = leerMantenimiento(form);
  if ("error" in l) return { error: l.error };
  if (!l.d.mantenimiento_id) return { error: "No encontramos ese registro." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("mantenimiento_ordeno").update(l.fila).eq("id", l.d.mantenimiento_id).eq("finca_id", p.finca.id).select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese registro." };
  revalidar();
  redirect(volverA("mantenimiento_ordeno"));
}

// ───────────────────────── Eliminar (propietario o administrador) ─────────────────────────
async function eliminar(tabla: Tabla, id: string, nombre: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: `Solo el propietario o un administrador puede eliminar ${nombre}.` };
  if (!ID_UUID.safeParse(id).success) return { ok: false, error: "Registro no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from(tabla).delete().eq("id", id).eq("finca_id", finca.id).select("*");
  if (error?.code === "23503") return { ok: false, error: "Este análisis respalda un control de un despacho y no se puede eliminar: se perdería la prueba." };
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese registro." };
  const animal = tabla === "analisis_leche" ? ((data[0] as { animal_id?: string | null }).animal_id ?? null) : null;
  revalidar(animal);
  return { ok: true, destino: animal ? `/hato/${animal}#calidad` : DESTINO_TABLA[tabla] };
}

export async function eliminarAnalisis(id: string): Promise<Resultado> {
  return eliminar("analisis_leche", id, "análisis");
}
export async function eliminarDespacho(id: string): Promise<Resultado> {
  return eliminar("despachos_leche", id, "despachos");
}
export async function eliminarFrio(id: string): Promise<Resultado> {
  return eliminar("controles_frio", id, "mediciones");
}
export async function eliminarMantenimiento(id: string): Promise<Resultado> {
  return eliminar("mantenimiento_ordeno", id, "registros del equipo");
}
