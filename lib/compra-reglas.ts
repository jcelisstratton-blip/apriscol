import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sumarDias } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import { soporteValido } from "@/lib/soportes";
import { DESTINOS, RUBROS, RUBROS_CON_LOTE, RUBROS_LOTE_OBLIGATORIO } from "@/lib/costos";
import { opcional } from "@/lib/validacion";
import type { Database } from "@/lib/tipos";

/**
 * Registrar una compra (`gastos`): la validación y lo que se guarda, que comparten el formulario con señal (`crearGasto`, `editarGasto`), la compra
 * anotada sin señal en «Registrar sin señal» y su envío (`guardarCompraCampo`). Si cambia una regla, cambia aquí y vale igual en los tres.
 */
type Cliente = SupabaseClient<Database>;

const numero = (mensaje: string) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), z.number(mensaje));
const ID_UUID = z.uuid();

export const esquemaCompra = z
  .object({
    fecha: z.iso.date("Indica la fecha del gasto."),
    /** La novedad «Comprar» desde la que se llegó: al guardar la compra queda atendida. */
    novedad_id: opcional(z.uuid()),
    rubro: z.enum(RUBROS as [string, ...string[]], "Elige en qué se gastó."),
    descripcion: z.string().trim().min(1, "Cuenta en una frase qué se compró o se pagó.").max(160, "La descripción es muy larga (máximo 160 letras)."),
    proveedor: opcional(z.string().trim().max(120, "El nombre del proveedor es muy largo.")),
    /** Proveedor elegido de la lista y producto elegido del catálogo (lo que se compró). */
    tercero_id: opcional(ID_UUID),
    producto_id: opcional(ID_UUID),
    /** Medicamento o vacuna: el producto veterinario, su lote y cuándo vence (el veterinario lo elige al aplicarlo). */
    producto_vet_id: opcional(ID_UUID),
    lote_producto: opcional(z.string().trim().max(60, "El lote es muy largo (máximo 60 letras).")),
    lote_vencimiento: opcional(z.iso.date("La fecha de vencimiento del lote no es válida.")),
    cantidad: opcional(numero("La cantidad debe ser un número.").pipe(z.number().positive("La cantidad debe ser mayor que cero.").max(9_999_999_999, "La cantidad es muy grande."))),
    unidad: opcional(z.string().trim().max(20, "La unidad es muy larga.")),
    monto: numero("Escribe cuánto costó (solo números).").pipe(z.number().positive("El valor debe ser mayor que cero.").max(99_999_999_999, "El valor es demasiado grande. Revísalo.")),
    destino_tipo: z.enum(DESTINOS as [string, ...string[]], "Elige a quién se carga el gasto."),
    especie: opcional(z.enum(["caprino", "ovino"])),
    ubicacion_id: opcional(ID_UUID),
    lote_id: opcional(ID_UUID),
    animal_id: opcional(ID_UUID),
    pago: z.enum(["pagado", "por_pagar"], "Indica si ya se pagó."),
    pagado_en: opcional(z.iso.date("Indica la fecha de pago.")),
    vence: opcional(z.iso.date("Indica cuándo vence el pago.")),
    soporte_path: opcional(z.string().max(200)),
    iva_tarifa: opcional(numero("La tarifa del IVA debe ser un número (por ejemplo 19).").pipe(z.number().min(0, "La tarifa del IVA no puede ser negativa.").max(100, "La tarifa del IVA no puede pasar de 100 %."))),
    observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
    client_request_id: opcional(ID_UUID),
    gasto_id: opcional(ID_UUID),
    /** Si se llegó desde la ficha de un animal: al guardar se vuelve a ella. */
    volver: opcional(ID_UUID),
  })
  .refine((d) => d.destino_tipo !== "especie" || d.especie, { message: "Elige si es de las cabras o de las ovejas.", path: ["especie"] })
  .refine((d) => d.destino_tipo !== "ubicacion" || d.ubicacion_id, { message: "Elige el corral o potrero.", path: ["ubicacion_id"] })
  .refine((d) => d.destino_tipo !== "lote" || d.lote_id, { message: "Elige el lote de ceba.", path: ["lote_id"] })
  .refine((d) => d.destino_tipo !== "animal" || d.animal_id, { message: "Elige el animal.", path: ["animal_id"] });

export type DatosCompra = z.output<typeof esquemaCompra>;

/** Lo que se guarda: solo el dato del destino elegido, y el pago resuelto (pagado → su fecha; por pagar → su vencimiento). */
export function filaCompra(d: DatosCompra, proveedor: string | null) {
  return {
    fecha: d.fecha,
    rubro: d.rubro as never,
    descripcion: d.descripcion,
    proveedor,
    tercero_id: d.tercero_id ?? null,
    producto_id: d.producto_id ?? null,
    // El lote solo existe en las compras de medicamentos y vacunas; en las demás se descarta.
    producto_vet_id: RUBROS_CON_LOTE.includes(d.rubro as never) ? (d.producto_vet_id ?? null) : null,
    lote_producto: RUBROS_CON_LOTE.includes(d.rubro as never) ? (d.lote_producto ?? null) : null,
    lote_vencimiento: RUBROS_CON_LOTE.includes(d.rubro as never) && d.lote_producto ? (d.lote_vencimiento ?? null) : null,
    cantidad: d.cantidad ?? null,
    unidad: d.cantidad != null ? (d.unidad ?? null) : null,
    monto: d.monto,
    destino_tipo: d.destino_tipo as never,
    especie: d.destino_tipo === "especie" ? ((d.especie as "caprino" | "ovino") ?? null) : null,
    ubicacion_id: d.destino_tipo === "ubicacion" ? (d.ubicacion_id ?? null) : null,
    lote_id: d.destino_tipo === "lote" ? (d.lote_id ?? null) : null,
    animal_id: d.destino_tipo === "animal" ? (d.animal_id ?? null) : null,
    pagado_en: d.pago === "pagado" ? (d.pagado_en ?? d.fecha) : null,
    vence: d.pago === "por_pagar" ? (d.vence ?? null) : null,
    soporte_path: d.soporte_path ?? null,
    iva_tarifa: d.iva_tarifa ?? null,
    observaciones: d.observaciones ?? null,
  };
}

export function revisarCompra(d: DatosCompra, fincaId: string, hoy: string): string | null {
  if (d.fecha > hoy) return "La fecha del gasto no puede ser futura: registra lo que ya se gastó.";
  if (d.fecha < sumarDias(hoy, -3650)) return "Esa fecha es demasiado antigua. Revísala.";
  if (d.pago === "pagado" && d.pagado_en && d.pagado_en > hoy) return "La fecha de pago no puede ser futura.";
  if (d.pago === "pagado" && d.pagado_en && d.pagado_en < d.fecha) return "No se puede pagar antes de la fecha del gasto.";
  if (d.pago === "por_pagar" && d.vence && d.vence < d.fecha) return "El pago no puede vencer antes de la fecha del gasto.";
  if (!soporteValido(d.soporte_path, fincaId, "gastos")) return "El documento no es válido. Adjúntalo de nuevo.";
  return null;
}

/**
 * Resuelve lo que se eligió de las listas: el nombre del proveedor (se guarda también como texto, para lo que lee lo anterior) y que el producto sea de la
 * finca, de compra y del mismo rubro. Devuelve el nombre del proveedor o un error en lenguaje llano.
 */
export async function resolverListasCompra(supabase: Cliente, fincaId: string, d: DatosCompra, exigirLote: boolean): Promise<{ proveedor: string | null } | { error: string }> {
  let proveedor = d.proveedor ?? null;
  if (d.tercero_id) {
    const { data } = await supabase.from("finca_terceros").select("nombre").eq("id", d.tercero_id).eq("finca_id", fincaId).maybeSingle();
    if (!data) return { error: "No encontramos ese proveedor. Elígelo de nuevo." };
    proveedor = data.nombre;
  }
  if (d.producto_id) {
    const { data } = await supabase.from("finca_productos").select("tipo, rubro").eq("id", d.producto_id).eq("finca_id", fincaId).maybeSingle();
    if (!data || data.tipo !== "compra") return { error: "No encontramos ese producto. Elígelo de nuevo." };
    if (data.rubro !== d.rubro) return { error: "Ese producto no corresponde a ese rubro. Elígelo de nuevo." };
  }
  if (RUBROS_CON_LOTE.includes(d.rubro as never) && d.producto_vet_id) {
    const { data } = await supabase.from("productos_veterinarios").select("id").eq("id", d.producto_vet_id).eq("finca_id", fincaId).maybeSingle();
    if (!data) return { error: "No encontramos ese producto veterinario. Elígelo de nuevo." };
  }
  if (d.lote_producto && !d.producto_vet_id) return { error: "Elige de qué producto veterinario es el lote." };
  if (d.producto_vet_id && !d.lote_producto && RUBROS_CON_LOTE.includes(d.rubro as never)) return { error: "Escribe el lote del producto." };
  // Al registrar la compra de una vacuna o un medicamento, el lote es obligatorio: sin él el veterinario no tiene qué elegir al aplicarlo.
  if (exigirLote && RUBROS_LOTE_OBLIGATORIO.includes(d.rubro as never) && (!d.producto_vet_id || !d.lote_producto)) {
    return { error: "Indica de qué producto veterinario es y su lote: el veterinario lo elegirá al aplicarlo." };
  }
  return { proveedor };
}

/** Guarda el precio por unidad como el habitual del producto, para proponerlo la próxima vez. No bloquea el guardado si falla. */
export async function recordarPrecioCompra(supabase: Cliente, fincaId: string, d: DatosCompra) {
  if (!d.producto_id || !d.cantidad || d.cantidad <= 0) return;
  await supabase.rpc("recordar_precio_producto", { p_finca: fincaId, p_producto: d.producto_id, p_precio: Math.round((d.monto / d.cantidad) * 100) / 100 });
}
