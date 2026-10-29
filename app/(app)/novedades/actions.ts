"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { atiendeNovedad, puedeVer, tiposNovedadQueCrea, type TipoNovedadPermiso } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { CUANDO_NOVEDAD, ESTADOS_NOVEDAD, TIPOS_NOVEDAD_NUEVA, faltaEnNovedad, fechaDeNovedad, type CuandoNovedad } from "@/lib/novedades";
import { GRUPO_DE, GRUPOS } from "@/lib/costos";
import { RESULTADOS_PRUEBA, TIPOS_EVENTO, TIPOS_PRUEBA, VIAS } from "@/lib/sanidad";
import { ANESTESIAS, CATEGORIAS, COJERAS, ETAPAS, MOTIVOS, REGLAS } from "@/lib/sanidad-campos";
import { TIPOS_MUESTRA } from "@/lib/coprologico";
import type { Novedad } from "@/lib/tipos";
import { opcional } from "@/lib/validacion";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const enumDe = (valores: readonly string[], mensaje: string) => z.enum(valores as [string, ...string[]], mensaje);

// Una novedad se arma solo eligiendo opciones: ningún campo es de texto libre.
const esquema = z.object({
  animal_id: opcional(z.uuid("Elige el animal.")),
  grupo_compra: opcional(enumDe(GRUPOS, "Elige el grupo de la compra.")),
  compra_producto_id: opcional(z.uuid()),
  tipo: enumDe(TIPOS_NOVEDAD_NUEVA, "Elige sobre qué es la novedad."),
  // Ya no se pregunta cuándo fue: la novedad es del día en que se envía.
  cuando: opcional(enumDe(CUANDO_NOVEDAD.map((c) => c.valor), "Elige cuándo fue.")),
  // Lo mismo que se elige en «Registrar una aplicación» (qué se hizo y sus opciones); la única entrada de texto son las observaciones.
  tipo_evento: opcional(enumDe(TIPOS_EVENTO, "Elige qué se hizo.")),
  categoria: opcional(z.string().trim().max(40)),
  etapa: opcional(z.string().trim().max(20)),
  motivo: opcional(z.string().trim().max(20)),
  cojera: opcional(z.coerce.number().int().min(0).max(3)),
  anestesia: opcional(z.string().trim().max(20)),
  observaciones: opcional(z.string().trim().max(300, "Las observaciones son muy largas (máximo 300 letras).")),
  producto_id: opcional(z.uuid()),
  via: opcional(enumDe(VIAS, "Elige la vía.")),
  lote_gasto_id: opcional(z.uuid()),
  prueba: opcional(enumDe(TIPOS_PRUEBA, "Elige la prueba.")),
  resultado_prueba: opcional(enumDe(RESULTADOS_PRUEBA, "Elige cómo salió.")),
  tipo_muestra: opcional(enumDe(TIPOS_MUESTRA, "Elige cómo se tomó la muestra.")),
  puntaje: opcional(z.coerce.number().int().min(1, "Elige el puntaje (1 a 5).").max(5, "Elige el puntaje (1 a 5).")),
  client_request_id: opcional(z.uuid()),
});

/** Envía una novedad: «Comprar» (llega al administrador) o «Aplicar dosis» sobre un animal (llega al veterinario). Quien la envía queda con su nombre. */
export async function crearNovedad(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { user, perfil, finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "novedades", finca.plan)) return { error: "No tienes permiso para enviar novedades en esta finca." };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  if (!tiposNovedadQueCrea(rol).includes(d.tipo as TipoNovedadPermiso)) return { error: "Tu perfil no envía ese tipo de novedad." };
  const compra = d.tipo === "compra";
  if (!compra && !d.animal_id) return { error: "Elige el animal." };
  const falta = faltaEnNovedad({ tipo: d.tipo as Novedad["tipo"], grupo_compra: d.grupo_compra as Novedad["grupo_compra"], tipo_evento: d.tipo_evento as Novedad["tipo_evento"], prueba: d.prueba as Novedad["prueba"], resultado_prueba: d.resultado_prueba as Novedad["resultado_prueba"], tipo_muestra: d.tipo_muestra as Novedad["tipo_muestra"], puntaje: d.puntaje });
  if (falta) return { error: falta };

  const supabase = await crearClienteServidor();
  if (!compra) {
    const { data: animal } = await supabase.from("animales").select("id").eq("id", d.animal_id!).eq("finca_id", finca.id).eq("estado", "activo").is("deleted_at", null).maybeSingle();
    if (!animal) return { error: "No encontramos ese animal." };
  }
  // El producto a comprar sale del catálogo de Compras de la finca y debe ser del grupo elegido; sin producto es «Otro producto» (se explica en las observaciones).
  let compraProducto: string | null = null;
  if (compra && d.compra_producto_id) {
    const { data: p } = await supabase.from("finca_productos").select("id, nombre, rubro").eq("id", d.compra_producto_id).eq("finca_id", finca.id).eq("tipo", "compra").eq("activo", true).maybeSingle();
    if (!p || !p.rubro || GRUPO_DE[p.rubro] !== d.grupo_compra) return { error: "Ese producto no es del grupo elegido. Elígelo de nuevo." };
    compraProducto = p.nombre;
  }

  // Cada opción se comprueba contra la lista de «Registrar una aplicación»; el producto y el lote, contra los de la finca.
  const opcionDe = (lista: { valor: string }[] | undefined, v: string | undefined) => !v || Boolean(lista?.some((o) => o.valor === v));
  if (d.tipo === "aplicacion" && d.tipo_evento) {
    const r = REGLAS[d.tipo_evento as keyof typeof REGLAS];
    if (!opcionDe(CATEGORIAS[d.tipo_evento as keyof typeof CATEGORIAS], d.categoria)) return { error: "Esa opción no corresponde a lo que se hizo. Elígela de nuevo." };
    if ((d.etapa && !r.etapa) || !opcionDe(ETAPAS, d.etapa)) return { error: "Elige la dosis de la lista." };
    if ((d.motivo && !r.motivo) || !opcionDe(MOTIVOS, d.motivo)) return { error: "Elige el motivo de la lista." };
    if ((d.anestesia && !r.anestesia) || !opcionDe(ANESTESIAS, d.anestesia)) return { error: "Elige la anestesia de la lista." };
    if (d.cojera !== undefined && (!r.cojera || !COJERAS.some((c) => c.valor === String(d.cojera)))) return { error: "Elige cómo caminaba de la lista." };
  }
  let productoNombre: string | null = null;
  let lote: string | null = null;
  if (d.tipo === "aplicacion" && d.producto_id) {
    const { data: p } = await supabase.from("productos_veterinarios").select("id, nombre").eq("id", d.producto_id).eq("finca_id", finca.id).maybeSingle();
    if (!p) return { error: "No encontramos ese producto. Elígelo de nuevo." };
    productoNombre = p.nombre;
    if (d.lote_gasto_id) {
      const { data: lotes } = await supabase.rpc("lotes_sanidad", { p_finca: finca.id });
      const elegido = (lotes ?? []).find((l) => l.gasto_id === d.lote_gasto_id && l.producto_id === d.producto_id);
      if (!elegido) return { error: "Ese lote ya no está disponible. Elige otro." };
      lote = elegido.lote;
    }
  }

  const nombre = perfil?.nombre?.trim() || user.email?.split("@")[0] || "Sin nombre";
  const aplicacion = d.tipo === "aplicacion";
  const { error } = await supabase.from("novedades").insert({
    finca_id: finca.id,
    animal_id: compra ? null : (d.animal_id ?? null),
    tipo: d.tipo as Novedad["tipo"],
    grupo_compra: compra ? ((d.grupo_compra as Novedad["grupo_compra"]) ?? null) : null,
    compra_producto_id: compra ? (d.compra_producto_id ?? null) : null,
    compra_producto_nombre: compra ? compraProducto : null,
    fecha: fechaDeNovedad((d.cuando as CuandoNovedad | undefined) ?? "hoy", hoyBogota()),
    tipo_evento: aplicacion ? ((d.tipo_evento as Novedad["tipo_evento"]) ?? null) : null,
    categoria: aplicacion ? (d.categoria ?? null) : null,
    etapa: aplicacion ? (d.etapa ?? null) : null,
    motivo: aplicacion ? (d.motivo ?? null) : null,
    cojera: aplicacion ? (d.cojera ?? null) : null,
    anestesia: aplicacion ? (d.anestesia ?? null) : null,
    observaciones: d.observaciones ?? null,
    producto_id: aplicacion ? (d.producto_id ?? null) : null,
    producto_nombre: aplicacion ? productoNombre : null,
    via: aplicacion ? ((d.via as Novedad["via"]) ?? null) : null,
    lote: aplicacion ? lote : null,
    prueba: d.tipo === "prueba" ? ((d.prueba as Novedad["prueba"]) ?? null) : null,
    resultado_prueba: d.tipo === "prueba" ? ((d.resultado_prueba as Novedad["resultado_prueba"]) ?? null) : null,
    tipo_muestra: d.tipo === "coprologico" ? ((d.tipo_muestra as Novedad["tipo_muestra"]) ?? null) : null,
    puntaje: d.tipo === "famacha" ? (d.puntaje ?? null) : null,
    enviada_por_nombre: nombre.slice(0, 120),
    client_request_id: d.client_request_id ?? null,
  });
  // Doble toque: la misma solicitud ya se guardó.
  if (error && !(error.code === "23505" && /client_req/.test(error.message))) return { error: mensajeAmigable(error.message) };

  revalidatePath("/novedades");
  revalidatePath("/");
  if (d.animal_id) revalidatePath(`/hato/${d.animal_id}`);
  redirect("/novedades?enviada=1");
}

/** Marca una novedad como vista o atendida. Solo quien la atiende: las de comprar, el administrador y el propietario; las de aplicar dosis, el veterinario y el propietario. */
export async function marcarNovedad(id: string, estado: string): Promise<Resultado> {
  const { user, finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "novedades", finca.plan)) return { ok: false, error: "Solo quien atiende las novedades puede cambiar su estado." };
  if (!z.uuid().safeParse(id).success || !(ESTADOS_NOVEDAD as string[]).includes(estado)) return { ok: false, error: "Novedad no válida." };
  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase.from("novedades").select("tipo").eq("id", id).eq("finca_id", finca.id).maybeSingle();
  if (!actual) return { ok: false, error: "No encontramos esa novedad." };
  if (!atiendeNovedad(rol, actual.tipo as Novedad["tipo"])) return { ok: false, error: "Esa novedad la atiende otro perfil." };
  const { data, error } = await supabase
    .from("novedades")
    .update({ estado: estado as Novedad["estado"], revisada_por: estado === "nueva" ? null : user.id, revisada_en: estado === "nueva" ? null : new Date().toISOString() })
    .eq("id", id)
    .eq("finca_id", finca.id)
    .select("animal_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos esa novedad." };
  revalidatePath("/novedades");
  revalidatePath("/");
  if (data[0].animal_id) revalidatePath(`/hato/${data[0].animal_id}`);
  return { ok: true };
}

/** Elimina una novedad. Quien la creó puede eliminar la suya; el administrador, cualquiera de las que ve (lo exige también la base de datos). */
export async function eliminarNovedad(id: string): Promise<Resultado> {
  const { finca, rol } = await obtenerContexto();
  if (!puedeVer(rol, "novedades", finca.plan)) return { ok: false, error: "No tienes permiso para eliminar novedades en esta finca." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Novedad no válida." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("novedades").delete().eq("id", id).eq("finca_id", finca.id).select("animal_id");
  if (error) return { ok: false, error: mensajeAmigable(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "Solo quien envió la novedad (o el administrador) puede eliminarla." };
  revalidatePath("/novedades");
  revalidatePath("/");
  if (data[0].animal_id) revalidatePath(`/hato/${data[0].animal_id}`);
  return { ok: true };
}
