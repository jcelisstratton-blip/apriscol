import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sumarDias } from "@/lib/fechas";
import { leerNumero } from "@/lib/numeros";
import { opcional } from "@/lib/validacion";
import type { Database } from "@/lib/tipos";

/**
 * Registrar una venta (`ventas`): la validación y lo que se guarda, que comparten el formulario con señal (`crearVenta`, `editarVenta`), la venta
 * anotada sin señal en «Registrar sin señal» y su envío (`guardarVentaCampo`). Si cambia una regla, cambia aquí y vale igual en los tres.
 */
type Cliente = SupabaseClient<Database>;

const numero = (mensaje: string) => z.preprocess((v) => (typeof v === "string" ? (leerNumero(v) ?? v) : v), z.number(mensaje));
const ID_UUID = z.uuid();

export const esquemaVenta = z.object({
  fecha: z.iso.date("Indica la fecha de la venta."),
  producto_id: z.uuid("Elige qué vendiste."),
  cantidad: numero("Escribe cuánto vendiste (solo números).").pipe(z.number().positive("La cantidad debe ser mayor que cero.").max(9_999_999_999, "La cantidad es muy grande.")),
  unidad: opcional(z.string().trim().max(20, "La unidad es muy larga.")),
  precio_unitario: numero("Escribe el precio de cada unidad (solo números).").pipe(z.number().min(0, "El precio no puede ser negativo.").max(99_999_999_999, "El precio es demasiado alto. Revísalo.")),
  tercero_id: opcional(ID_UUID),
  cobro: z.enum(["cobrado", "por_cobrar"], "Indica si ya te pagaron."),
  cobrado_en: opcional(z.iso.date("Indica la fecha del cobro.")),
  cobro_vence: opcional(z.iso.date("Indica cuándo esperas el pago.")),
  iva_tarifa: opcional(numero("La tarifa del IVA debe ser un número (por ejemplo 19).").pipe(z.number().min(0, "La tarifa del IVA no puede ser negativa.").max(100, "La tarifa del IVA no puede pasar de 100 %."))),
  observaciones: opcional(z.string().trim().max(1000, "Las observaciones son muy largas.")),
  client_request_id: opcional(ID_UUID),
  venta_id: opcional(ID_UUID),
});
export type DatosVenta = z.output<typeof esquemaVenta>;

/** Lo que se guarda: el cobro resuelto (cobrado → su fecha; por cobrar → cuándo se espera). */
export const filaVenta = (d: DatosVenta) => ({
  fecha: d.fecha,
  producto_id: d.producto_id,
  cantidad: d.cantidad,
  unidad: d.unidad ?? null,
  precio_unitario: d.precio_unitario,
  tercero_id: d.tercero_id ?? null,
  cobrado_en: d.cobro === "cobrado" ? (d.cobrado_en ?? d.fecha) : null,
  cobro_vence: d.cobro === "por_cobrar" ? (d.cobro_vence ?? null) : null,
  iva_tarifa: d.iva_tarifa ?? null,
  observaciones: d.observaciones ?? null,
});

export function revisarVenta(d: DatosVenta, hoy: string): string | null {
  if (d.fecha > hoy) return "La fecha de la venta no puede ser futura: registra lo que ya vendiste.";
  if (d.fecha < sumarDias(hoy, -3650)) return "Esa fecha es demasiado antigua. Revísala.";
  if (d.cobro === "cobrado" && d.cobrado_en && d.cobrado_en > hoy) return "La fecha de cobro no puede ser futura.";
  if (d.cobro === "cobrado" && d.cobrado_en && d.cobrado_en < d.fecha) return "No se puede cobrar antes de la fecha de la venta.";
  if (d.cobro === "por_cobrar" && d.cobro_vence && d.cobro_vence < d.fecha) return "El pago no puede vencer antes de la fecha de la venta.";
  return null;
}

/** Que el producto sea de la finca y de venta (los que se registran solos desde Leche y desde la baja no se venden a mano), y el comprador también. */
export async function comprobarListasVenta(supabase: Cliente, fincaId: string, d: DatosVenta): Promise<string | null> {
  const { data: p } = await supabase.from("finca_productos").select("tipo, automatico").eq("id", d.producto_id).eq("finca_id", fincaId).maybeSingle();
  if (!p || p.tipo !== "venta") return "No encontramos ese producto. Elígelo de nuevo.";
  if (p.automatico) return "Ese producto se registra solo: la leche, en Leche → Despachos; los animales, al darlos de baja.";
  if (d.tercero_id) {
    const { data: t } = await supabase.from("finca_terceros").select("id").eq("id", d.tercero_id).eq("finca_id", fincaId).maybeSingle();
    if (!t) return "No encontramos ese comprador. Elígelo de nuevo.";
  }
  return null;
}
