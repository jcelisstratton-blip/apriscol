/**
 * Inventario de medicamentos y vacunas. El stock se calcula en la base (`inventario_productos`, `inventario_lotes`): conteos + compras − aplicaciones desde la
 * fecha de apertura de cada producto. Aquí viven las reglas puras que lo interpretan (estado, vencimiento, unidades), para que la pantalla, el semáforo y
 * Hoy digan lo mismo. Todo se cuenta en la unidad de la dosis del producto (ml, dosis, tableta…); la presentación (frasco = 100 ml) solo traduce.
 */
import { diasHasta, formatoFecha } from "@/lib/fechas";

/** Una fila de `inventario_productos`. */
export type FilaInventario = {
  producto_id: string;
  nombre: string;
  tipo: string;
  unidad: string | null;
  presentacion: string | null;
  contenido_presentacion: number | null;
  stock_minimo: number | null;
  /** Fecha de apertura (el primer conteo). Sin ella el producto todavía no se cuenta. */
  desde: string | null;
  stock: number | null;
  /** El vencimiento más cercano entre los lotes que aún tienen existencias. */
  vence_pronto: string | null;
  /** Compras desde la apertura que no se pudieron sumar (sin cantidad, o el producto no tiene presentación definida). */
  compras_sin_calcular: number;
  /** Aplicaciones desde la apertura sin dosis: no descuentan. */
  aplicaciones_sin_dosis: number;
};

export type FilaLote = { lote: string | null; vencimiento: string | null; stock: number };

export type EstadoStock = "sin_contar" | "negativo" | "agotado" | "bajo" | "ok";
export const ESTADOS_STOCK: EstadoStock[] = ["sin_contar", "negativo", "agotado", "bajo", "ok"];
export const ETIQUETA_ESTADO_STOCK: Record<EstadoStock, string> = {
  sin_contar: "Por contar",
  negativo: "Descuadrado",
  agotado: "Agotado",
  bajo: "Stock bajo",
  ok: "Al día",
};
export const DETALLE_ESTADO_STOCK: Record<EstadoStock, string> = {
  sin_contar: "Todavía no se ha hecho el conteo de apertura",
  negativo: "Se aplicó más de lo que había registrado",
  agotado: "No queda nada",
  bajo: "En el mínimo o por debajo",
  ok: "Hay existencias suficientes",
};

/** Días antes del vencimiento desde los que un lote se avisa. */
export const DIAS_AVISO_VENCIMIENTO = 30;

export type EstadoVencimiento = "vencido" | "pronto" | "ok";

/** Un lote que ya venció o vence en `DIAS_AVISO_VENCIMIENTO` días o menos. Sin fecha no se avisa. */
export function estadoVencimiento(vencimiento: string | null, hoy: string): EstadoVencimiento | null {
  if (!vencimiento) return null;
  const dias = diasHasta(vencimiento, hoy);
  return dias < 0 ? "vencido" : dias <= DIAS_AVISO_VENCIMIENTO ? "pronto" : "ok";
}

/** En qué va el producto: sin contar, descuadrado, agotado, en el mínimo o al día. */
export function estadoStock(f: Pick<FilaInventario, "desde" | "stock" | "stock_minimo">): EstadoStock {
  if (!f.desde || f.stock === null) return "sin_contar";
  if (f.stock < 0) return "negativo";
  if (f.stock === 0) return "agotado";
  if (f.stock_minimo !== null && f.stock <= f.stock_minimo) return "bajo";
  return "ok";
}

/** ¿Pide atención? Descuadrado, agotado o bajo, o con un lote vencido o por vencer. «Por contar» no es una alerta: es trabajo pendiente. */
export function pideAtencion(f: Pick<FilaInventario, "desde" | "stock" | "stock_minimo" | "vence_pronto">, hoy: string): boolean {
  const e = estadoStock(f);
  const v = estadoVencimiento(f.vence_pronto, hoy);
  return e === "negativo" || e === "agotado" || e === "bajo" || v === "vencido" || v === "pronto";
}

const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
/** «2,5», «1.250» (a la colombiana). */
export const cantidadTexto = (n: number): string => numero.format(n);

/** Cuántas presentaciones (frascos) son esa cantidad. Nulo si el producto no tiene presentación definida. */
export function enPresentaciones(cantidad: number, contenido: number | null): number | null {
  return contenido && contenido > 0 ? cantidad / contenido : null;
}

/** De presentaciones a unidades de la dosis: 3 frascos de 100 ml → 300. */
export function aUnidades(presentaciones: number, contenido: number): number {
  return Math.round(presentaciones * contenido * 100) / 100;
}

/** Plural de la unidad: «dosis» no cambia («3 dosis», no «dosises»); las que terminan en vocal llevan «s» y el resto «es». */
export const plural = (palabra: string, n: number): string => (Math.abs(n) === 1 || /s$/i.test(palabra) ? palabra : /[aeiou]$/i.test(palabra) ? `${palabra}s` : `${palabra}es`);

/** «350 ml», o «3,5 frascos · 350 ml» si el producto tiene presentación. */
export function textoStock(f: Pick<FilaInventario, "unidad" | "presentacion" | "contenido_presentacion">, cantidad: number): string {
  const u = f.unidad ?? "unidades";
  const base = `${cantidadTexto(cantidad)} ${u}`;
  const p = enPresentaciones(cantidad, f.contenido_presentacion);
  return p !== null && f.presentacion ? `${cantidadTexto(p)} ${plural(f.presentacion, p)} · ${base}` : base;
}

/** Cuánto falta para llegar al mínimo (para sugerir la compra); nulo si no hay mínimo o ya está por encima. */
export function faltaParaMinimo(f: Pick<FilaInventario, "stock" | "stock_minimo">): number | null {
  if (f.stock === null || f.stock_minimo === null || f.stock > f.stock_minimo) return null;
  return f.stock_minimo - f.stock;
}

export type MotivoAjuste = "conteo" | "vencido" | "perdida" | "dano" | "otro";
export const MOTIVOS_AJUSTE: MotivoAjuste[] = ["conteo", "vencido", "perdida", "dano", "otro"];
export const ETIQUETA_MOTIVO_AJUSTE: Record<MotivoAjuste, string> = {
  conteo: "Conteo físico",
  vencido: "Vencido",
  perdida: "Pérdida",
  dano: "Dañado",
  otro: "Otro motivo",
};
export const DETALLE_MOTIVO_AJUSTE: Record<MotivoAjuste, string> = {
  conteo: "Contaste lo que hay y no coincide con la app",
  vencido: "Se descarta un lote vencido",
  perdida: "Se perdió o se extravió",
  dano: "Se dañó o se rompió",
  otro: "Cualquier otra razón; explícala en las observaciones",
};

/**
 * El cambio que deja un ajuste. Con «conteo físico» la persona escribe lo que contó y el cambio es la diferencia con lo que decía la app; con los demás motivos
 * escribe cuánto se descarta y el cambio es negativo. Nulo si no cambia nada (lo que contó coincide).
 */
export function cambioDeAjuste(motivo: MotivoAjuste, cantidad: number, stockActual: number): number | null {
  const cambio = motivo === "conteo" ? Math.round((cantidad - stockActual) * 100) / 100 : -Math.abs(cantidad);
  return cambio === 0 ? null : cambio;
}

/** En qué cuenta la persona: en presentaciones (frascos) si el producto tiene una definida; si no, en la unidad de la dosis. `factor` pasa lo que escribe a la unidad de la dosis. */
export function unidadDeConteo(f: Pick<FilaInventario, "unidad" | "presentacion" | "contenido_presentacion">): { nombre: string; factor: number } {
  return f.presentacion && f.contenido_presentacion ? { nombre: f.presentacion, factor: f.contenido_presentacion } : { nombre: f.unidad ?? "unidades", factor: 1 };
}

/** Dirección del formulario de ajuste ya abierto en «Vencido» y con el lote (y toda su cantidad) elegido. Sin lote, la pantalla toma el primero vencido. */
export function rutaBajaLote(productoId: string, lote?: string | null): string {
  return `/inventario/${productoId}/ajustar?motivo=vencido${lote ? `&lote=${encodeURIComponent(lote)}` : ""}`;
}

/** Lo que trae el formulario de ajuste al abrirse desde un aviso: motivo, lote y la cantidad que queda en él (en la unidad en que se cuenta). */
export function ajusteInicial(
  f: Pick<FilaInventario, "unidad" | "presentacion" | "contenido_presentacion">,
  lotes: FilaLote[],
  hoy: string,
  motivo: string | undefined,
  lote: string | undefined,
): { motivo: MotivoAjuste; lote: string | null; cantidad: string } | null {
  if (motivo !== "vencido") return null;
  const vencidos = lotes.filter((l) => l.vencimiento && l.stock > 0.004 && estadoVencimiento(l.vencimiento, hoy) === "vencido");
  const elegido = (lote ? vencidos.find((l) => l.lote === lote) : null) ?? vencidos[0];
  if (!elegido) return null;
  const { factor } = unidadDeConteo(f);
  const n = Math.round((elegido.stock / factor) * 100) / 100;
  return { motivo: "vencido", lote: elegido.lote, cantidad: String(n).replace(".", ",") };
}

/** Un problema del producto y qué hacer, paso a paso, para la ficha. */
export type PasoInventario = { clave: string; titulo: string; pasos: string[]; /** Botón que hace el paso principal sin volver a preguntar lo que ya se sabe (p. ej. dar de baja ese lote). */ accion?: { texto: string; href: string } };

const fechaCorta = (iso: string) => formatoFecha(iso, { day: "numeric", month: "short", year: "numeric" });

/**
 * Qué hay que hacer con un producto, dicho con las pantallas reales («Ajustar existencias», «Conteo físico»…). Lo que no se puede resolver aquí
 * (comprar, corregir una fecha mal escrita) se dice con el lugar donde se hace. Un producto sin problemas devuelve una lista vacía.
 */
export function pasosInventario(f: Pick<FilaInventario, "producto_id" | "desde" | "stock" | "stock_minimo" | "presentacion" | "unidad" | "contenido_presentacion">, lotes: FilaLote[], hoy: string): PasoInventario[] {
  const pasos: PasoInventario[] = [];
  if (!f.desde || f.stock === null) return pasos;
  for (const l of lotes) {
    if (estadoVencimiento(l.vencimiento, hoy) !== "vencido" || l.stock <= 0.004 || !l.vencimiento) continue;
    pasos.push({
      clave: `vencido-${l.lote ?? "sin"}`,
      titulo: `El lote ${l.lote ?? "sin nombre"} venció el ${fechaCorta(l.vencimiento)} y aún cuenta ${textoStock(f, l.stock)}`,
      accion: { texto: "Dar de baja este lote", href: rutaBajaLote(f.producto_id, l.lote) },
      pasos: [
        "Si el lote ya no se debe usar: sácalo de la bodega, toca «Ajustar existencias», elige el motivo «Vencido», ese lote y la cantidad que quedaba.",
        "Si la fecha de vencimiento está mal escrita: corrígela en la compra (Hato → Compras) o en el conteo de apertura, y el aviso se quita solo.",
      ],
    });
  }
  const estado = estadoStock(f);
  if (estado === "negativo") {
    pasos.push({
      clave: "descuadrado",
      titulo: `Se aplicó más de lo que decía la app (total ${textoStock(f, f.stock)})`,
      pasos: [
        "Cuenta lo que hay de verdad en la bodega.",
        "Toca «Ajustar existencias», motivo «Conteo físico», elige el lote y escribe lo que contaste: la app cuadra la diferencia.",
        "Si entró producto que no registraste, registra la compra en Hato → Compras.",
      ],
    });
  } else if (estado === "agotado") {
    pasos.push({ clave: "agotado", titulo: "Se agotó", pasos: ["Avisa al administrador para que lo compre.", "Cuando llegue, registra la compra en Hato → Compras: el inventario sube solo."] });
  } else if (estado === "bajo") {
    const falta = faltaParaMinimo(f);
    pasos.push({
      clave: "bajo",
      titulo: `Está en el mínimo o por debajo (quedan ${textoStock(f, f.stock)})`,
      pasos: [`Compra lo que falta${falta !== null ? ` (para volver al mínimo, ${textoStock(f, falta)})` : ""}.`, "Registra la compra en Hato → Compras: el inventario sube solo."],
    });
  }
  const pronto = lotes.filter((l) => l.vencimiento && l.stock > 0.004 && estadoVencimiento(l.vencimiento, hoy) === "pronto");
  for (const l of pronto) {
    pasos.push({
      clave: `pronto-${l.lote ?? "sin"}`,
      titulo: `El lote ${l.lote ?? "sin nombre"} vence el ${fechaCorta(l.vencimiento!)}`,
      pasos: ["Úsalo primero en las próximas aplicaciones (escribe este lote al registrarlas)."],
    });
  }
  return pasos;
}
