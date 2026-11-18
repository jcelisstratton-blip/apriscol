import { diasHasta } from "@/lib/fechas";
import type { Cobertura, CoberturaRaza, Especie } from "@/lib/tipos";

/**
 * Esquila de ovejas (reglas puras; el detalle está en `docs/modulos/esquila.md`).
 *
 * En Colombia hay ovejas de lana y ovejas de pelo, y muchas que pueden ser de las dos (criollas, cruces): por eso la cobertura se decide así,
 * y NUNCA se guarda como resultado — se calcula cada vez:
 *  1. si la oveja trae su propia cobertura («lana» o «pelo»), manda esa;
 *  2. si no, la de su raza: «lana» o «pelo»;
 *  3. si la raza es «variable» (o la oveja no tiene raza), queda «por definir» y la app le pide a la persona que lo defina antes de esquilarla.
 * Solo las de lana se esquilan. Las cabras no se esquilan: no tienen cobertura.
 */

/** Cada cuánto se esquila una oveja de lana, por defecto (una vez al año). */
export const ESQUILA_CADA_MESES = 12;
/** Cuántos días antes de la fecha prevista se avisa que «toca esquilar». */
export const ESQUILA_AVISO_DIAS = 30;

export type CoberturaEfectiva = Cobertura | "por_definir";

/** La cobertura con la que se trata a un animal. `null` = no aplica (las cabras no se esquilan). */
export function coberturaEfectiva(especie: Especie, propia: Cobertura | null | undefined, raza: CoberturaRaza | null | undefined): CoberturaEfectiva | null {
  if (especie !== "ovino") return null;
  if (propia === "lana" || propia === "pelo") return propia;
  if (raza === "lana" || raza === "pelo") return raza;
  return "por_definir";
}

/** Se esquila solo si es una oveja de lana. */
export const seEsquila = (c: CoberturaEfectiva | null): boolean => c === "lana";

export const ETIQUETA_COBERTURA: Record<CoberturaEfectiva, string> = { lana: "De lana", pelo: "De pelo", por_definir: "Por definir" };

/** Qué le pasa a una oveja de lana respecto de su esquila. */
export type EstadoEsquila = "sin_esquila" | "al_dia" | "toca" | "atrasada";

export type PlazoEsquila = { estado: EstadoEsquila; /** Fecha en que le toca la próxima esquila (null si nunca se ha esquilado). */ proxima: string | null; /** Días que faltan (negativo = ya pasó). */ dias: number | null };

/** Suma meses a una fecha «AAAA-MM-DD» sin pasarse del fin de mes (31 de agosto + 6 meses = 28 de febrero, no 3 de marzo). */
export function sumarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const indice = (m - 1) + meses;
  const anio = a + Math.floor(indice / 12);
  const mes = ((indice % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/** Estado de una oveja de lana según su última esquila. Sin esquila registrada no se inventa una fecha: queda «sin esquila». */
export function plazoEsquila(ultima: string | null, hoy: string, cadaMeses = ESQUILA_CADA_MESES, avisoDias = ESQUILA_AVISO_DIAS): PlazoEsquila {
  if (!ultima) return { estado: "sin_esquila", proxima: null, dias: null };
  const proxima = sumarMeses(ultima, cadaMeses);
  const dias = diasHasta(proxima, hoy);
  return { estado: dias < 0 ? "atrasada" : dias <= avisoDias ? "toca" : "al_dia", proxima, dias };
}

/** «2,4 kg» (coma decimal, sin ceros de más). */
export const kilosVellon = (n: number | null | undefined): string => (n == null ? "—" : `${Number(n.toFixed(2)).toLocaleString("es-CO")} kg`);

/** Lo que dice la oveja según su estado, en palabras llanas. */
export function textoPlazo(p: PlazoEsquila): string {
  if (p.estado === "sin_esquila") return "Sin esquila registrada";
  if (p.estado === "atrasada") return `Atrasada ${Math.abs(p.dias!)} ${Math.abs(p.dias!) === 1 ? "día" : "días"}`;
  if (p.estado === "toca") return p.dias === 0 ? "Le toca hoy" : `Le toca en ${p.dias} ${p.dias === 1 ? "día" : "días"}`;
  return `Próxima en ${p.dias} días`;
}

/** Lo mínimo de una oveja para contar y ordenar el trabajo de esquila. */
export type OvejaParaEsquila = { cobertura: CoberturaEfectiva; plazo: PlazoEsquila | null };

export type ResumenEsquila = {
  total: number;
  lana: number;
  pelo: number;
  porDefinir: number;
  /** De las de lana: las que ya pasaron su fecha, las que les toca pronto y las que nunca se han esquilado en la app. */
  atrasadas: number;
  tocan: number;
  sinEsquila: number;
  alDia: number;
};

export function resumirEsquila(ovejas: OvejaParaEsquila[]): ResumenEsquila {
  const r: ResumenEsquila = { total: ovejas.length, lana: 0, pelo: 0, porDefinir: 0, atrasadas: 0, tocan: 0, sinEsquila: 0, alDia: 0 };
  for (const o of ovejas) {
    if (o.cobertura === "pelo") r.pelo++;
    else if (o.cobertura === "por_definir") r.porDefinir++;
    else {
      r.lana++;
      if (o.plazo?.estado === "atrasada") r.atrasadas++;
      else if (o.plazo?.estado === "toca") r.tocan++;
      else if (o.plazo?.estado === "sin_esquila") r.sinEsquila++;
      else r.alDia++;
    }
  }
  return r;
}

const ORDEN: Record<EstadoEsquila, number> = { atrasada: 0, toca: 1, sin_esquila: 2, al_dia: 3 };

/** Primero lo más urgente: las atrasadas (la más atrasada arriba), las que les toca (la más cercana arriba), las que nunca se han esquilado y, al final, las que están al día. */
export function ordenarPorUrgencia<T extends { plazo: PlazoEsquila | null }>(ovejas: T[]): T[] {
  return [...ovejas].sort((a, b) => {
    const ea = a.plazo ? ORDEN[a.plazo.estado] : 9;
    const eb = b.plazo ? ORDEN[b.plazo.estado] : 9;
    return ea - eb || (a.plazo?.dias ?? 0) - (b.plazo?.dias ?? 0);
  });
}
