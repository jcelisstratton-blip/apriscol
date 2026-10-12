"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { EVENTO_CON_PRODUCTO, RESULTADOS_PRUEBA, TIPOS_EVENTO, TIPOS_PRODUCTO, TIPOS_PRUEBA, VIAS } from "@/lib/sanidad";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacio, s.optional());
const numero = (s: z.ZodType<number>) => z.preprocess((v) => (typeof v === "string" ? v.replace(",", ".") : v), opcional(s));
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
  return { payload, ids, animal: d.animal, eventoId: d.evento_id } as const;
}

function revalidarSanidad(animales: string[]) {
  revalidatePath("/sanidad");
  revalidatePath("/");
  revalidatePath("/leche");
  for (const a of animales.slice(0, 50)) revalidatePath(`/hato/${a}`);
}

export async function crearEvento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad")) return { error: "No tienes permiso para registrar sanidad en esta finca." };
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

  revalidarSanidad(leido.ids);
  redirect(leido.animal ? `/hato/${leido.animal}?guardado=1#sanidad` : `/sanidad/evento/${id}?guardado=1`);
}

/** Corrige un evento: sus datos y la lista de animales que lo recibieron. Lo que se deja vacío queda vacío. */
export async function editarEvento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad")) return { error: "No tienes permiso para editar sanidad en esta finca." };
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
  if (!puedeEscribir(rol, "sanidad")) return { error: "No tienes permiso para registrar productos en esta finca." };
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
  if (!puedeEscribir(rol, "sanidad")) return { error: "No tienes permiso para editar productos en esta finca." };
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
  observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
  client_request_id: opcional(z.uuid()),
});

export async function crearPrueba(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "sanidad")) return { error: "No tienes permiso para registrar pruebas en esta finca." };
  const datos = esquemaPrueba.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  if (d.fecha > hoyBogota()) return { error: "La fecha no puede ser futura." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("pruebas_sanitarias").insert({
    finca_id: finca.id,
    animal_id: d.animal_id,
    prueba: d.prueba as never,
    fecha: d.fecha,
    resultado: d.resultado as never,
    laboratorio: d.laboratorio ?? null,
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
  if (!puedeEscribir(rol, "sanidad")) return { error: "No tienes permiso para editar pruebas en esta finca." };
  const datos = esquemaEdicionPrueba.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;
  if (d.fecha > hoyBogota()) return { error: "La fecha no puede ser futura." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("pruebas_sanitarias")
    .update({ prueba: d.prueba as never, fecha: d.fecha, resultado: d.resultado as never, laboratorio: d.laboratorio ?? null, observaciones: d.observaciones ?? null })
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
