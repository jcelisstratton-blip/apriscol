import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hoyBogota } from "@/lib/fechas";
import { DESTINOS_LECHE } from "@/lib/leche-calidad";
import { decimal, noFutura, opcional, texto } from "@/lib/validacion";
import type { Database } from "@/lib/tipos";

type Cliente = SupabaseClient<Database>;

/**
 * Las reglas de un despacho de leche, una sola vez para «Registrar despacho» con señal (`crearDespacho`, `editarDespacho`) y para el despacho anotado sin
 * señal (`guardarDespachoCampo`): qué se valida, cuándo es una venta (con precio) y cómo queda la fila.
 */
export const esquemaDespacho = z.object({
  fecha: z.iso.date("Indica la fecha."),
  litros: decimal(z.coerce.number("Los litros deben ser un número.").positive("Los litros deben ser mayores que cero.").max(1_000_000, "Los litros son demasiados. Revisa el dato.")).pipe(z.number("Indica cuántos litros se despacharon.")),
  destino_tipo: z.enum(DESTINOS_LECHE as [string, ...string[]], "Elige el destino."),
  comprador: texto(120, "El nombre del comprador es muy largo."),
  /** Comprador elegido de la lista, y si ya se cobró (solo cuenta cuando el despacho tiene precio: sin precio todavía no es una venta). */
  tercero_id: opcional(z.uuid()),
  cobro: opcional(z.enum(["cobrado", "por_cobrar"])),
  cobrado_en: opcional(z.iso.date("La fecha de cobro no es válida.")),
  cobro_vence: opcional(z.iso.date("La fecha en que esperas el pago no es válida.")),
  tanque: texto(80, "El nombre del tanque es muy largo."),
  guia: texto(60, "La guía o factura es muy larga."),
  precio_litro: decimal(z.coerce.number("El precio debe ser un número.").min(0, "El precio no puede ser negativo.").max(1_000_000, "El precio es demasiado alto. Revisa el dato.")),
  iva_tarifa: decimal(z.coerce.number("La tarifa del IVA debe ser un número (por ejemplo 19).").min(0, "La tarifa del IVA no puede ser negativa.").max(100, "La tarifa del IVA no puede pasar de 100 %.")),
  temperatura_c: decimal(z.coerce.number("La temperatura debe ser un número.").min(-10, "La temperatura no es válida.").max(60, "La temperatura no es válida.")),
  observaciones: texto(1000, "Las observaciones son muy largas."),
  client_request_id: opcional(z.uuid()),
  despacho_id: opcional(z.uuid()),
});

/** Valida un despacho (los campos del formulario, como texto) y arma su fila. Un despacho con precio es una venta: ya cobrada o por cobrar. */
export function leerDespacho(entrada: Record<string, unknown>) {
  const datos = esquemaDespacho.safeParse(entrada);
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos." } as const;
  const d = datos.data;
  const futura = noFutura(d.fecha);
  if (futura) return { error: futura } as const;
  // Cobro: solo un despacho con precio es una venta. Sin precio no hay nada que cobrar todavía.
  const vendido = d.precio_litro != null && d.precio_litro > 0;
  const cobrado = vendido && (d.cobro ?? "cobrado") === "cobrado";
  if (cobrado && d.cobrado_en && d.cobrado_en > hoyBogota()) return { error: "La fecha de cobro no puede ser futura." } as const;
  if (cobrado && d.cobrado_en && d.cobrado_en < d.fecha) return { error: "No se puede cobrar antes de la fecha del despacho." } as const;
  if (vendido && !cobrado && d.cobro_vence && d.cobro_vence < d.fecha) return { error: "El pago no puede vencer antes de la fecha del despacho." } as const;
  return {
    d,
    fila: {
      fecha: d.fecha,
      litros: d.litros,
      destino_tipo: d.destino_tipo as Database["public"]["Tables"]["despachos_leche"]["Insert"]["destino_tipo"],
      comprador: d.comprador ?? null,
      tercero_id: d.tercero_id ?? null,
      tanque: d.tanque ?? null,
      guia: d.guia ?? null,
      precio_litro: d.precio_litro ?? null,
      iva_tarifa: vendido ? (d.iva_tarifa ?? null) : null,
      cobrado_en: cobrado ? (d.cobrado_en ?? d.fecha) : null,
      cobro_vence: vendido && !cobrado ? (d.cobro_vence ?? null) : null,
      temperatura_c: d.temperatura_c ?? null,
      observaciones: d.observaciones ?? null,
    },
  } as const;
}

/** El comprador elegido de la lista pasa a ser también el nombre guardado como texto (lo que leen las pantallas anteriores). */
export async function aplicarCompradorDespacho(supabase: Cliente, fincaId: string, fila: { comprador: string | null; tercero_id: string | null }): Promise<string | null> {
  if (!fila.tercero_id) return null;
  const { data } = await supabase.from("finca_terceros").select("nombre").eq("id", fila.tercero_id).eq("finca_id", fincaId).maybeSingle();
  if (!data) return "No encontramos ese comprador. Elígelo de nuevo.";
  fila.comprador = data.nombre;
  return null;
}

/** El precio de este despacho queda como el habitual de la leche, para proponerlo la próxima vez. */
export async function recordarPrecioLeche(supabase: Cliente, fincaId: string, precio: number | null | undefined) {
  if (precio == null || precio <= 0) return;
  const { data } = await supabase.from("finca_productos").select("id").eq("finca_id", fincaId).eq("clave", "leche_cruda").maybeSingle();
  if (data) await supabase.rpc("recordar_precio_producto", { p_finca: fincaId, p_producto: data.id, p_precio: precio });
}
