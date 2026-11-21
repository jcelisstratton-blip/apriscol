import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/tipos";
import { hoyBogota } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import { datosPorTipoEvento, type EntradaEvento } from "@/lib/sanidad-campos";
import { EVENTO_CON_PRODUCTO, TIPOS_EVENTO, VIAS } from "@/lib/sanidad";
import { opcional } from "@/lib/validacion";

/**
 * Las reglas de un evento sanitario (vacuna, desparasitación, tratamiento, podología, pediluvio, cirugía…), en un solo lugar: las usan el formulario
 * con señal (`crearEvento` / `editarEvento`, `app/(app)/sanidad/actions.ts`) y el registro sin señal (`guardarSanidadCampo`, `lib/campo-servidor.ts`).
 * Ambos entregan los mismos campos de texto del formulario y la lista de animales, y guardan con la misma función de la base.
 */

/** Un número escrito a la colombiana: «25.000» son veinticinco mil, no veinticinco; «1,5» es uno y medio. */
const numero = (s: z.ZodType<number>) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), opcional(s));
const dias = (mensaje: string) => z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v : 0), z.coerce.number(mensaje).int(mensaje).min(0, mensaje).max(365, "Los días de retiro no pueden pasar de 365."));
const ID_UUID = z.uuid();

type Cliente = SupabaseClient<Database>;

export const esquemaEvento = z.object({
  tipo: z.enum(TIPOS_EVENTO as [string, ...string[]], "Elige qué se hizo."),
  fecha: z.iso.date("Indica la fecha."),
  producto_id: opcional(z.string()),
  producto_nombre: opcional(z.string().trim().max(120, "El nombre del producto es muy largo.")),
  /** Quien compra (propietario o administrador) puede escribir el lote al aplicar; el veterinario no: lo elige. */
  lote_producto: opcional(z.string().trim().max(60, "El lote es muy largo.")),
  fecha_vencimiento: opcional(z.iso.date("La fecha de vencimiento del lote no es válida.")),
  /** El lote no se escribe: se elige entre los que el administrador registró al comprar (id de la compra), o «actual» para conservar el que ya tenía el registro. */
  lote_gasto_id: opcional(z.string().trim().max(40)),
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
  // Lo propio de cada tipo (`lib/sanidad-campos.ts`): se valida según el tipo y lo que no le corresponde se descarta.
  categoria: opcional(z.string().trim().max(40)),
  motivo: opcional(z.string().trim().max(20)),
  etapa: opcional(z.string().trim().max(20)),
  dias_tratamiento: numero(z.coerce.number("Los días del tratamiento deben ser un número entero.").int("Los días del tratamiento deben ser un número entero.").min(1, "El tratamiento dura al menos un día.").max(60, "El tratamiento no puede pasar de 60 días.")),
  cojera: numero(z.coerce.number("El grado de cojera va de 0 a 3.").int().min(0, "El grado de cojera va de 0 a 3.").max(3, "El grado de cojera va de 0 a 3.")),
  concentracion_pct: numero(z.coerce.number("La concentración debe ser un número, como 10.").positive("La concentración debe ser mayor que cero.").max(100, "La concentración no puede pasar de 100 %.")),
  minutos: numero(z.coerce.number("Los minutos deben ser un número entero.").int("Los minutos deben ser un número entero.").min(1, "Los minutos deben ser al menos 1.").max(240, "Los minutos no pueden pasar de 240.")),
  anestesia: opcional(z.string().trim().max(20)),
  client_request_id: opcional(z.uuid()),
  evento_id: opcional(z.uuid()),
  animal: opcional(z.uuid()),
  /** Si el evento aplica una programación, la que se marca como aplicada para estos animales. */
  programa_id: opcional(z.uuid()),
});

/**
 * Valida un evento y lo deja listo para la base: resuelve el producto elegido y verifica las fechas y los animales. `campos` son los del formulario
 * (texto) y `animales` la lista de animales elegidos.
 */
export async function leerEventoSanitario(campos: Record<string, unknown>, animales: readonly string[], fincaId: string, supabase: Cliente, exigir: boolean, puedeEscribirLote: boolean) {
  const datos = esquemaEvento.safeParse(campos);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;

  const ids = [...new Set(animales.map(String))];
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

  // Cada tipo pide y guarda lo suyo: se validan sus datos y lo que no le corresponde (dosis y retiro de un pediluvio, por ejemplo) se descarta.
  // El lote se elige de los que registró quien compró; quien aplica nunca lo digita.
  let lote = "";
  let loteVence = "";
  if (d.lote_gasto_id === "actual") {
    if (!d.evento_id) return { error: "Ese lote no es válido. Elígelo de nuevo." } as const;
    const { data: previo } = await supabase.from("eventos_sanitarios").select("lote_producto, fecha_vencimiento").eq("id", d.evento_id).eq("finca_id", fincaId).maybeSingle();
    lote = previo?.lote_producto ?? "";
    loteVence = previo?.fecha_vencimiento ?? "";
  } else if (puedeEscribirLote && d.lote_producto) {
    lote = d.lote_producto;
    loteVence = d.fecha_vencimiento ?? "";
  } else if (d.lote_gasto_id) {
    if (!ID_UUID.safeParse(d.lote_gasto_id).success || !productoId) return { error: "Elige primero el producto y luego su lote." } as const;
    const { data: lotes } = await supabase.rpc("lotes_sanidad", { p_finca: fincaId });
    const elegido = (lotes ?? []).find((l) => l.gasto_id === d.lote_gasto_id && l.producto_id === productoId);
    if (!elegido) return { error: "Ese lote ya no está disponible (venció o no es de este producto). Elige otro." } as const;
    lote = elegido.lote;
    loteVence = elegido.vencimiento ?? "";
  }

  const entrada: EntradaEvento = {
    categoria: d.categoria, motivo: d.motivo, etapa: d.etapa, dias_tratamiento: d.dias_tratamiento, cojera: d.cojera, concentracion_pct: d.concentracion_pct,
    minutos: d.minutos, anestesia: d.anestesia, diagnostico: d.diagnostico, responsable: d.responsable, producto: nombre, dosis: d.dosis, via: d.via,
  };
  const porTipo = datosPorTipoEvento(d.tipo as never, entrada, exigir);
  if ("error" in porTipo) return { error: porTipo.error } as const;
  const { extra, limpiar } = porTipo;

  const payload = {
    fecha: d.fecha,
    tipo: d.tipo,
    producto_id: productoId ?? "",
    producto_nombre: nombre ?? "",
    lote_producto: limpiar.lote ? "" : lote,
    fecha_vencimiento: limpiar.lote ? "" : loteVence,
    dosis: limpiar.dosis ? "" : (d.dosis ?? ""),
    unidad_dosis: !limpiar.dosis && d.dosis ? (d.unidad_dosis ?? "") : "",
    via: limpiar.via ? "" : (d.via ?? ""),
    responsable: d.responsable ?? "",
    costo: d.costo ?? "",
    retiro_leche_dias: limpiar.retiro ? 0 : d.retiro_leche_dias,
    retiro_carne_dias: limpiar.retiro ? 0 : d.retiro_carne_dias,
    diagnostico: limpiar.diagnostico ? "" : (d.diagnostico ?? ""),
    observaciones: d.observaciones ?? "",
    proxima_fecha: d.proxima_fecha ?? "",
    client_request_id: d.client_request_id ?? "",
  };
  return { payload, extra, ids, animal: d.animal, eventoId: d.evento_id, programaId: d.programa_id } as const;
}


/** Si el evento aplica una programación, esos animales quedan como aplicados en ella. */
export async function vincularPrograma(supabase: Cliente, fincaId: string, programaId: string, eventoId: string, animales: string[]) {
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
