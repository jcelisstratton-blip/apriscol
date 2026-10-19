import { CRIOSCOPIA_MAX, CRIOSCOPIA_MIN, estadoResiduos, formatoCrioscopia, formatoMiles } from "@/lib/leche-calidad";
import type { AnalisisLeche, ControlCalidad, ResultadoControl, TipoBaja, TipoControl } from "@/lib/tipos";

/** Los controles de calidad que se responden en cada despacho de leche. */
export const CONTROLES_DESPACHO: TipoControl[] = ["residuos_antibioticos", "crioscopia", "composicion", "celulas_somaticas"];

/**
 * Los controles de un animal que sale para consumo: la condición corporal (antes de salir) y, si se sacrificó, la inspección del
 * matadero. Una venta en pie, una muerte o una pérdida no llevan controles.
 */
export function controlesDeSalida(tipo: TipoBaja, destinoConsumo: boolean): TipoControl[] {
  if (tipo === "sacrificio") return ["condicion_corporal", "inspeccion_postmortem"];
  if (tipo === "venta" && destinoConsumo) return ["condicion_corporal"];
  return [];
}

export type InfoControl = {
  titulo: string;
  /** Cómo se mide, en palabras de persona. */
  comoSeMide: string;
  /** Si se respalda con un documento (informe, acta); la condición corporal se evalúa a mano y no lleva. */
  conDocumento: boolean;
};

export const INFO_CONTROL: Record<TipoControl, InfoControl> = {
  residuos_antibioticos: {
    titulo: "Residuos de antibióticos",
    comoSeMide: "Con tiras reactivas rápidas o una prueba de inhibición microbiana, antes de despachar. Si da positivo, esa leche no se despacha.",
    conDocumento: true,
  },
  crioscopia: {
    titulo: "Pureza (crioscopia)",
    comoSeMide: `Mide el punto de congelación de la leche. La pura congela entre ${CRIOSCOPIA_MIN.toLocaleString("es-CO")} y ${CRIOSCOPIA_MAX.toLocaleString("es-CO")} °C; más cerca de cero puede ser agua añadida.`,
    conDocumento: true,
  },
  composicion: {
    titulo: "Composición",
    comoSeMide: "Grasa, proteína, sólidos y lactosa con un analizador de leche (ultrasonido o infrarrojo). De esto depende el pago por calidad.",
    conDocumento: true,
  },
  celulas_somaticas: {
    titulo: "Células somáticas",
    comoSeMide: "Conteo en laboratorio. Indica la salud de la ubre y avisa de mastitis que aún no se ve.",
    conDocumento: true,
  },
  condicion_corporal: {
    titulo: "Condición corporal",
    comoSeMide: "Escala de 1 a 5, palpando el lomo y la base de la cola antes de que el animal salga: dice cuánta carne y grasa tiene.",
    conDocumento: false,
  },
  inspeccion_postmortem: {
    titulo: "Inspección en el matadero",
    comoSeMide: "La hace el médico veterinario inspector: revisa la grasa y la conformación de la canal y que no haya hematomas, abscesos, parásitos ni signos de enfermedad.",
    conDocumento: true,
  },
};

/**
 * Cuántos días antes del despacho puede ser el análisis que lo respalda. La prueba de antibióticos tiene que ser casi del momento;
 * la composición y las células cambian más despacio. Es un criterio nuestro: el comprador puede exigir otro.
 */
export const VENTANA_DIAS: Partial<Record<TipoControl, number>> = {
  residuos_antibioticos: 3,
  crioscopia: 7,
  composicion: 30,
  celulas_somaticas: 30,
};

/** ¿El análisis trae el resultado que pide este control? (Lo mismo que comprueba la base.) */
export function analisisTraeResultado(a: Pick<AnalisisLeche, "residuos_antibioticos" | "crioscopia_c" | "grasa_pct" | "proteina_pct" | "solidos_totales_pct" | "lactosa_pct" | "rcs_miles_ml">, tipo: TipoControl): boolean {
  switch (tipo) {
    case "residuos_antibioticos":
      return a.residuos_antibioticos != null;
    case "crioscopia":
      return a.crioscopia_c != null;
    case "composicion":
      return a.grasa_pct != null || a.proteina_pct != null || a.solidos_totales_pct != null || a.lactosa_pct != null;
    case "celulas_somaticas":
      return a.rcs_miles_ml != null;
    default:
      return false;
  }
}

/** Si el resultado del análisis es conforme. La composición no se califica (depende de lo que pague cada comprador). */
export function resultadoDeAnalisis(a: AnalisisLeche, tipo: TipoControl, limiteRcs: number): ResultadoControl | null {
  if (tipo === "residuos_antibioticos") return a.residuos_antibioticos === "negativo" ? "conforme" : "no_conforme";
  if (tipo === "crioscopia") return a.crioscopia_c != null && a.crioscopia_c >= CRIOSCOPIA_MIN && a.crioscopia_c <= CRIOSCOPIA_MAX ? "conforme" : "no_conforme";
  if (tipo === "celulas_somaticas") return a.rcs_miles_ml != null && a.rcs_miles_ml <= limiteRcs ? "conforme" : "no_conforme";
  return null;
}

export type ResumenControles = { total: number; realizados: number; noRealizados: number; sinResponder: number; completo: boolean };

/** Cuántos de los controles que aplican están hechos, declarados como no realizados o todavía sin responder. */
export function resumenControles(aplican: TipoControl[], filas: Pick<ControlCalidad, "tipo" | "estado">[]): ResumenControles {
  const porTipo = new Map(filas.map((f) => [f.tipo, f.estado]));
  const realizados = aplican.filter((t) => porTipo.get(t) === "realizado").length;
  const noRealizados = aplican.filter((t) => porTipo.get(t) === "no_realizado").length;
  return { total: aplican.length, realizados, noRealizados, sinResponder: aplican.length - realizados - noRealizados, completo: aplican.length > 0 && realizados + noRealizados === aplican.length };
}

/** El texto corto y el tono de un resumen, para la etiqueta de una fila. */
export function etiquetaResumen(r: ResumenControles): { tono: "ok" | "aviso" | "alerta" | "neutro"; texto: string } {
  if (r.total === 0) return { tono: "neutro", texto: "Sin controles" };
  if (r.sinResponder > 0) return { tono: "aviso", texto: r.sinResponder === 1 ? "Falta responder 1 control" : `Faltan por responder ${r.sinResponder} controles` };
  if (r.noRealizados > 0) return { tono: "neutro", texto: r.noRealizados === 1 ? "1 control no realizado" : `${r.noRealizados} controles no realizados` };
  return { tono: "ok", texto: r.total === 1 ? "Control realizado" : `${r.total} controles realizados` };
}

/** Los valores de condición corporal que se ofrecen: de 1 a 5, de medio en medio. */
export const VALORES_CONDICION = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;


const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;

/** El resultado que importa de un análisis para un control, en una línea: «Crioscopia -0,535 °C», «Antibióticos: sin residuos»… */
export function resumenAnalisis(a: AnalisisLeche, tipo: TipoControl): string {
  const partes: (string | null)[] = [];
  if (tipo === "residuos_antibioticos" && a.residuos_antibioticos) partes.push(`Antibióticos: ${estadoResiduos(a.residuos_antibioticos).texto.toLowerCase()}`);
  if (tipo === "crioscopia" && a.crioscopia_c != null) partes.push(`Crioscopia ${formatoCrioscopia(a.crioscopia_c)}`);
  if (tipo === "composicion") {
    if (a.grasa_pct != null) partes.push(`Grasa ${pct(a.grasa_pct)}`);
    if (a.proteina_pct != null) partes.push(`Proteína ${pct(a.proteina_pct)}`);
    if (a.solidos_totales_pct != null) partes.push(`Sólidos ${pct(a.solidos_totales_pct)}`);
    if (a.lactosa_pct != null) partes.push(`Lactosa ${pct(a.lactosa_pct)}`);
  }
  if (tipo === "celulas_somaticas" && a.rcs_miles_ml != null) partes.push(`Células ${formatoMiles(a.rcs_miles_ml)}`);
  partes.push(a.muestra, a.laboratorio);
  return partes.filter(Boolean).join(" · ");
}
