/**
 * Lo que pide cada tipo de registro sanitario y por qué. Una sola fuente para el formulario, el servidor y la pantalla de detalle: qué opciones hay
 * (como tarjetas), qué es obligatorio, qué no aplica (y entonces no se pide ni se guarda), cuándo tiene retiro y cuándo conviene volver a ver al animal.
 * Las referencias (esquemas de vacunación, pediluvio, desparasitación) son prácticas habituales en cabras y ovejas; el veterinario del aprisco manda.
 */
import type { TipoEvento } from "@/lib/tipos";

export type OpcionCampo = { valor: string; etiqueta: string; detalle: string };

// ───────────────────────── Opciones por tipo ─────────────────────────
export const CATEGORIAS: Partial<Record<TipoEvento, OpcionCampo[]>> = {
  vacunacion: [
    { valor: "clostridiales", etiqueta: "Clostridiosis y tétanos", detalle: "Vacuna de 7 u 8 vías (CD&T). La más usada en cabras y ovejas." },
    { valor: "rabia", etiqueta: "Rabia", detalle: "Donde hay rabia paralítica (murciélagos). Pregunta a tu veterinario o al ICA." },
    { valor: "ectima", etiqueta: "Ectima contagioso", detalle: "Las «boqueras» o «orf», sobre todo en crías." },
    { valor: "neumonia", etiqueta: "Neumonía (Pasteurella)", detalle: "Problemas respiratorios, sobre todo en crías y animales estresados." },
    { valor: "linfadenitis", etiqueta: "Linfadenitis caseosa", detalle: "Abscesos en los ganglios («mal de los ganglios»)." },
    { valor: "otra", etiqueta: "Otra vacuna", detalle: "Escribe cuál en el nombre del producto." },
  ],
  desparasitacion: [
    { valor: "gastrointestinales", etiqueta: "Estómago e intestino", detalle: "Los más comunes y peligrosos (Haemonchus, el gusano de la «bolsa»)." },
    { valor: "coccidiosis", etiqueta: "Coccidiosis", detalle: "Diarrea en crías y animales jóvenes." },
    { valor: "pulmonares", etiqueta: "Gusano del pulmón", detalle: "Tos persistente." },
    { valor: "hepaticos", etiqueta: "Parásito del hígado", detalle: "Fasciola; frecuente en potreros húmedos." },
    { valor: "externos", etiqueta: "Piojos, garrapatas y sarna", detalle: "Parásitos de la piel." },
    { valor: "otro", etiqueta: "Otro parásito", detalle: "Escríbelo en las observaciones." },
  ],
  tratamiento: [
    { valor: "infeccion", etiqueta: "Infección", detalle: "Se trata con un antibiótico." },
    { valor: "respiratorio", etiqueta: "Respiratorio", detalle: "Neumonía, tos, secreción por la nariz." },
    { valor: "digestivo", etiqueta: "Digestivo", detalle: "Diarrea, timpanismo, indigestión." },
    { valor: "mastitis", etiqueta: "Mastitis", detalle: "Infección de la ubre." },
    { valor: "herida", etiqueta: "Herida o absceso", detalle: "Cortes, golpes, abscesos." },
    { valor: "reproductivo", etiqueta: "Reproductivo", detalle: "Retención de placenta, metritis, abortos." },
    { valor: "metabolico", etiqueta: "Metabólico o carencia", detalle: "Cetosis, hipocalcemia, anemia, falta de vitaminas." },
    { valor: "otro", etiqueta: "Otro problema", detalle: "Descríbelo en el diagnóstico." },
  ],
  podologia: [
    { valor: "recorte", etiqueta: "Recorte de pezuñas", detalle: "Mantenimiento: se corta el crecimiento excesivo." },
    { valor: "curacion", etiqueta: "Curación de una lesión", detalle: "Pododermatitis, podredumbre (gabarro), absceso." },
    { valor: "ambos", etiqueta: "Recorte y curación", detalle: "Se recortó y además se trató una lesión." },
  ],
  pediluvio: [
    { valor: "zinc", etiqueta: "Sulfato de zinc", detalle: "La más recomendada: efectiva y suave. Suele usarse al 10 %." },
    { valor: "formol", etiqueta: "Formol (formalina)", detalle: "Desinfectante fuerte: usa guantes y ventila. Revisa la etiqueta." },
    { valor: "cobre", etiqueta: "Sulfato de cobre", detalle: "No se recomienda en ovejas: puede ser tóxico si lo toman." },
    { valor: "otra", etiqueta: "Otra solución", detalle: "Escribe cuál en el nombre del producto." },
  ],
  cirugia: [
    { valor: "castracion", etiqueta: "Castración", detalle: "Machos que no serán reproductores." },
    { valor: "descorne", etiqueta: "Descorne", detalle: "Se recomienda tener al animal vacunado contra el tétanos." },
    { valor: "cesarea", etiqueta: "Cesárea", detalle: "La cesárea del parto se registra también en la ficha, en «Parto»." },
    { valor: "absceso", etiqueta: "Absceso o herida", detalle: "Drenaje, limpieza quirúrgica, suturas." },
    { valor: "hernia", etiqueta: "Hernia o prolapso", detalle: "Umbilical, vaginal o rectal." },
    { valor: "ubre", etiqueta: "Ubre", detalle: "Mastectomía, fístula o lesión del pezón." },
    { valor: "otra", etiqueta: "Otra cirugía", detalle: "Descríbela en el diagnóstico." },
  ],
};

export const ETAPAS: OpcionCampo[] = [
  { valor: "primera", etiqueta: "Primera dosis", detalle: "Primera vez que se vacuna contra esto: necesita refuerzo a las 3 o 4 semanas." },
  { valor: "refuerzo", etiqueta: "Refuerzo", detalle: "Segunda dosis de la primera vacunación." },
  { valor: "anual", etiqueta: "Revacunación", detalle: "Dosis de mantenimiento, normalmente una vez al año." },
];

export const MOTIVOS: OpcionCampo[] = [
  { valor: "famacha", etiqueta: "Según FAMACHA", detalle: "La mucosa del ojo salió pálida (4 o 5)." },
  { valor: "coprologico", etiqueta: "Según coprológico", detalle: "El conteo de huevos en el estiércol salió alto." },
  { valor: "rutina", etiqueta: "Rutina del plan", detalle: "Estaba programado, sin señales del animal." },
  { valor: "otro", etiqueta: "Otro motivo", detalle: "Escríbelo en las observaciones." },
];

export const COJERAS: OpcionCampo[] = [
  { valor: "0", etiqueta: "Camina normal", detalle: "Sin cojera." },
  { valor: "1", etiqueta: "Cojera leve", detalle: "Cojea, pero apoya bien la pata." },
  { valor: "2", etiqueta: "Cojera moderada", detalle: "Apoya poco la pata y se mueve con dificultad." },
  { valor: "3", etiqueta: "Cojera severa", detalle: "No apoya la pata o camina de rodillas." },
];

export const ANESTESIAS: OpcionCampo[] = [
  { valor: "ninguna", etiqueta: "Sin anestesia", detalle: "Procedimiento corto o sin dolor." },
  { valor: "local", etiqueta: "Anestesia local", detalle: "Solo se duerme la zona." },
  { valor: "sedacion", etiqueta: "Sedación", detalle: "Queda tranquilo, pero despierto." },
  { valor: "general", etiqueta: "Anestesia general", detalle: "Queda dormido." },
];

export const etiquetaDe = (opciones: OpcionCampo[] | undefined, valor: string | null | undefined) => opciones?.find((o) => o.valor === valor)?.etiqueta ?? null;

// ───────────────────────── Qué pide cada tipo ─────────────────────────
export type ModoRetiro = "abierto" | "plegado" | "oculto" | "segun_medicamento";
export type ModoProducto = "requerido" | "opcional" | "segun_medicamento";
export type ModoVeterinario = "requerido" | "opcional" | "no";

export type ReglasTipo = {
  /** Una frase para el dueño: qué es y qué se anota. */
  ayuda: string;
  tituloCategoria: string | null;
  producto: ModoProducto;
  /** Dosis y vía a la vista (no escondidas en «más detalles»). */
  dosisVisible: boolean;
  /** Dosis y vía obligatorias (un tratamiento). */
  dosisObligatoria: boolean;
  lote: boolean;
  retiro: ModoRetiro;
  ayudaRetiro: string;
  proxima: { etiqueta: string; ayuda: string; chips: { dias: number; texto: string }[] };
  veterinario: ModoVeterinario;
  etiquetaVeterinario: string;
  diagnostico: { etiqueta: string; ayuda: string; obligatorio: boolean } | null;
  etiquetaObservaciones: string;
  etapa?: boolean;
  motivo?: boolean;
  diasTratamiento?: boolean;
  cojera?: boolean;
  anestesia?: boolean;
  solucion?: boolean;
};

const RETIRO_ETIQUETA = "Mira la etiqueta del producto. Si no dice nada para cabras u ovejas, pregunta a tu veterinario: muchos medicamentos no están aprobados para ellas y tienen un retiro recomendado.";

export const REGLAS: Record<TipoEvento, ReglasTipo> = {
  vacunacion: {
    ayuda: "Anota contra qué enfermedad se vacunó, si es primera dosis, refuerzo o revacunación, y el lote de la vacuna. Así sabes cuándo toca la siguiente.",
    tituloCategoria: "¿Contra qué enfermedad?",
    producto: "requerido",
    dosisVisible: false,
    dosisObligatoria: false,
    lote: true,
    retiro: "plegado",
    ayudaRetiro: "La mayoría de las vacunas no tiene retiro. Si la etiqueta indica uno, anótalo.",
    proxima: {
      etiqueta: "Próxima dosis o refuerzo",
      ayuda: "Primera dosis: el refuerzo va a las 3 o 4 semanas. Después, una vez al año. Hembras gestantes: 2 a 4 semanas antes del parto.",
      chips: [{ dias: 21, texto: "3 semanas" }, { dias: 28, texto: "4 semanas" }, { dias: 180, texto: "6 meses" }, { dias: 365, texto: "1 año" }],
    },
    veterinario: "opcional",
    etiquetaVeterinario: "Aplicado por",
    diagnostico: null,
    etiquetaObservaciones: "Observaciones",
    etapa: true,
  },
  desparasitacion: {
    ayuda: "Anota contra qué parásito y por qué se desparasita. Pesa al animal antes: una dosis de menos deja parásitos vivos y crea resistencia.",
    tituloCategoria: "¿Contra qué parásito?",
    producto: "requerido",
    dosisVisible: true,
    dosisObligatoria: false,
    lote: true,
    retiro: "abierto",
    ayudaRetiro: RETIRO_ETIQUETA,
    proxima: {
      etiqueta: "Próxima revisión o desparasitación",
      ayuda: "Revisa con FAMACHA o coprológico a los 14 a 21 días para saber si funcionó. No desparasites a todo el hato por rutina: solo a quien lo necesita.",
      chips: [{ dias: 14, texto: "14 días" }, { dias: 21, texto: "21 días" }, { dias: 30, texto: "1 mes" }, { dias: 60, texto: "2 meses" }, { dias: 90, texto: "3 meses" }],
    },
    veterinario: "opcional",
    etiquetaVeterinario: "Aplicado por",
    diagnostico: null,
    etiquetaObservaciones: "Observaciones",
    motivo: true,
  },
  tratamiento: {
    ayuda: "Anota qué se está tratando, con qué, cuánto y por cuántos días. El retiro de la leche y de la carne cuenta desde la última dosis.",
    tituloCategoria: "¿Qué se está tratando?",
    producto: "requerido",
    dosisVisible: true,
    dosisObligatoria: true,
    lote: true,
    retiro: "abierto",
    ayudaRetiro: RETIRO_ETIQUETA,
    proxima: {
      etiqueta: "Próximo control",
      ayuda: "Opcional. Cuándo volver a revisar al animal para ver cómo va.",
      chips: [{ dias: 3, texto: "3 días" }, { dias: 5, texto: "5 días" }, { dias: 7, texto: "1 semana" }, { dias: 14, texto: "2 semanas" }, { dias: 21, texto: "3 semanas" }],
    },
    veterinario: "opcional",
    etiquetaVeterinario: "Aplicado por",
    diagnostico: { etiqueta: "Diagnóstico", ayuda: "Qué se detectó y se está tratando.", obligatorio: true },
    etiquetaObservaciones: "Observaciones",
    diasTratamiento: true,
  },
  podologia: {
    ayuda: "Anota qué se hizo en las pezuñas y cómo estaba el animal. Un recorte no deja retiro de leche ni de carne: solo lo deja un medicamento, si se aplicó.",
    tituloCategoria: "¿Qué se hizo?",
    producto: "segun_medicamento",
    dosisVisible: true,
    dosisObligatoria: false,
    lote: false,
    retiro: "segun_medicamento",
    ayudaRetiro: RETIRO_ETIQUETA,
    proxima: {
      etiqueta: "Próxima revisión",
      ayuda: "Con una lesión, vuelve a mirar a los 7 a 14 días. Un recorte de mantenimiento suele repetirse cada 2 a 4 meses, más seguido si el suelo es húmedo.",
      chips: [{ dias: 7, texto: "1 semana" }, { dias: 14, texto: "2 semanas" }, { dias: 30, texto: "1 mes" }, { dias: 90, texto: "3 meses" }, { dias: 180, texto: "6 meses" }],
    },
    veterinario: "opcional",
    etiquetaVeterinario: "Hecho por",
    diagnostico: { etiqueta: "Qué se encontró", ayuda: "Opcional. Por ejemplo: pezuña larga, mal olor, absceso en la pata trasera.", obligatorio: false },
    etiquetaObservaciones: "Observaciones",
    cojera: true,
  },
  pediluvio: {
    ayuda: "Anota la solución, qué tan concentrada estaba y cuánto tiempo estuvieron los animales en el baño. Un pediluvio no deja retiro de leche ni de carne.",
    tituloCategoria: "¿Qué solución se usó?",
    producto: "opcional",
    dosisVisible: false,
    dosisObligatoria: false,
    lote: false,
    retiro: "oculto",
    ayudaRetiro: "",
    proxima: {
      etiqueta: "Próximo pediluvio",
      ayuda: "Mientras haya casos de cojera suele repetirse cada semana; de mantenimiento, cada 2 a 4 semanas.",
      chips: [{ dias: 7, texto: "1 semana" }, { dias: 14, texto: "2 semanas" }, { dias: 21, texto: "3 semanas" }, { dias: 30, texto: "1 mes" }],
    },
    veterinario: "no",
    etiquetaVeterinario: "Hecho por",
    diagnostico: null,
    etiquetaObservaciones: "Observaciones",
    solucion: true,
  },
  cirugia: {
    ayuda: "Anota qué cirugía fue, por qué, con qué anestesia y quién la hizo. Los medicamentos que se usaron pueden dejar retiro de leche y de carne.",
    tituloCategoria: "¿Qué cirugía fue?",
    producto: "opcional",
    dosisVisible: false,
    dosisObligatoria: false,
    lote: false,
    retiro: "abierto",
    ayudaRetiro: RETIRO_ETIQUETA,
    proxima: {
      etiqueta: "Retiro de puntos o control",
      ayuda: "Los puntos suelen retirarse a los 10 a 14 días, según la cirugía.",
      chips: [{ dias: 7, texto: "7 días" }, { dias: 10, texto: "10 días" }, { dias: 14, texto: "14 días" }],
    },
    veterinario: "requerido",
    etiquetaVeterinario: "Operado por",
    diagnostico: { etiqueta: "Motivo o diagnóstico", ayuda: "Por qué se operó.", obligatorio: true },
    etiquetaObservaciones: "Cuidados después de la cirugía y medicamentos",
    anestesia: true,
  },
  otro: {
    ayuda: "Para lo que no entra en las otras opciones. Cuéntalo con claridad: qué se hizo.",
    tituloCategoria: null,
    producto: "opcional",
    dosisVisible: false,
    dosisObligatoria: false,
    lote: true,
    retiro: "plegado",
    ayudaRetiro: "Solo si el producto que usaste indica retiro.",
    proxima: {
      etiqueta: "Próxima vez",
      ayuda: "Opcional.",
      chips: [{ dias: 7, texto: "1 semana" }, { dias: 15, texto: "15 días" }, { dias: 30, texto: "1 mes" }, { dias: 90, texto: "3 meses" }],
    },
    veterinario: "opcional",
    etiquetaVeterinario: "Hecho por",
    diagnostico: { etiqueta: "¿Qué se hizo?", ayuda: "Descríbelo en pocas palabras.", obligatorio: true },
    etiquetaObservaciones: "Observaciones",
  },
};

/** Cuántos días falta para la próxima vez, según el tipo y, en una vacuna, la etapa. Vacío si no hay una sugerencia. */
export function diasSugeridosProxima(tipo: TipoEvento, etapa: string): number | null {
  if (tipo === "vacunacion") return etapa === "primera" ? 28 : etapa === "refuerzo" || etapa === "anual" ? 365 : null;
  return null;
}

// ───────────────────────── Validar y limpiar en el servidor ─────────────────────────
export type EntradaEvento = {
  categoria?: string;
  motivo?: string;
  etapa?: string;
  dias_tratamiento?: number;
  cojera?: number;
  concentracion_pct?: number;
  minutos?: number;
  anestesia?: string;
  diagnostico?: string;
  responsable?: string;
  producto?: string;
  dosis?: number;
  via?: string;
};

export type ExtraEvento = {
  categoria: string | null;
  motivo: string | null;
  etapa: string | null;
  dias_tratamiento: number | null;
  cojera: number | null;
  concentracion_pct: number | null;
  minutos: number | null;
  anestesia: string | null;
};

/** Lo que no pertenece al tipo se descarta (un pediluvio no guarda dosis ni retiro; una podología sin medicamento tampoco). */
export type LimpiezaEvento = { diagnostico: boolean; dosis: boolean; lote: boolean; retiro: boolean };

const en = (opciones: OpcionCampo[] | undefined, v: string | undefined) => Boolean(v && opciones?.some((o) => o.valor === v));

/**
 * Cada tipo pide y guarda lo suyo. Con `exigir` (al registrar uno nuevo) lo esencial es obligatorio; al corregir un registro antiguo no se exige, para no bloquearlo,
 * pero lo que se escriba sí se valida.
 */
export function datosPorTipoEvento(tipo: TipoEvento, e: EntradaEvento, exigir: boolean): { error: string } | { extra: ExtraEvento; limpiar: LimpiezaEvento } {
  const r = REGLAS[tipo];
  const extra: ExtraEvento = { categoria: null, motivo: null, etapa: null, dias_tratamiento: null, cojera: null, concentracion_pct: null, minutos: null, anestesia: null };

  const opciones = CATEGORIAS[tipo];
  if (opciones) {
    if (e.categoria && !en(opciones, e.categoria)) return { error: "Elige una de las opciones." };
    if (exigir && !e.categoria) return { error: `Elige una opción en «${r.tituloCategoria ?? "¿Qué es?"}».` };
    extra.categoria = e.categoria ?? null;
  }
  if (r.etapa) {
    if (e.etapa && !en(ETAPAS, e.etapa)) return { error: "Elige si es primera dosis, refuerzo o revacunación." };
    if (exigir && !e.etapa) return { error: "Indica si es primera dosis, refuerzo o revacunación." };
    extra.etapa = e.etapa ?? null;
  }
  if (r.motivo) {
    if (e.motivo && !en(MOTIVOS, e.motivo)) return { error: "Elige el motivo de la desparasitación." };
    if (exigir && !e.motivo) return { error: "Indica por qué se desparasita: FAMACHA, coprológico o rutina." };
    extra.motivo = e.motivo ?? null;
  }
  if (r.diasTratamiento) extra.dias_tratamiento = e.dias_tratamiento ?? 1;
  if (r.cojera && e.cojera !== undefined) {
    if (!Number.isInteger(e.cojera) || e.cojera < 0 || e.cojera > 3) return { error: "El grado de cojera va de 0 a 3." };
    extra.cojera = e.cojera;
  }
  if (r.solucion) {
    if (exigir && e.concentracion_pct === undefined) return { error: "Escribe la concentración de la solución, en porcentaje (por ejemplo 10)." };
    if (exigir && e.minutos === undefined) return { error: "Escribe cuántos minutos estuvieron los animales en el baño." };
    extra.concentracion_pct = e.concentracion_pct ?? null;
    extra.minutos = e.minutos ?? null;
  }
  if (r.anestesia) {
    if (e.anestesia && !en(ANESTESIAS, e.anestesia)) return { error: "Elige la anestesia que se usó." };
    if (exigir && !e.anestesia) return { error: "Indica la anestesia que se usó (si no hubo, «Sin anestesia»)." };
    extra.anestesia = e.anestesia ?? null;
  }
  if (r.diagnostico?.obligatorio && exigir && !e.diagnostico) return { error: `Escribe el campo «${r.diagnostico.etiqueta}».` };
  if (r.veterinario === "requerido" && exigir && !e.responsable) return { error: "Elige o escribe quién hizo la cirugía." };
  if (r.dosisObligatoria && exigir) {
    if (e.dosis === undefined) return { error: "Escribe la dosis que se aplicó." };
    if (!e.via) return { error: "Elige por dónde se aplicó (la vía)." };
  }

  if (tipo === "podologia" && !e.producto && (e.dosis !== undefined || e.via)) return { error: "Elige el producto que se aplicó, o marca que no se aplicó un medicamento." };
  const sinMedicamento = tipo === "podologia" && !e.producto;
  return {
    extra,
    limpiar: {
      diagnostico: !r.diagnostico,
      dosis: tipo === "pediluvio" || sinMedicamento,
      lote: !r.lote && (tipo === "pediluvio" || sinMedicamento),
      retiro: tipo === "pediluvio" || sinMedicamento,
    },
  };
}
