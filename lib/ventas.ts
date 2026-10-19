import type { LineaVenta, OrigenVenta } from "@/lib/tipos";

/** Las líneas de ingreso: en cuál de ellas cae cada producto que se vende. */
export const LINEAS: LineaVenta[] = ["leche", "animales", "carne", "derivados", "subproductos", "otros"];
export const ETIQUETA_LINEA: Record<LineaVenta, string> = {
  leche: "Leche",
  animales: "Animales",
  carne: "Carne",
  derivados: "Lácteos y derivados",
  subproductos: "Abono, lana y pieles",
  otros: "Otras ventas",
};
export const DETALLE_LINEA: Record<LineaVenta, string> = {
  leche: "Leche cruda despachada",
  animales: "Animales vendidos en pie",
  carne: "Carne y animales sacrificados",
  derivados: "Queso, yogur y otros lácteos",
  subproductos: "Estiércol, lana y pieles",
  otros: "Cualquier otra venta",
};

/** De dónde viene una venta y cómo se llama en pantalla. */
export const ETIQUETA_ORIGEN_VENTA: Record<OrigenVenta, string> = { venta: "Venta", leche: "Leche despachada", animal: "Animal vendido" };

/** A dónde lleva una venta para corregirla: la venta se corrige en Hato → Ventas; la leche, en su despacho; el animal, en su ficha. */
export function destinoVenta(v: { origen: OrigenVenta; origen_id: string }, puedeEditar: boolean): string | null {
  if (v.origen === "venta") return puedeEditar ? `/hato/ventas/${v.origen_id}/editar` : null;
  if (v.origen === "leche") return `/leche/despachos/${v.origen_id}`;
  return `/hato/${v.origen_id}`;
}

/** Una venta está vencida si no se ha cobrado y su fecha de cobro esperada ya pasó. */
export const cobroVencido = (v: { cobrado: boolean; cobro_vence: string | null }, hoy: string) => !v.cobrado && v.cobro_vence !== null && v.cobro_vence < hoy;
