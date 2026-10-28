"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerContexto } from "@/lib/contexto";
import { puedeEscribir, revisaNovedades } from "@/lib/permisos";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { hoyBogota } from "@/lib/fechas";
import { CUANDO_NOVEDAD, ESTADOS_NOVEDAD, TIPOS_NOVEDAD, faltaEnNovedad, fechaDeNovedad, type CuandoNovedad } from "@/lib/novedades";
import { RESULTADOS_PRUEBA, TIPOS_PRODUCTO, TIPOS_PRUEBA, VIAS } from "@/lib/sanidad";
import { TIPOS_MUESTRA } from "@/lib/coprologico";
import type { Novedad } from "@/lib/tipos";
import { opcional } from "@/lib/validacion";

export type EstadoForm = { error?: string } | undefined;
type Resultado = { ok: true } | { ok: false; error: string };

const enumDe = (valores: readonly string[], mensaje: string) => z.enum(valores as [string, ...string[]], mensaje);

// Una novedad se arma solo eligiendo opciones: ningún campo es de texto libre.
const esquema = z.object({
  animal_id: z.uuid("Elige el animal."),
  tipo: enumDe(TIPOS_NOVEDAD, "Elige qué quieres contar."),
  cuando: enumDe(CUANDO_NOVEDAD.map((c) => c.valor), "Elige cuándo fue."),
  categoria_producto: opcional(enumDe(TIPOS_PRODUCTO, "Elige qué se aplicó.")),
  producto_id: opcional(z.uuid()),
  via: opcional(enumDe(VIAS, "Elige la vía.")),
  lote_gasto_id: opcional(z.uuid()),
  prueba: opcional(enumDe(TIPOS_PRUEBA, "Elige la prueba.")),
  resultado_prueba: opcional(enumDe(RESULTADOS_PRUEBA, "Elige cómo salió.")),
  tipo_muestra: opcional(enumDe(TIPOS_MUESTRA, "Elige cómo se tomó la muestra.")),
  puntaje: opcional(z.coerce.number().int().min(1, "Elige el puntaje (1 a 5).").max(5, "Elige el puntaje (1 a 5).")),
  client_request_id: opcional(z.uuid()),
});

/** Envía una novedad sobre un animal. Quien la envía queda con su nombre; la ven el propietario, el administrador y el veterinario. */
export async function crearNovedad(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { user, perfil, finca, rol } = await obtenerContexto();
  if (!puedeEscribir(rol, "novedades", finca.plan)) return { error: "No tienes permiso para enviar novedades en esta finca." };
  const datos = esquema.safeParse(Object.fromEntries(form));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." };
  const d = datos.data;
  const falta = faltaEnNovedad({ tipo: d.tipo as Novedad["tipo"], categoria_producto: d.categoria_producto as Novedad["categoria_producto"], prueba: d.prueba as Novedad["prueba"], resultado_prueba: d.resultado_prueba as Novedad["resultado_prueba"], tipo_muestra: d.tipo_muestra as Novedad["tipo_muestra"], puntaje: d.puntaje });
  if (falta) return { error: falta };

  const supabase = await crearClienteServidor();
  const { data: animal } = await supabase.from("animales").select("id").eq("id", d.animal_id).eq("finca_id", finca.id).eq("estado", "activo").is("deleted_at", null).maybeSingle();
  if (!animal) return { error: "No encontramos ese animal." };

  // El producto y el lote se eligen de listas de la finca: se comprueba que existan y que correspondan al tipo elegido.
  let productoNombre: string | null = null;
  let lote: string | null = null;
  if (d.tipo === "aplicacion" && d.producto_id) {
    const { data: p } = await supabase.from("productos_veterinarios").select("id, nombre, tipo").eq("id", d.producto_id).eq("finca_id", finca.id).maybeSingle();
    if (!p || p.tipo !== d.categoria_producto) return { error: "Ese producto no corresponde al tipo elegido. Elígelo de nuevo." };
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
    animal_id: d.animal_id,
    tipo: d.tipo as Novedad["tipo"],
    fecha: fechaDeNovedad(d.cuando as CuandoNovedad, hoyBogota()),
    categoria_producto: aplicacion ? ((d.categoria_producto as Novedad["categoria_producto"]) ?? null) : null,
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
  revalidatePath(`/hato/${d.animal_id}`);
  redirect("/novedades?enviada=1");
}

/** Marca una novedad como vista o atendida. Solo quien las revisa (propietario, administrador, veterinario). */
export async function marcarNovedad(id: string, estado: string): Promise<Resultado> {
  const { user, finca, rol } = await obtenerContexto();
  if (!revisaNovedades(rol) || !puedeEscribir(rol, "novedades", finca.plan)) return { ok: false, error: "Solo quien revisa las novedades puede cambiar su estado." };
  if (!z.uuid().safeParse(id).success || !(ESTADOS_NOVEDAD as string[]).includes(estado)) return { ok: false, error: "Novedad no válida." };
  const supabase = await crearClienteServidor();
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
  revalidatePath(`/hato/${data[0].animal_id}`);
  return { ok: true };
}
