/**
 * IVA en compras y ventas (opcional, informativo).
 *
 * En Colombia el impuesto sobre las ventas se llama **IVA** (Impuesto al Valor Agregado). En otros países cambia el nombre pero es el mismo tipo de impuesto
 * (VAT en el Reino Unido y la UE de habla inglesa, TVA en Francia, MwSt/USt en Alemania, GST en Australia, India o Canadá, IGV en Perú, ITBMS en Panamá,
 * ITBIS en República Dominicana…); la lista está en `docs/modulos/contabilidad.md`. Apriscol opera hoy con fincas colombianas, por eso se escribe «IVA».
 *
 * La tarifa **no se inventa**: la escribe quien registra (hoy la general es 19 %, pero cambia por ley y hay bienes excluidos o exentos). El total de la compra o
 * de la venta se toma como el que YA incluye el IVA, y el IVA es la parte de ese total: `total − total / (1 + tarifa)`. Es el mismo cálculo que la columna
 * generada `iva_valor` de `gastos` y `ventas` (migración `20261108124654`); si cambia uno, cambia el otro.
 */
export const IMPUESTO = { sigla: "IVA", nombre: "Impuesto al Valor Agregado" } as const;

/** Cuánto del total es IVA (el total ya lo incluye), redondeado a centavos. null si no hay tarifa o total válidos. */
export function ivaIncluido(total: number | null | undefined, tarifa: number | null | undefined): number | null {
  if (total == null || tarifa == null || !(total >= 0) || !(tarifa >= 0)) return null;
  return Math.round((total - total / (1 + tarifa / 100)) * 100) / 100;
}
