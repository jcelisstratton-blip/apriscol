"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, puedeGestionar } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { MAX_CRIAS, METODOS_DIAGNOSTICO, RESULTADOS_DIAGNOSTICO, TIPOS_PARTO, TIPOS_SERVICIO } from "@/lib/reproduccion";
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
  semen_lote: texto(60, "El lote de semen es muy largo."),
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
  const h = await hembraActiva(supabase, fincaId, d.hembra_id);
  if ("error" in h) return { error: h.error } as const;
  if (h.hembra.fecha_nacimiento && d.fecha <= h.hembra.fecha_nacimiento) return { error: "El servicio debe ser posterior al nacimiento de la hembra." } as const;
  if (d.macho_id) {
    const { data: m } = await supabase.from("animales").select("id, sexo, especie").eq("id", d.macho_id).eq("finca_id", fincaId).is("deleted_at", null).maybeSingle();
    if (!m || m.sexo !== "macho") return { error: "El reproductor debe ser un macho de tu hato." } as const;
    if (m.especie !== h.hembra.especie) return { error: "El reproductor debe ser de la misma especie que la hembra." } as const;
  }
  return {
    d,
    fila: {
      fecha: d.fecha,
      tipo: d.tipo as never,
      macho_id: d.macho_id ?? null,
      macho_externo: d.macho_externo ?? null,
      // El lote de semen solo aplica a inseminación y transferencia.
      semen_lote: d.tipo === "monta_natural" ? null : (d.semen_lote ?? null),
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
const esquemaDiagnostico = z.object({
  hembra_id: z.uuid("Elige la hembra."),
  fecha: z.iso.date("Indica la fecha del diagnóstico."),
  metodo: z.enum(METODOS_DIAGNOSTICO as [string, ...string[]], "Elige cómo se hizo."),
  resultado: z.enum(RESULTADOS_DIAGNOSTICO as [string, ...string[]], "Elige el resultado."),
  servicio_id: opcional(z.uuid()),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  diagnostico_id: opcional(z.uuid()),
});

async function leerDiagnostico(form: FormData, fincaId: string, supabase: Cliente) {
  const datos = esquemaDiagnostico.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  const h = await hembraActiva(supabase, fincaId, d.hembra_id);
  if ("error" in h) return { error: h.error } as const;
  if (d.servicio_id) {
    const { data: s } = await supabase.from("servicios").select("id, fecha").eq("id", d.servicio_id).eq("finca_id", fincaId).eq("hembra_id", d.hembra_id).maybeSingle();
    if (!s) return { error: "No encontramos el servicio al que corresponde este diagnóstico." } as const;
    if (d.fecha < s.fecha) return { error: "El diagnóstico no puede ser anterior al servicio." } as const;
  }
  return {
    d,
    fila: { fecha: d.fecha, metodo: d.metodo as never, resultado: d.resultado as never, servicio_id: d.servicio_id ?? null, observaciones: d.observaciones ?? null },
  } as const;
}

export async function crearDiagnostico(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("registrar diagnósticos");
  if (!p.ok) return { error: p.error };
  const supabase = await crearClienteServidor();
  const l = await leerDiagnostico(form, p.finca.id, supabase);
  if ("error" in l) return { error: l.error };
  const { error } = await supabase.from("diagnosticos_gestacion").insert({ finca_id: p.finca.id, hembra_id: l.d.hembra_id, ...l.fila });
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

const esquemaParto = z.object({
  madre_id: z.uuid("Elige la hembra."),
  fecha: z.iso.date("Indica la fecha del parto."),
  tipo: z.enum(TIPOS_PARTO as [string, ...string[]], "Elige qué pasó."),
  servicio_id: opcional(z.uuid()),
  complicaciones: texto(500, "Las complicaciones son muy largas."),
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

  const { data: parto, error } = await supabase
    .from("partos")
    .insert({ finca_id: p.finca.id, madre_id: d.madre_id, servicio_id: servicio?.id ?? null, fecha: d.fecha, tipo: d.tipo as never, numero_crias: c.crias.length, complicaciones: d.complicaciones ?? null, client_request_id: d.client_request_id ?? null })
    .select("id")
    .maybeSingle();
  // Doble toque: este parto ya se guardó con sus crías; no se repite.
  if (error && esRepetido(error)) redirect(destinoFicha(d.madre_id));
  if (error || !parto) return { error: mensajeAmigable(error?.message ?? "No se pudo guardar el parto.") };

  const filasCrias: { finca_id: string; parto_id: string; animal_id: string | null; sexo: "hembra" | "macho" | null; peso_nacer_kg: number | null; vivo: boolean }[] = [];
  const fallos: string[] = [];
  for (const x of c.crias) {
    let animalId: string | null = null;
    if (x.arete) {
      const { data: nuevo, error: e } = await supabase
        .from("animales")
        .insert({
          finca_id: p.finca.id,
          especie: h.hembra.especie,
          numero_arete: x.arete,
          nombre: x.nombre || null,
          sexo: x.sexo!,
          origen: "nacido_en_finca",
          fecha_nacimiento: d.fecha,
          fecha_nacimiento_aprox: false,
          madre_id: d.madre_id,
          padre_id: servicio?.macho_id ?? null,
          padre_externo: servicio?.macho_externo ?? null,
          vocacion: x.sexo === "macho" ? "carne" : h.hembra.vocacion,
          peso_nacer_kg: x.peso ?? null,
        })
        .select("id")
        .maybeSingle();
      if (e || !nuevo) fallos.push(x.arete);
      else animalId = nuevo.id;
    }
    filasCrias.push({ finca_id: p.finca.id, parto_id: parto.id, animal_id: animalId, sexo: x.sexo ?? null, peso_nacer_kg: x.peso ?? null, vivo: x.vivo });
  }
  if (filasCrias.length) {
    const { error: eCrias } = await supabase.from("crias").insert(filasCrias);
    if (eCrias) return { error: `El parto quedó registrado, pero no se pudieron guardar las crías: ${mensajeAmigable(eCrias.message)}` };
  }

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
  complicaciones: texto(500, "Las complicaciones son muy largas."),
});

/** Corrige la fecha, el tipo y las complicaciones de un parto. Pasar de aborto a parto (o al revés) cambia la lactancia: en ese caso se elimina y se registra de nuevo. */
export async function editarParto(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const p = await permiso("editar partos");
  if (!p.ok) return { error: p.error };
  const datos = esquemaEdicionParto.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura };
  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase.from("partos").select("id, tipo, servicio_id").eq("id", d.parto_id).eq("finca_id", p.finca.id).eq("madre_id", d.madre_id).maybeSingle();
  if (!actual) return { error: "No encontramos ese parto." };
  if ((actual.tipo === "aborto") !== (d.tipo === "aborto")) return { error: "No se puede cambiar un parto a aborto (ni al revés): elimina el registro y créalo de nuevo." };
  const { error } = await supabase.from("partos").update({ fecha: d.fecha, tipo: d.tipo as never, complicaciones: d.complicaciones ?? null }).eq("id", d.parto_id).eq("finca_id", p.finca.id);
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
  const { data: parto } = await supabase.from("partos").select("id, madre_id").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!parto) return { ok: false, error: "No encontramos ese parto." };
  const { data: lactancias } = await supabase.from("lactancias").select("id").eq("parto_id", id).eq("finca_id", finca.id);
  for (const l of lactancias ?? []) {
    const { count } = await supabase.from("ordenos").select("id", { count: "exact", head: true }).eq("lactancia_id", l.id).eq("finca_id", finca.id);
    if ((count ?? 0) > 0) return { ok: false, error: "Este parto abrió una lactancia que ya tiene ordeños registrados, así que no se puede eliminar." };
  }
  if ((lactancias ?? []).length > 0) {
    const { error: eLac } = await supabase.from("lactancias").delete().eq("parto_id", id).eq("finca_id", finca.id);
    if (eLac) return { ok: false, error: mensajeAmigable(eLac.message) };
  }
  const { error } = await supabase.from("partos").delete().eq("id", id).eq("finca_id", finca.id);
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  revalidatePath("/reproduccion");
  revalidatePath("/leche");
  revalidatePath(`/hato/${parto.madre_id}`);
  return { ok: true, destino: `/hato/${parto.madre_id}#reproduccion` };
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
