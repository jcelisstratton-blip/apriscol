import { diasHasta, formatoFecha } from "@/lib/fechas";
import type { AdvertenciaCeba, CandidatoCeba, ReglaCeba } from "@/lib/tipos";

/** Edad en lenguaje de persona: «5 meses», «3 años», «8 años y 6 meses». */
export function textoEdad(meses: number | null | undefined): string {
  if (meses == null) return "edad sin registrar";
  if (meses < 24) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  return `${a} años${m ? ` y ${m} ${m === 1 ? "mes" : "meses"}` : ""}`;
}

/** Meses a años con coma decimal solo si hace falta: 72 → «6», 78 → «6,5». */
export const añosDeMeses = (meses: number) => {
  const a = Math.round((meses / 12) * 10) / 10;
  return a.toLocaleString("es-CO", { maximumFractionDigits: 1 });
};

export const textoPartos = (n: number) => `${n} ${n === 1 ? "parto" : "partos"}`;

export const ETIQUETA_NIVEL: Record<CandidatoCeba["nivel"], string> = { toca: "Ya le toca", proxima: "Próximo" };

/** Qué explica cada motivo, con los números reales del animal y de las reglas de su finca. */
export function textosMotivos(c: CandidatoCeba, r: ReglaCeba): string[] {
  const toca = c.nivel === "toca";
  const salida: string[] = [];
  for (const m of c.motivos) {
    if (m === "partos" && c.partos_totales != null)
      salida.push(toca ? `Ya completó ${textoPartos(c.partos_totales)} (tu límite: ${r.hembra_partos_toca}).` : `Lleva ${textoPartos(c.partos_totales)} (tu límite: ${r.hembra_partos_toca}).`);
    else if (m === "edad") salida.push(`Tiene ${textoEdad(c.edad_meses)} (tu límite: ${añosDeMeses(r.hembra_meses_toca)} años).`);
    else if (m === "definir_uso")
      salida.push(toca ? `Tiene ${textoEdad(c.edad_meses)} y aún no decides si será reproductor o de carne.` : `Tiene ${textoEdad(c.edad_meses)}: pronto toca decidir si será reproductor o de carne.`);
    else if (m === "reproductor_viejo")
      salida.push(toca ? `Es reproductor y tiene ${textoEdad(c.edad_meses)}: conviene pensar en su reemplazo.` : `Es reproductor y se acerca a los ${añosDeMeses(r.reproductor_meses_viejo)} años: ve pensando en su reemplazo.`);
    else if (m === "carne_sin_lote") salida.push("Está marcado como de carne y todavía no está en un lote de ceba.");
  }
  return salida;
}

export type TextoAdvertencia = { codigo: AdvertenciaCeba; texto: string; tono: "aviso" | "alerta" | "neutro" };

/** Lo que hay que tener en cuenta antes de decidir: gestación, lactancia, retiro de carne y pesos al día. */
export function textosAdvertencias(c: CandidatoCeba, r: ReglaCeba, hoy: string): TextoAdvertencia[] {
  const diasSinPesar = c.fecha_ultimo_peso ? diasHasta(hoy, c.fecha_ultimo_peso) : null;
  const limitePeso = c.sexo === "hembra" ? r.hembra_dias_entre_pesajes : r.dias_entre_pesajes;
  const orden: AdvertenciaCeba[] = ["retiro_carne", "gestante", "probable_gestante", "lactancia", "sin_pesar"];
  return orden
    .filter((a) => c.advertencias.includes(a))
    .map((a): TextoAdvertencia => {
      switch (a) {
        case "gestante":
          return { codigo: a, tono: "aviso", texto: "Está gestante: déjala parir y destetar antes de sacarla. No se recomienda sacrificar hembras gestantes." };
        case "probable_gestante":
          return { codigo: a, tono: "aviso", texto: "Fue servida hace poco y no hay diagnóstico: confirma si quedó gestante antes de decidir." };
        case "lactancia":
          return { codigo: a, tono: "aviso", texto: "Está en lactancia: conviene esperar a que seque, salvo que su producción haya caído mucho." };
        case "retiro_carne":
          return { codigo: a, tono: "alerta", texto: `En retiro de carne hasta el ${formatoFecha(c.retiro_carne_hasta ?? hoy, { day: "numeric", month: "short" })}: no se puede sacrificar ni vender para consumo antes.` };
        case "sin_pesar":
          return {
            codigo: a,
            tono: "neutro",
            texto: diasSinPesar == null ? `Sin pesos todavía: conviene pesar cada ${limitePeso} días.` : `Sin pesar hace ${diasSinPesar} días (conviene cada ${limitePeso}).`,
          };
      }
    });
}

/** «28 kg · hace 12 días · 150 g/día». Sin pesos no hay línea: ya lo dice la advertencia de pesar. */
export function textoUltimoPeso(c: CandidatoCeba, hoy: string): string | null {
  if (c.peso_ultimo == null || !c.fecha_ultimo_peso) return null;
  const d = diasHasta(hoy, c.fecha_ultimo_peso);
  const peso = `${Number(c.peso_ultimo).toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg`;
  const hace = d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
  const g = c.gdp_reciente_g != null ? ` · ${Math.round(Number(c.gdp_reciente_g)).toLocaleString("es-CO")} g/día` : "";
  return `${peso} · ${hace}${g}`;
}

export type GrupoCandidatos = "todos" | "hembras" | "machos";
