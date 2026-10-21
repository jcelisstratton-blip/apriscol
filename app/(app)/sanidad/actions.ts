"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota, sumarDias } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import { soporteValido } from "@/lib/soportes";
import { DIRECCION_SANIDAD } from "@/lib/hato";
import { EVENTO_CON_PRODUCTO, RESULTADOS_PRUEBA, TIPOS_EVENTO, TIPOS_PRODUCTO, TIPOS_PROGRAMABLES, TIPOS_PRUEBA, VIAS } from "@/lib/sanidad";
import { opcional } from "@/lib/validacion";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

/** Un número escrito a la colombiana: «25.000» son veinticinco mil, no veinticinco; «1,5» es uno y medio. */
const numero = (s: z.ZodType<number>) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), opcional(s));
const dias = (mensaje: string) => z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v : 0), z.coerce.number(mensaje).int(mensaje).min(0, mensaje).max(365, "Los días de retiro no pueden pasar de 365."));
const ID_UUID = z.uuid();

// ───────────────────────── Evento sanitario (vacuna, desparasitación, tratamiento…) ─────────────────────────
const esquemaEvento = z.object({
  tipo: z.enum(TIPOS_EVENTO as [string, ...string[]], "Elige qué se hizo."),
  fecha: z.iso.date("Indica la fecha."),
  producto_id: opcional(z.string()),
  producto_nombre: opcional(z.string().trim().max(120, "El nombre del producto es muy largo.")),
  lote_producto: opcional(z.string().trim().max(60, "El lote es muy largo.")),
  fecha_vencimiento: opcional(z.iso.date("La fecha de vencimiento del lote no es válida.")),
  dosis: numero(z.coerce.number("La dosis debe ser un número.").positive("La dosis debe ser mayor que cero.").max(99999)),
  unidad_dosis: opcional(z.string().trim().max(20)),
  via: opcional(z.enum(VIAS as [string, ...string[]])),
  responsable: opcional(z.string().trim().max(120, "El nombre del responsable es muy largo.")),
  costo: numero(z.coerce.number("El costo debe ser un número.").min(0, "El costo no puede ser negativo.").max(9_999_999_999)),
  retiro_leche_dias: dias("Los días de retiro de la leche deben ser un número entero."),
  retiro_carne_dias: dias("Los días de retiro de la carne deben ser un número entero."),
  diagnostico: opcional(z.string().trim().max(300, "El diagnóstico es muy largo.")),
  observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
  proxima_fecha: opcional(z.iso.date("La fecha de la próxima dosis no es válida.")),
  client_request_id: opcional(z.uuid()),
  evento_id: opcional(z.uuid()),
  animal: opcional(z.uuid()),
  /** Si el evento aplica una programación, la que se marca como aplicada para estos animales. */
  programa_id: opcional(z.uuid()),
});

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Valida el formulario de un evento y lo deja listo para la base: resuelve el producto elegido y verifica las fechas y los animales. */
async function leerEvento(form: FormData, fincaId: string, supabase: Cliente) {
  const datos = esquemaEvento.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;

  const ids = [...new Set(form.getAll("animal_id").map(String))];
  if (ids.length === 0) return { error: "Elige al menos un animal." } as const;
  if (ids.length > 1000) return { error: "Son demasiados animales a la vez (máximo 1000)." } as const;
  if (!ids.every((i) => ID_UUID.safeParse(i).success)) return { error: "Hay un animal que no es válido. Elígelos de nuevo." } as const;
  if (d.fecha > hoyBogota()) return { error: "La fecha no puede ser futura: registra lo que ya se hizo." } as const;
  if (d.proxima_fecha && d.proxima_fecha <= d.fecha) return { error: "La próxima dosis debe ser después de la fecha de esta aplicación." } as const;

  // Si se eligió un producto del catálogo, el nombre se copia: el registro sigue siendo legible aunque el producto se elimine después.
  let productoId: string | undefined;
  let nombre = d.producto_nombre;
  if (d.producto_id && d.producto_id !== "otro") {
    if (!ID_UUID.safeParse(d.producto_id).success) return { error: "El producto no es válido." } as const;
    const { data: p } = await supabase.from("productos_veterinarios").select("id, nombre").eq("id", d.producto_id).eq("finca_id", fincaId).maybeSingle();
    if (!p) return { error: "No encontramos ese producto. Elígelo de nuevo." } as const;
    productoId = p.id;
    nombre = p.nombre;
  }
  if (EVENTO_CON_PRODUCTO.includes(d.tipo as never) && !nombre) return { error: "Indica el producto que se aplicó." } as const;

  const payload = {
    fecha: d.fecha,
    tipo: d.tipo,
    producto_id: productoId ?? "",
    producto_nombre: nombre ?? "",
    lote_producto: d.lote_producto ?? "",
    fecha_vencimiento: d.fecha_vencimiento ?? "",
    dosis: d.dosis ?? "",
    unidad_dosis: d.dosis ? (d.unidad_dosis ?? "") : "",
    via: d.via ?? "",
    responsable: d.responsable ?? "",
    costo: d.costo ?? "",
    retiro_leche_dias: d.retiro_leche_dias,
    retiro_carne_dias: d.retiro_carne_dias,
    diagnostico: d.diagnostico ?? "",
    observaciones: d.observaciones ?? "",
    proxima_fecha: d.proxima_fecha ?? "",
    client_request_id: d.client_request_id ?? "",
  };
  return { payload, ids, animal: d.animal, eventoId: d.evento_id, programaId: d.programa_id } as const;
}

function revalidarSanidad(animales: string[]) {
  revalidatePath("/sanidad");
  revalidatePath("/");
  revalidatePath("/leche");
  for (const a of animales.slice(0, 50)) revalidatePath(`/hato/${a}`);
}

export async function crearEvento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para registrar sanidad en esta finca." };
  const supabase = await crearClienteServidor();
  const leido = await leerEvento(form, finca.id, supabase);
  if ("error" in leido) return { error: leido.error };

  const { data, error } = await supabase.rpc("guardar_evento_sanitario", { p_finca: finca.id, p_evento: null, p_datos: leido.payload, p_animales: leido.ids });
  let id = data;
  if (error) {
    // Doble toque: la misma solicitud ya se guardó (client_request_id único) → seguimos al registro.
    if (error.code === "23505" && leido.payload.client_request_id) {
      const previo = await supabase.from("eventos_sanitarios").select("id").eq("finca_id", finca.id).eq("client_request_id", leido.payload.client_request_id).maybeSingle();
      id = previo.data?.id ?? null;
    }
    if (!id) return { error: mensajeAmigable(error.message) };
  }

  // Si el evento aplica una programación, esos animales quedan como aplicados en ella.
  if (leido.programaId && id) {
    await vincularPrograma(supabase, finca.id, leido.programaId, id, leido.ids);
    revalidatePath("/hato");
  }
  revalidarSanidad(leido.ids);
  redirect(leido.animal ? `/hato/${leido.animal}?guardado=1#sanidad` : leido.programaId ? `${DIRECCION_SANIDAD}&guardado=1` : `/sanidad/evento/${id}?guardado=1`);
}

/** Corrige un evento: sus datos y la lista de animales que lo recibieron. Lo que se deja vacío queda vacío. */
export async function editarEvento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para editar sanidad en esta finca." };
  const supabase = await crearClienteServidor();
  const leido = await leerEvento(form, finca.id, supabase);
  if ("error" in leido) return { error: leido.error };
  if (!leido.eventoId) return { error: "No encontramos ese registro." };

  // Los animales que salen del evento también cambian su ficha.
  const { data: antes } = await supabase.from("evento_sanitario_animales").select("animal_id").eq("evento_id", leido.eventoId).eq("finca_id", finca.id).limit(1000);
  const { error } = await supabase.rpc("guardar_evento_sanitario", { p_finca: finca.id, p_evento: leido.eventoId, p_datos: leido.payload, p_animales: leido.ids });
  if (error) return { error: mensajeAmigable(error.message) };

  revalidarSanidad([...leido.ids, ...(antes ?? []).map((a) => a.animal_id)]);
  revalidatePath(`/sanidad/evento/${leido.eventoId}`);
  redirect(`/sanidad/evento/${leido.eventoId}?guardado=1`);
}

/** Elimina un evento con su lista de animales. Solo propietario o administrador. Los retiros que daba dejan de aplicar. */
export async function eliminarEvento(eventoId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar registros de sanidad." };
  if (!ID_UUID.safeParse(eventoId).success) return { ok: false, error: "Registro no válido." };
  const supabase = await crearClienteServidor();
  const { data: animales } = await supabase.from("evento_sanitario_animales").select("animal_id").eq("evento_id", eventoId).eq("finca_id", finca.id).limit(1000);
  const { data, error } = await supabase.from("eventos_sanitarios").delete().eq("id", eventoId).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese registro." };
  revalidarSanidad((animales ?? []).map((a) => a.animal_id));
  return { ok: true };
}

// ───────────────────────── Productos veterinarios ─────────────────────────
const esquemaProducto = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre del producto.").max(120, "El nombre es muy largo."),
  tipo: z.enum(TIPOS_PRODUCTO as [string, ...string[]], "Elige qué tipo de producto es."),
  registro_ica: opcional(z.string().trim().max(40, "El registro ICA es muy largo.")),
  retiro_leche_dias: dias("Los días de retiro de la leche deben ser un número entero."),
  retiro_carne_dias: dias("Los días de retiro de la carne deben ser un número entero."),
  unidad_dosis: opcional(z.string().trim().max(20)),
  activo: z.preprocess((v) => v !== "false" && v !== "off", z.boolean()),
});

const MENSAJE_PRODUCTO_REPETIDO = "Ya tienes un producto con ese nombre.";

export async function crearProducto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para registrar productos en esta finca." };
  const datos = esquemaProducto.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("productos_veterinarios").insert({
    finca_id: finca.id,
    nombre: d.nombre,
    tipo: d.tipo as never,
    registro_ica: d.registro_ica ?? null,
    retiro_leche_dias: d.retiro_leche_dias,
    retiro_carne_dias: d.retiro_carne_dias,
    unidad_dosis: d.unidad_dosis ?? null,
    activo: true,
  });
  if (error) return { error: error.code === "23505" ? MENSAJE_PRODUCTO_REPETIDO : mensajeAmigable(error.message) };
  revalidatePath("/sanidad");
  redirect("/sanidad?vista=productos&guardado=1");
}

const esquemaEdicionProducto = esquemaProducto.extend({ producto_id: z.uuid() });

export async function editarProducto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para editar productos en esta finca." };
  const datos = esquemaEdicionProducto.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("productos_veterinarios")
    .update({
      nombre: d.nombre,
      tipo: d.tipo as never,
      registro_ica: d.registro_ica ?? null,
      retiro_leche_dias: d.retiro_leche_dias,
      retiro_carne_dias: d.retiro_carne_dias,
      unidad_dosis: d.unidad_dosis ?? null,
      activo: d.activo,
    })
    .eq("id", d.producto_id)
    .eq("finca_id", finca.id)
    .select("id");
  if (error) return { error: error.code === "23505" ? MENSAJE_PRODUCTO_REPETIDO : mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos ese producto." };
  revalidatePath("/sanidad");
  redirect("/sanidad?vista=productos&guardado=1");
}

/** Elimina un producto del catálogo. Los registros que lo usaron conservan su nombre. Solo propietario o administrador. */
export async function eliminarProducto(productoId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar productos." };
  if (!ID_UUID.safeParse(productoId).success) return { ok: false, error: "Producto no válido." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("productos_veterinarios").delete().eq("id", productoId).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese producto." };
  revalidatePath("/sanidad");
  return { ok: true };
}

// ───────────────────────── Pruebas diagnósticas (de un animal) ─────────────────────────
const esquemaPrueba = z.object({
  animal_id: z.uuid("Elige el animal."),
  prueba: z.enum(TIPOS_PRUEBA as [string, ...string[]], "Elige qué prueba se hizo."),
  fecha: z.iso.date("Indica la fecha."),
  resultado: z.enum(RESULTADOS_PRUEBA as [string, ...string[]], "Elige el resultado."),
  laboratorio: opcional(z.string().trim().max(120, "El nombre del laboratorio es muy largo.")),
  soporte_path: opcional(z.string().max(200)),
  observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
  client_request_id: opcional(z.uuid()),
});

export async function crearPrueba(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para registrar pruebas en esta finca." };
  const datos = esquemaPrueba.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  if (d.fecha > hoyBogota()) return { error: "La fecha no puede ser futura." };
  if (!soporteValido(d.soporte_path, finca.id, "sanidad")) return { error: "El documento no es válido. Adjúntalo de nuevo." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("pruebas_sanitarias").insert({
    finca_id: finca.id,
    animal_id: d.animal_id,
    prueba: d.prueba as never,
    fecha: d.fecha,
    resultado: d.resultado as never,
    laboratorio: d.laboratorio ?? null,
    soporte_path: d.soporte_path ?? null,
    observaciones: d.observaciones ?? null,
    client_request_id: d.client_request_id ?? null,
  });
  // Doble toque: ya se guardó.
  if (error && !(error.code === "23505" && /client_req/.test(error.message))) return { error: mensajeAmigable(error.message) };

  revalidatePath("/sanidad");
  revalidatePath(`/hato/${d.animal_id}`);
  redirect(`/hato/${d.animal_id}?guardado=1#sanidad`);
}

const esquemaEdicionPrueba = esquemaPrueba.omit({ client_request_id: true }).extend({ prueba_id: z.uuid() });

export async function editarPrueba(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para editar pruebas en esta finca." };
  const datos = esquemaEdicionPrueba.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  if (d.fecha > hoyBogota()) return { error: "La fecha no puede ser futura." };
  if (!soporteValido(d.soporte_path, finca.id, "sanidad")) return { error: "El documento no es válido. Adjúntalo de nuevo." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("pruebas_sanitarias")
    .update({ prueba: d.prueba as never, fecha: d.fecha, resultado: d.resultado as never, laboratorio: d.laboratorio ?? null, soporte_path: d.soporte_path ?? null, observaciones: d.observaciones ?? null })
    .eq("id", d.prueba_id)
    .eq("finca_id", finca.id)
    .eq("animal_id", d.animal_id)
    .select("id");
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos esa prueba." };

  revalidatePath("/sanidad");
  revalidatePath(`/hato/${d.animal_id}`);
  redirect(`/hato/${d.animal_id}?guardado=1#sanidad`);
}

/** Elimina una prueba. Solo propietario o administrador. Devuelve el animal al que pertenecía. */
export async function eliminarPrueba(pruebaId: string): Promise<{ ok: true; animalId: string } | { ok: false; error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede eliminar pruebas." };
  if (!ID_UUID.safeParse(pruebaId).success) return { ok: false, error: "Prueba no válida." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("pruebas_sanitarias").delete().eq("id", pruebaId).eq("finca_id", finca.id).select("animal_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa prueba." };
  revalidatePath("/sanidad");
  revalidatePath(`/hato/${data[0].animal_id}`);
  return { ok: true, animalId: data[0].animal_id };
}


// ───────────────────────── FAMACHA (de un animal) ─────────────────────────
const esquemaFamacha = z.object({
  animal_id: z.uuid("Elige el animal."),
  fecha: z.iso.date("Indica la fecha."),
  puntaje: z.coerce.number("Elige el puntaje FAMACHA (1 a 5).").int("Elige el puntaje FAMACHA (1 a 5).").min(1, "Elige el puntaje FAMACHA (1 a 5).").max(5, "Elige el puntaje FAMACHA (1 a 5)."),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
});
const esquemaEdicionFamacha = esquemaFamacha.extend({ evaluacion_id: z.uuid() });
const FAMACHA_REPETIDA = "Ya registraste una evaluación FAMACHA de este animal en esa fecha. Edítala o elige otra fecha.";

export async function crearFamacha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para registrar sanidad en esta finca." };
  const datos = esquemaFamacha.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  if (d.fecha > hoyBogota()) return { error: "La fecha no puede ser futura." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("evaluaciones_famacha").insert({ finca_id: finca.id, animal_id: d.animal_id, fecha: d.fecha, puntaje: d.puntaje, observaciones: d.observaciones ?? null });
  if (error?.code === "23505") return { error: FAMACHA_REPETIDA };
  if (error) return { error: mensajeAmigable(error.message) };
  revalidatePath("/sanidad");
  revalidatePath("/hato");
  revalidatePath(`/hato/${d.animal_id}`);
  redirect(`/hato/${d.animal_id}?guardado=1#sanidad`);
}

export async function editarFamacha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para editar sanidad en esta finca." };
  const datos = esquemaEdicionFamacha.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  if (d.fecha > hoyBogota()) return { error: "La fecha no puede ser futura." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("evaluaciones_famacha")
    .update({ fecha: d.fecha, puntaje: d.puntaje, observaciones: d.observaciones ?? null })
    .eq("id", d.evaluacion_id)
    .eq("finca_id", finca.id)
    .eq("animal_id", d.animal_id)
    .select("id");
  if (error?.code === "23505") return { error: FAMACHA_REPETIDA };
  if (error) return { error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { error: "No encontramos esa evaluación." };
  revalidatePath("/sanidad");
  revalidatePath("/hato");
  revalidatePath(`/hato/${d.animal_id}`);
  redirect(`/hato/${d.animal_id}?guardado=1#sanidad`);
}

export async function eliminarFamacha(evaluacionId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { ok: false, error: "No tienes permiso para eliminar evaluaciones en esta finca." };
  if (!ID_UUID.safeParse(evaluacionId).success) return { ok: false, error: "Evaluación no válida." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("evaluaciones_famacha").delete().eq("id", evaluacionId).eq("finca_id", finca.id).select("animal_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa evaluación." };
  revalidatePath("/sanidad");
  revalidatePath("/hato");
  revalidatePath(`/hato/${data[0].animal_id}`);
  return { ok: true };
}

// ───────────────────────── Programación sanitaria ─────────────────────────
const esquemaPrograma = z.object({
  tipo: z.enum(TIPOS_PROGRAMABLES as [string, ...string[]], "Elige qué se va a aplicar."),
  fecha_programada: z.iso.date("Indica para cuándo se programa."),
  producto_id: opcional(z.string()),
  producto_nombre: opcional(z.string().trim().max(120, "El nombre del producto es muy largo.")),
  dosis: numero(z.coerce.number("La dosis debe ser un número.").positive("La dosis debe ser mayor que cero.").max(99999)),
  unidad_dosis: opcional(z.string().trim().max(20)),
  via: opcional(z.enum(VIAS as [string, ...string[]])),
  retiro_leche_dias: dias("Los días de retiro de la leche deben ser un número entero."),
  retiro_carne_dias: dias("Los días de retiro de la carne deben ser un número entero."),
  observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
  client_request_id: opcional(z.uuid()),
  programa_id: opcional(z.uuid()),
  animal: opcional(z.uuid()),
});

/** Valida el formulario de una programación y deja listo lo que se manda a la base. */
async function leerPrograma(form: FormData, fincaId: string, supabase: Cliente, creando: boolean) {
  const datos = esquemaPrograma.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const ids = [...new Set(form.getAll("animal_id").map(String))];
  if (ids.length === 0) return { error: "Elige al menos un animal." } as const;
  if (ids.length > 1000) return { error: "Son demasiados animales a la vez (máximo 1000)." } as const;
  if (!ids.every((i) => ID_UUID.safeParse(i).success)) return { error: "Hay un animal que no es válido. Elígelos de nuevo." } as const;
  const hoy = hoyBogota();
  if (creando && d.fecha_programada < hoy) return { error: "La fecha programada no puede ser anterior a hoy. Si ya se aplicó, regístralo como aplicado." } as const;
  if (d.fecha_programada > sumarDias(hoy, 730)) return { error: "La fecha programada no puede estar a más de dos años." } as const;

  const prod = await resolverProducto(supabase, fincaId, d.producto_id, d.producto_nombre);
  if ("error" in prod) return { error: prod.error } as const;
  if (EVENTO_CON_PRODUCTO.includes(d.tipo as never) && !prod.nombre) return { error: "Indica el producto que se va a aplicar." } as const;

  const payload = {
    tipo: d.tipo,
    fecha_programada: d.fecha_programada,
    producto_id: prod.id ?? "",
    producto_nombre: prod.nombre ?? "",
    dosis: d.dosis ?? "",
    unidad_dosis: d.dosis ? (d.unidad_dosis ?? "") : "",
    via: d.via ?? "",
    retiro_leche_dias: d.retiro_leche_dias,
    retiro_carne_dias: d.retiro_carne_dias,
    observaciones: d.observaciones ?? "",
    client_request_id: d.client_request_id ?? "",
  };
  return { payload, ids, animal: d.animal, programaId: d.programa_id } as const;
}

/** Si se eligió un producto del catálogo, su nombre se copia: el registro sigue siendo legible aunque el producto se elimine después. */
async function resolverProducto(supabase: Cliente, fincaId: string, productoId: string | undefined, nombre: string | undefined) {
  if (productoId && productoId !== "otro") {
    if (!ID_UUID.safeParse(productoId).success) return { error: "El producto no es válido." } as const;
    const { data: p } = await supabase.from("productos_veterinarios").select("id, nombre").eq("id", productoId).eq("finca_id", fincaId).maybeSingle();
    if (!p) return { error: "No encontramos ese producto. Elígelo de nuevo." } as const;
    return { id: p.id, nombre: p.nombre } as const;
  }
  return { id: undefined, nombre } as const;
}

/** Marca como aplicados, en la programación, a los animales que cubrió el evento recién registrado. */
async function vincularPrograma(supabase: Cliente, fincaId: string, programaId: string, eventoId: string, animales: string[]) {
  for (let i = 0; i < animales.length; i += 100) {
    await supabase
      .from("programa_sanitario_animales")
      .update({ evento_id: eventoId })
      .eq("programa_id", programaId)
      .eq("finca_id", fincaId)
      .is("evento_id", null)
      .in("animal_id", animales.slice(i, i + 100));
  }
}

function revalidarPrograma(animales: string[]) {
  revalidatePath("/hato");
  revalidatePath("/sanidad");
  revalidatePath("/");
  for (const a of animales.slice(0, 50)) revalidatePath(`/hato/${a}`);
}

export async function programarSanidad(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para programar sanidad en esta finca." };
  const supabase = await crearClienteServidor();
  const leido = await leerPrograma(form, finca.id, supabase, true);
  if ("error" in leido) return { error: leido.error };

  const { data, error } = await supabase.rpc("guardar_programa_sanitario", { p_finca: finca.id, p_programa: null, p_datos: leido.payload, p_animales: leido.ids });
  if (error && !(error.code === "23505" && leido.payload.client_request_id)) return { error: mensajeAmigable(error.message) };
  // Doble toque: la misma solicitud ya se guardó (client_request_id único) → seguimos como si fuera esta.
  revalidarPrograma(leido.ids);
  void data;
  redirect(leido.animal ? `/hato/${leido.animal}?guardado=1#sanidad` : `${DIRECCION_SANIDAD}&guardado=1`);
}

/** Corrige una programación: sus datos y los animales pendientes (los ya aplicados no se tocan). */
export async function editarPrograma(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { error: "No tienes permiso para editar sanidad en esta finca." };
  const supabase = await crearClienteServidor();
  const leido = await leerPrograma(form, finca.id, supabase, false);
  if ("error" in leido) return { error: leido.error };
  if (!leido.programaId) return { error: "No encontramos esa programación." };

  const { error } = await supabase.rpc("guardar_programa_sanitario", { p_finca: finca.id, p_programa: leido.programaId, p_datos: leido.payload, p_animales: leido.ids });
  if (error) return { error: mensajeAmigable(error.message) };

  // Los pendientes que ya no van se quitan de la programación (por tramos: la dirección de la consulta tiene largo máximo).
  const { data: actuales } = await supabase.from("programa_sanitario_animales").select("animal_id").eq("programa_id", leido.programaId).eq("finca_id", finca.id).is("evento_id", null).limit(2000);
  const sobran = (actuales ?? []).map((a) => a.animal_id).filter((a) => !leido.ids.includes(a));
  for (let i = 0; i < sobran.length; i += 100) {
    await supabase.from("programa_sanitario_animales").delete().eq("programa_id", leido.programaId).eq("finca_id", finca.id).is("evento_id", null).in("animal_id", sobran.slice(i, i + 100));
  }
  revalidarPrograma([...leido.ids, ...sobran]);
  redirect(`${DIRECCION_SANIDAD}&guardado=1`);
}

/** Cancela una programación (queda en el historial, pero ya no pide aplicarse). */
export async function cancelarPrograma(programaId: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad", finca.plan)) return { ok: false, error: "No tienes permiso para cancelar programaciones en esta finca." };
  if (!ID_UUID.safeParse(programaId).success) return { ok: false, error: "Programación no válida." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("programas_sanitarios").update({ cancelado_en: new Date().toISOString() }).eq("id", programaId).eq("finca_id", finca.id).is("cancelado_en", null).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa programación o ya estaba cancelada." };
  revalidarPrograma([]);
  return { ok: true };
}
