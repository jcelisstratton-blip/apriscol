import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { vacio } from "@/lib/validacion";
import { leerNumero } from "@/lib/numeros";
import type { Database } from "@/lib/tipos";

/**
 * Dar de baja a un animal (venta, sacrificio, muerte o pérdida): la validación y las columnas que comparten el formulario con señal (`darDeBaja`,
 * `corregirSalida`), la baja anotada sin señal en «Registrar sin señal» y su envío (`guardarBajaCampo`). Si cambia una regla, cambia aquí.
 */
type Cliente = SupabaseClient<Database>;

export const esquemaBaja = z.object({
  animalId: z.uuid(),
  tipo: z.enum(["venta", "sacrificio", "muerte", "perdida"], "Elige qué pasó con el animal."),
  fecha: z.iso.date("Indica la fecha."),
  motivo: z.preprocess(vacio, z.enum(["edad", "partos", "baja_produccion", "sanidad", "reproductivo", "accidente", "otro"]).optional()),
  comprador: z.preprocess(vacio, z.string().trim().max(160, "El nombre del comprador es muy largo.").optional()),
  /** Comprador elegido de la lista y si ya se cobró (solo cuenta en una venta con valor). */
  terceroId: z.preprocess(vacio, z.uuid().optional()),
  cobro: z.preprocess(vacio, z.enum(["cobrado", "por_cobrar"]).optional()),
  cobroVence: z.preprocess(vacio, z.iso.date("La fecha en que esperas el pago no es válida.").optional()),
  valor: z.preprocess(vacio, z.number().min(0, "El valor no puede ser negativo.").max(9_999_999_999, "Revisa el valor: es demasiado alto.").optional()),
  destinoConsumo: z.boolean(),
  ivaTarifa: z.preprocess(vacio, z.number("La tarifa del IVA debe ser un número.").min(0, "La tarifa del IVA no puede ser negativa.").max(100, "La tarifa del IVA no puede pasar de 100 %.").optional()),
  detalle: z.preprocess(vacio, z.string().trim().max(1000, "Las notas son muy largas.").optional()),
  // Trazabilidad de la salida comercial (venta o sacrificio): peso en vivo, guía de movilización y a dónde fue.
  pesoKg: z.preprocess(vacio, z.number("El peso debe ser un número.").positive("El peso debe ser mayor que cero.").max(250, "El peso no puede pasar de 250 kg.").optional()),
  guiaMovilizacion: z.preprocess(vacio, z.string().trim().max(60, "La guía de movilización es muy larga.").optional()),
  destino: z.preprocess(vacio, z.string().trim().max(160, "El destino es muy largo.").optional()),
  /** Identificador del envío: un doble toque o el reenvío desde el celular no registran otra baja ni dan error. */
  clientRequestId: z.preprocess(vacio, z.uuid().optional()),
});
export type DatosBaja = z.output<typeof esquemaBaja>;

/**
 * El comprador y el cobro de una venta: el comprador elegido de la lista (su nombre queda también como texto, para lo que lee lo anterior) y si ya se
 * cobró. Solo una venta con valor es algo que se cobra; sin valor no hay cobro. Devuelve las columnas o un error en lenguaje llano.
 */
export async function datosDeVenta(
  supabase: Cliente,
  fincaId: string,
  d: { comprador?: string; terceroId?: string; valor?: number; cobro?: "cobrado" | "por_cobrar"; cobroVence?: string },
  fecha: string,
  cobradoAntes?: string | null,
): Promise<{ comprador: string | null; tercero_id: string | null; cobrado_en: string | null; cobro_vence: string | null } | { error: string }> {
  let comprador = d.comprador ?? null;
  if (d.terceroId) {
    const { data } = await supabase.from("finca_terceros").select("nombre").eq("id", d.terceroId).eq("finca_id", fincaId).maybeSingle();
    if (!data) return { error: "No encontramos ese comprador. Elígelo de nuevo." };
    comprador = data.nombre;
  }
  const hayValor = d.valor != null && d.valor > 0;
  const porCobrar = hayValor && d.cobro === "por_cobrar";
  if (porCobrar && d.cobroVence && d.cobroVence < fecha) return { error: "El pago no puede vencer antes de la fecha de la venta." };
  return {
    comprador,
    tercero_id: d.terceroId ?? null,
    // Una venta ya registrada que se corrige sin tocar el cobro conserva su fecha de cobro.
    cobrado_en: hayValor && !porCobrar ? (cobradoAntes ?? fecha) : null,
    cobro_vence: porCobrar ? (d.cobroVence ?? null) : null,
  };
}

/** La trazabilidad solo aplica a una salida comercial: una muerte o una pérdida no tienen guía, peso ni destino. */
export const datosComerciales = (d: { tipo: string; pesoKg?: number; guiaMovilizacion?: string; destino?: string }) =>
  d.tipo === "venta" || d.tipo === "sacrificio"
    ? { peso_kg: d.pesoKg ?? null, guia_movilizacion: d.guiaMovilizacion ?? null, destino: d.destino ?? null }
    : { peso_kg: null, guia_movilizacion: null, destino: null };

/** Lo que se revisa antes de guardar (también en el celular, salvo el nacimiento, que solo conoce el servidor). */
export function revisarBaja(d: Pick<DatosBaja, "fecha">, hoy: string, nacimiento?: string | null): string | null {
  if (d.fecha > hoy) return "La fecha no puede ser futura.";
  if (nacimiento && d.fecha < nacimiento) return "La fecha no puede ser anterior al nacimiento del animal.";
  return null;
}

/** La fila de `bajas` de una salida nueva (el comprador y el cobro de una venta ya resueltos con `datosDeVenta`). */
export function filaBaja(d: DatosBaja, venta: { comprador: string | null; tercero_id: string | null; cobrado_en: string | null; cobro_vence: string | null }) {
  const esVenta = d.tipo === "venta";
  return {
    animal_id: d.animalId,
    tipo: d.tipo,
    fecha: d.fecha,
    motivo: d.motivo ?? null,
    ...venta,
    valor: esVenta ? (d.valor ?? null) : null,
    iva_tarifa: esVenta && d.valor != null ? (d.ivaTarifa ?? null) : null,
    destino_consumo: esVenta && d.destinoConsumo,
    detalle: d.detalle ?? null,
    ...datosComerciales(d),
    client_request_id: d.clientRequestId ?? null,
  };
}

/** ¿El error de la base es el de un doble toque (la misma baja ya entró)? */
export const esBajaRepetida = (e: { code?: string; message?: string } | null) => e?.code === "23505" && /client_req/.test(e.message ?? "");

/**
 * Lo anotado en el celular (todo texto, con los mismos nombres que el formulario) convertido en la entrada de `esquemaBaja`: números a la
 * colombiana con `leerNumero`, «Va para consumo» como sí/no. Lo usan la pantalla sin señal (para validar antes de guardar) y `guardarBajaCampo`.
 */
export function entradaBajaDeCampos(animalId: string, campos: Record<string, string>, clientRequestId?: string): z.input<typeof esquemaBaja> {
  const num = (k: string) => (campos[k]?.trim() ? (leerNumero(campos[k]) ?? Number.NaN) : undefined);
  const venta = campos.tipo === "venta";
  const comercial = venta || campos.tipo === "sacrificio";
  return {
    animalId,
    tipo: campos.tipo as never,
    fecha: campos.fecha ?? "",
    motivo: campos.motivo as never,
    terceroId: venta ? campos.terceroId : undefined,
    cobro: venta && num("valor") ? (campos.cobro as never) : undefined,
    cobroVence: venta && campos.cobro === "por_cobrar" ? campos.cobroVence : undefined,
    valor: venta ? num("valor") : undefined,
    ivaTarifa: venta ? num("ivaTarifa") : undefined,
    destinoConsumo: venta && campos.destinoConsumo === "si",
    detalle: campos.detalle,
    ...(comercial ? { pesoKg: num("pesoKg"), guiaMovilizacion: campos.guiaMovilizacion, destino: campos.destino } : {}),
    clientRequestId,
  };
}
