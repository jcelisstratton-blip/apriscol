"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import { motivoBloqueoIdentidad } from "@/lib/animal-historia";
import { TIPOS_FOTO } from "@/lib/ferias";

export type EstadoAnimal = { error?: string } | undefined;

const vacio = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opcional = <T extends z.ZodType>(s: T) => z.preprocess(vacio, s.optional());

const esquema = z.object({
  especie: z.enum(["caprino", "ovino"]),
  numero_arete: z.string().trim().min(1, "El número de arete es obligatorio.").max(40),
  nombre: opcional(z.string().trim().max(60)),
  sexo: z.enum(["hembra", "macho"]),
  raza_id: opcional(z.coerce.number().int().positive()),
  fecha_nacimiento: opcional(z.iso.date("La fecha de nacimiento no es válida.")),
  fecha_nacimiento_aprox: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  padre_id: opcional(z.uuid()),
  madre_id: opcional(z.uuid()),
  padre_externo: opcional(z.string().trim().max(80)),
  madre_externa: opcional(z.string().trim().max(80)),
  origen: z.enum(["nacido_en_finca", "comprado"]),
  vocacion: z.enum(["leche", "carne", "doble"]),
  uso_macho: opcional(z.enum(["reproductor", "carne", "por_definir"])),
  chip: opcional(z.string().trim().max(40, "El microchip es muy largo.")),
  color: opcional(z.string().trim().max(60, "El color es muy largo.")),
  marcas: opcional(z.string().trim().max(120, "Las marcas son muy largas.")),
  rasgos: opcional(z.string().trim().max(200, "Los rasgos son muy largos.")),
  peso_nacer_kg: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(",", ".") : v),
    opcional(z.coerce.number("El peso al nacer debe ser un número.").min(0.1, "El peso al nacer debe estar entre 0,1 y 15 kg.").max(15, "El peso al nacer debe estar entre 0,1 y 15 kg.")),
  ),
  valor_compra: z.preprocess(
    (v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v),
    opcional(z.number("El valor debe ser un número, en pesos.").min(0, "El valor no puede ser negativo.").max(99_999_999_999, "El valor es demasiado grande. Revísalo.")),
  ),
  notas: opcional(z.string().trim().max(1000, "Las notas son muy largas.")),
  fecha_ultimo_parto: opcional(z.iso.date("La fecha del parto no es válida.")),
  foto_path: opcional(z.string().max(200)),
  client_request_id: opcional(z.uuid()),
});

/** La ruta de una foto de animal debe estar en la carpeta de esta finca (la base también lo exige). */
const fotoValida = (ruta: string | undefined, fincaId: string) => !ruta || new RegExp(`^${fincaId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(ruta);

/**
 * El servidor arma la ruta (<finca>/<uuid>.<ext>) y emite un permiso de subida de un solo uso para la foto de un animal.
 * Además, la política de Storage solo deja escribir en la carpeta de una finca donde la persona puede gestionar el hato.
 */
export async function prepararSubidaFotoAnimal(tipoMime: string): Promise<{ path: string; token: string } | { error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { error: "No tienes permiso para subir fotos en esta finca." };
  const ext = TIPOS_FOTO[tipoMime];
  if (!ext) return { error: "Usa una foto en formato JPG, PNG o WebP." };

  const path = `${finca.id}/${randomUUID()}.${ext}`;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from("fotos-animales").createSignedUploadUrl(path);
  if (error || !data) return { error: mensajeAmigable(error?.message ?? "No se pudo preparar la subida de la foto.") };
  return { path: data.path, token: data.token };
}

export async function crearAnimal(_: EstadoAnimal, form: FormData): Promise<EstadoAnimal> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { error: "No tienes permiso para registrar animales en esta finca." };

  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const { fecha_ultimo_parto, uso_macho, ...animal } = datos.data;
  // La aptitud de leche solo aplica a las hembras; un macho tiene, en cambio, un uso (reproductor, carne o por definir).
  if (animal.sexo === "macho") animal.vocacion = "carne";
  const usoMacho = animal.sexo === "macho" && uso_macho && uso_macho !== "por_definir" ? uso_macho : null;
  // El peso al nacer solo se conoce de los animales que nacieron en la finca.
  if (animal.origen === "comprado") animal.peso_nacer_kg = undefined;

  if (!finca.especies.includes(animal.especie)) return { error: "Esa especie no está activa en tu finca." };
  if (!fotoValida(animal.foto_path, finca.id)) return { error: "La foto no es válida. Súbela de nuevo." };
  if (fecha_ultimo_parto && animal.sexo !== "hembra") return { error: "Solo una hembra puede tener un parto." };
  if (fecha_ultimo_parto && animal.fecha_nacimiento && fecha_ultimo_parto <= animal.fecha_nacimiento) {
    return { error: "El parto debe ser posterior al nacimiento de la hembra." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("animales")
    .insert({ ...animal, uso_macho: usoMacho, finca_id: finca.id })
    .select("id")
    .single();

  let id = data?.id;
  if (error) {
    // Doble toque: la misma solicitud ya se guardó (client_request_id único) → seguimos a la ficha.
    if (error.code === "23505" && animal.client_request_id && /client_req/.test(error.message)) {
      const previo = await supabase
        .from("animales")
        .select("id")
        .eq("finca_id", finca.id)
        .eq("client_request_id", animal.client_request_id)
        .maybeSingle();
      id = previo.data?.id;
    }
    if (!id) return { error: mensajeAmigable(error.message) };
  }

  if (id && fecha_ultimo_parto) {
    const { error: eLac } = await supabase
      .from("lactancias")
      .insert({ finca_id: finca.id, animal_id: id, numero: 1, fecha_parto: fecha_ultimo_parto });
    if (eLac) return { error: `El animal quedó registrado, pero no se pudo abrir su lactancia: ${mensajeAmigable(eLac.message)}` };
  }

  revalidatePath("/hato");
  revalidatePath("/");
  redirect(`/hato/${id}`);
}

// ───────────────────────── Editar un animal ─────────────────────────
const esquemaEdicion = esquema.omit({ client_request_id: true, fecha_ultimo_parto: true }).extend({ animal_id: z.uuid() });

/** ¿El animal `candidato` desciende de `animalId`? Evita que, al editar, un animal quede como su propio ancestro. */
async function desciendeDe(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, fincaId: string, candidato: string, animalId: string): Promise<boolean> {
  let frontera = [candidato];
  const vistos = new Set<string>();
  for (let generacion = 0; generacion < 15 && frontera.length > 0; generacion++) {
    const { data } = await supabase.from("animales").select("id, padre_id, madre_id").eq("finca_id", fincaId).in("id", frontera);
    const siguientes: string[] = [];
    for (const a of data ?? []) {
      for (const p of [a.padre_id, a.madre_id]) {
        if (!p) continue;
        if (p === animalId) return true;
        if (!vistos.has(p)) {
          vistos.add(p);
          siguientes.push(p);
        }
      }
    }
    frontera = siguientes;
  }
  return false;
}

/**
 * Corrige los datos de un animal. Lo que la persona deja vacío queda vacío (no se conserva el valor anterior).
 * El sexo y la especie solo cambian si el animal no tiene historia que dependa de ellos.
 */
export async function editarAnimal(_: EstadoAnimal, form: FormData): Promise<EstadoAnimal> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { error: "No tienes permiso para editar animales en esta finca." };

  const datos = esquemaEdicion.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message };
  const d = datos.data;

  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase
    .from("animales")
    .select("id, especie, sexo, foto_path")
    .eq("id", d.animal_id)
    .eq("finca_id", finca.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!actual) return { error: "No encontramos ese animal en tu finca." };

  if (!finca.especies.includes(d.especie)) return { error: "Esa especie no está activa en tu finca." };
  if (!fotoValida(d.foto_path, finca.id)) return { error: "La foto no es válida. Súbela de nuevo." };
  if (d.padre_id === d.animal_id || d.madre_id === d.animal_id) return { error: "Un animal no puede ser su propio padre o madre." };
  if (d.padre_id && d.madre_id && d.padre_id === d.madre_id) return { error: "El padre y la madre no pueden ser el mismo animal." };

  if (d.especie !== actual.especie || d.sexo !== actual.sexo) {
    const bloqueo = await motivoBloqueoIdentidad(supabase, d.animal_id, finca.id);
    if (bloqueo) return { error: `No se puede cambiar el sexo ni la especie. ${bloqueo}` };
  }

  for (const padre of [d.padre_id, d.madre_id]) {
    if (padre && (await desciendeDe(supabase, finca.id, padre, d.animal_id))) {
      return { error: "Ese animal desciende de este, así que no puede ser su padre ni su madre." };
    }
  }

  const { error } = await supabase
    .from("animales")
    .update({
      especie: d.especie,
      sexo: d.sexo,
      numero_arete: d.numero_arete,
      nombre: d.nombre ?? null,
      chip: d.chip ?? null,
      raza_id: d.raza_id ?? null,
      color: d.color ?? null,
      marcas: d.marcas ?? null,
      rasgos: d.rasgos ?? null,
      fecha_nacimiento: d.fecha_nacimiento ?? null,
      fecha_nacimiento_aprox: d.fecha_nacimiento ? d.fecha_nacimiento_aprox : false,
      origen: d.origen,
      peso_nacer_kg: d.origen === "nacido_en_finca" ? (d.peso_nacer_kg ?? null) : null,
      valor_compra: d.valor_compra != null ? Math.round(d.valor_compra) : null,
      vocacion: d.sexo === "macho" ? "carne" : d.vocacion,
      uso_macho: d.sexo === "macho" && d.uso_macho && d.uso_macho !== "por_definir" ? d.uso_macho : null,
      padre_id: d.padre_id ?? null,
      madre_id: d.madre_id ?? null,
      padre_externo: d.padre_externo ?? null,
      madre_externa: d.madre_externa ?? null,
      notas: d.notas ?? null,
      foto_path: d.foto_path ?? null,
    })
    .eq("id", d.animal_id)
    .eq("finca_id", finca.id);
  if (error) return { error: mensajeAmigable(error.message) };

  // La foto anterior ya no se usa: se borra de Storage (si falla, solo queda un archivo suelto).
  if (actual.foto_path && actual.foto_path !== (d.foto_path ?? null)) await supabase.storage.from("fotos-animales").remove([actual.foto_path]);

  revalidatePath("/hato");
  revalidatePath(`/hato/${d.animal_id}`);
  revalidatePath("/leche");
  revalidatePath("/");
  redirect(`/hato/${d.animal_id}?guardado=1`);
}

// ───────────────────────── Bajas ─────────────────────────
export type ResultadoBaja = { ok: true; aviso?: string } | { ok: false; error: string };

const esquemaBaja = z.object({
  animalId: z.uuid(),
  tipo: z.enum(["venta", "sacrificio", "muerte", "perdida"], "Elige qué pasó con el animal."),
  fecha: z.iso.date("Indica la fecha."),
  motivo: z.preprocess(vacio, z.enum(["edad", "partos", "baja_produccion", "sanidad", "reproductivo", "accidente", "otro"]).optional()),
  comprador: z.preprocess(vacio, z.string().trim().max(160, "El nombre del comprador es muy largo.").optional()),
  valor: z.preprocess(vacio, z.number().min(0, "El valor no puede ser negativo.").max(9_999_999_999, "Revisa el valor: es demasiado alto.").optional()),
  destinoConsumo: z.boolean(),
  detalle: z.preprocess(vacio, z.string().trim().max(1000, "Las notas son muy largas.").optional()),
  // Trazabilidad de la salida comercial (venta o sacrificio): peso en vivo, guía de movilización y a dónde fue.
  pesoKg: z.preprocess(vacio, z.number("El peso debe ser un número.").positive("El peso debe ser mayor que cero.").max(250, "El peso no puede pasar de 250 kg.").optional()),
  guiaMovilizacion: z.preprocess(vacio, z.string().trim().max(60, "La guía de movilización es muy larga.").optional()),
  destino: z.preprocess(vacio, z.string().trim().max(160, "El destino es muy largo.").optional()),
});

/** La trazabilidad solo aplica a una salida comercial: una muerte o una pérdida no tienen guía, peso ni destino. */
const datosComerciales = (d: { tipo: string; pesoKg?: number; guiaMovilizacion?: string; destino?: string }) =>
  d.tipo === "venta" || d.tipo === "sacrificio"
    ? { peso_kg: d.pesoKg ?? null, guia_movilizacion: d.guiaMovilizacion ?? null, destino: d.destino ?? null }
    : { peso_kg: null, guia_movilizacion: null, destino: null };

/**
 * Da de baja a un animal (venta, muerte, sacrificio o pérdida). La base marca el estado y la fecha, y rechaza sacar para consumo
 * a un animal en retiro de carne. Si era una hembra en ordeño, también se cierra su lactancia con la fecha de la baja.
 */
export async function darDeBaja(entrada: z.input<typeof esquemaBaja>): Promise<ResultadoBaja> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { ok: false, error: "No tienes permiso para dar de baja animales en esta finca." };
  const datos = esquemaBaja.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Dato inválido." };
  const d = datos.data;
  if (d.fecha > hoyBogota()) return { ok: false, error: "La fecha no puede ser futura." };

  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase
    .from("animales")
    .select("id, estado, fecha_nacimiento")
    .eq("id", d.animalId)
    .eq("finca_id", finca.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!animal) return { ok: false, error: "No encontramos ese animal en tu finca." };
  if (animal.estado !== "activo") return { ok: false, error: "Ese animal ya está dado de baja." };
  if (animal.fecha_nacimiento && d.fecha < animal.fecha_nacimiento) return { ok: false, error: "La fecha no puede ser anterior al nacimiento del animal." };

  const esVenta = d.tipo === "venta";
  const { error } = await supabase.from("bajas").insert({
    finca_id: finca.id,
    animal_id: d.animalId,
    tipo: d.tipo,
    fecha: d.fecha,
    motivo: d.motivo ?? null,
    comprador: esVenta ? (d.comprador ?? null) : null,
    valor: esVenta ? (d.valor ?? null) : null,
    destino_consumo: esVenta && d.destinoConsumo,
    detalle: d.detalle ?? null,
    ...datosComerciales(d),
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ese animal ya tiene una baja registrada." };
    return { ok: false, error: mensajeAmigable(error.message) };
  }

  // Una hembra que sale del hato sale también del ordeño: se cierra su lactancia abierta.
  let aviso: string | undefined;
  const { data: lactancia } = await supabase
    .from("lactancias")
    .select("id, fecha_parto")
    .eq("animal_id", d.animalId)
    .eq("finca_id", finca.id)
    .is("fecha_secado", null)
    .maybeSingle();
  if (lactancia) {
    const { error: e } = await supabase
      .from("lactancias")
      .update({ fecha_secado: d.fecha > lactancia.fecha_parto ? d.fecha : lactancia.fecha_parto })
      .eq("id", lactancia.id);
    if (e) aviso = "La baja quedó registrada, pero no pudimos sacarla del ordeño. Hazlo desde Leche.";
  }

  revalidatePath("/hato");
  revalidatePath(`/hato/${d.animalId}`);
  revalidatePath("/leche");
  revalidatePath("/");
  return { ok: true, aviso };
}

/** Deshace una baja: el animal vuelve al hato como activo. Solo propietario o administrador. */
export async function deshacerBaja(animalId: string): Promise<ResultadoBaja> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeGestionar(rol)) return { ok: false, error: "Solo el propietario o un administrador puede deshacer una baja." };
  if (!z.uuid().safeParse(animalId).success) return { ok: false, error: "Animal no válido." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("bajas").delete().eq("animal_id", animalId).eq("finca_id", finca.id).select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos la baja de ese animal." };

  revalidatePath("/hato");
  revalidatePath(`/hato/${animalId}`);
  revalidatePath("/");
  return { ok: true };
}

// ───────────────────────── Programa del ordeño ─────────────────────────
const TURNO = z.enum(["manana", "tarde", "noche"]);
type ResultadoPrograma = { ok: true } | { ok: false; error: string };

/** Define en qué turnos se ordeña una hembra. Una lista vacía significa que por ahora no se ordeña en ningún turno. */
export async function programarOrdeno(animalId: string, turnos: string[]): Promise<ResultadoPrograma> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { ok: false, error: "No tienes permiso para programar el ordeño en esta finca." };
  const datos = z.object({ animalId: z.uuid(), turnos: z.array(TURNO).max(3) }).safeParse({ animalId, turnos });
  if (!datos.success) return { ok: false, error: "El turno no es válido." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("animales")
    .update({ turnos_ordeno: [...new Set(datos.data.turnos)] })
    .eq("id", datos.data.animalId)
    .eq("finca_id", finca.id)
    .eq("sexo", "hembra")
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa hembra." };
  revalidatePath("/hato");
  revalidatePath(`/hato/${animalId}`);
  revalidatePath("/leche");
  return { ok: true };
}

/** Prende o apaga un turno en todas las hembras que están en leche, sin tocar los otros turnos de cada una. */
export async function programarOrdenoLote(turno: string, activo: boolean): Promise<{ ok: true; afectadas: number } | { ok: false; error: string }> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { ok: false, error: "No tienes permiso para programar el ordeño en esta finca." };
  const t = TURNO.safeParse(turno);
  if (!t.success) return { ok: false, error: "El turno no es válido." };

  const supabase = await crearClienteServidor();
  const { data: lactancias } = await supabase.from("lactancias").select("animal_id").eq("finca_id", finca.id).is("fecha_secado", null);
  const ids = (lactancias ?? []).map((l) => l.animal_id);
  if (ids.length === 0) return { ok: true, afectadas: 0 };

  const actuales: { id: string; turnos_ordeno: string[] | null }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from("animales").select("id, turnos_ordeno").eq("finca_id", finca.id).eq("sexo", "hembra").eq("estado", "activo").is("deleted_at", null).in("id", ids.slice(i, i + 100));
    if (error) return { ok: false, error: mensajeAmigable(error.message) };
    actuales.push(...(data ?? []));
  }

  // Cada hembra queda con su lista nueva; las que quedan igual se agrupan para no hacer una consulta por animal.
  const grupos = new Map<string, string[]>();
  for (const a of actuales) {
    const hoy = new Set(a.turnos_ordeno ?? ["manana", "tarde", "noche"]);
    if (activo) hoy.add(t.data);
    else hoy.delete(t.data);
    const nueva = ["manana", "tarde", "noche"].filter((x) => hoy.has(x));
    const clave = nueva.join(",");
    grupos.set(clave, [...(grupos.get(clave) ?? []), a.id]);
  }
  for (const [clave, lista] of grupos) {
    for (let i = 0; i < lista.length; i += 100) {
      const { error } = await supabase
        .from("animales")
        .update({ turnos_ordeno: clave === "" ? [] : clave.split(",") })
        .eq("finca_id", finca.id)
        .in("id", lista.slice(i, i + 100));
      if (error) return { ok: false, error: mensajeAmigable(error.message) };
    }
  }
  revalidatePath("/hato");
  revalidatePath("/leche");
  return { ok: true, afectadas: actuales.length };
}

const esquemaSalida = z.object({
  animalId: z.uuid(),
  motivo: z.preprocess(vacio, z.enum(["edad", "partos", "baja_produccion", "sanidad", "reproductivo", "accidente", "otro"]).optional()),
  comprador: z.preprocess(vacio, z.string().trim().max(160, "El nombre del comprador es muy largo.").optional()),
  valor: z.preprocess(vacio, z.number("El valor debe ser un número.").min(0, "El valor no puede ser negativo.").max(9_999_999_999, "Revisa el valor: es demasiado alto.").optional()),
  detalle: z.preprocess(vacio, z.string().trim().max(1000, "Las notas son muy largas.").optional()),
  pesoKg: z.preprocess(vacio, z.number("El peso debe ser un número.").positive("El peso debe ser mayor que cero.").max(250, "El peso no puede pasar de 250 kg.").optional()),
  guiaMovilizacion: z.preprocess(vacio, z.string().trim().max(60, "La guía de movilización es muy larga.").optional()),
  destino: z.preprocess(vacio, z.string().trim().max(160, "El destino es muy largo.").optional()),
});

/**
 * Corrige los datos de una salida ya registrada: motivo, comprador, valor, peso en vivo, guía de movilización, destino y notas.
 * Qué pasó (venta, sacrificio…), la fecha y si fue para consumo no se cambian aquí: de eso depende el estado del animal y el control
 * del retiro de carne; si estaban mal, se deshace la baja y se registra de nuevo.
 */
export async function corregirSalida(entrada: z.input<typeof esquemaSalida>): Promise<ResultadoBaja> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "hato")) return { ok: false, error: "No tienes permiso para corregir salidas en esta finca." };
  const datos = esquemaSalida.safeParse(entrada);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Dato inválido." };
  const d = datos.data;
  const supabase = await crearClienteServidor();
  const { data: baja } = await supabase.from("bajas").select("id, tipo").eq("animal_id", d.animalId).eq("finca_id", finca.id).maybeSingle();
  if (!baja) return { ok: false, error: "No encontramos la salida de ese animal." };
  const { error } = await supabase
    .from("bajas")
    .update({
      motivo: d.motivo ?? null,
      detalle: d.detalle ?? null,
      comprador: baja.tipo === "venta" ? (d.comprador ?? null) : null,
      valor: baja.tipo === "venta" ? (d.valor ?? null) : null,
      ...datosComerciales({ tipo: baja.tipo, pesoKg: d.pesoKg, guiaMovilizacion: d.guiaMovilizacion, destino: d.destino }),
    })
    .eq("id", baja.id)
    .eq("finca_id", finca.id);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/carne");
  revalidatePath(`/hato/${d.animalId}`);
  return { ok: true };
}
