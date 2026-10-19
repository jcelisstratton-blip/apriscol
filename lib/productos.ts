import { GRUPOS, GRUPO_DE, RUBROS_DE, type GrupoGasto } from "@/lib/costos";
import type { Producto, RubroGasto } from "@/lib/tipos";

/** El producto de un grupo de compras, para elegirlo de una lista corta. */
export type ProductoCompra = Producto & { tipo: "compra"; rubro: Exclude<RubroGasto, "mano_obra"> };
export type ProductoVenta = Producto & { tipo: "venta"; linea: NonNullable<Producto["linea"]> };

export const esCompra = (p: Producto): p is ProductoCompra => p.tipo === "compra" && p.rubro !== null;
export const esVenta = (p: Producto): p is ProductoVenta => p.tipo === "venta" && p.linea !== null;

/** Los productos de compra de un grupo de gasto, en el orden del catálogo. */
export const comprasDeGrupo = (productos: Producto[], grupo: GrupoGasto): ProductoCompra[] =>
  productos.filter(esCompra).filter((p) => (RUBROS_DE[grupo] as RubroGasto[]).includes(p.rubro)).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));

/** Los productos de compra agrupados por grupo de gasto. */
export function comprasPorGrupo(productos: Producto[]): Record<GrupoGasto, ProductoCompra[]> {
  const r = Object.fromEntries(GRUPOS.map((g) => [g, [] as ProductoCompra[]])) as Record<GrupoGasto, ProductoCompra[]>;
  for (const p of productos.filter(esCompra)) r[GRUPO_DE[p.rubro]]?.push(p);
  for (const g of GRUPOS) r[g].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
  return r;
}

/** Las ventas que se registran a mano: las que no entran solas desde Leche o desde la baja de un animal. */
export const ventasManuales = (productos: Producto[]): ProductoVenta[] =>
  productos.filter(esVenta).filter((p) => !p.automatico).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));

/** El precio con que se propone un producto, escrito a la colombiana («2.500», «30,5»), o vacío si todavía no tiene. */
export const textoPrecio = (n: number | null | undefined) => (n == null ? "" : String(Math.round(n * 100) / 100).replace(".", ","));
