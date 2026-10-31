import { diasDesde, diasHasta, formatoFecha, sumarDias } from "@/lib/fechas";
import { puedeVer } from "@/lib/permisos";
import { DIAS_PARTO_ATRASADO, porSecar as debeSecarse, enUltimoTercio, seguimientoServida, type VentanaDx } from "@/lib/reproduccion";
import { estadoFamacha } from "@/lib/famacha";
import { HPG_ALTO, HPG_MUY_ALTO, interpretarHpg } from "@/lib/coprologico";
import { ETIQUETA_MANTENIMIENTO, estadoCrioscopia, estadoRcs, estadoTemperatura, formatoCrioscopia, formatoMiles, pendientesMantenimiento, pesos, type PendienteEquipo } from "@/lib/leche-calidad";
import { ETIQUETA_PRUEBA_CORTA, estadoDosis, estadoFechaPrograma, revisionAtrasada } from "@/lib/sanidad";
import { esBaja, mensajeBaja, type Tendencia } from "@/lib/produccion";
import { estadoCuarentena, textoRotacion } from "@/lib/corrales";
import { sugerirDestinos } from "@/lib/sugerencias-corral";
import { DIAS_AVISO_VENCIMIENTO, estadoStock, estadoVencimiento, rutaBajaLote, rutaConteoTotal, textoStock, type FilaInventario } from "@/lib/inventario";
import { autonomiaDias, diasTexto, estadoAlimento, textoKg, type FilaAlimento } from "@/lib/inventario-alimento";
import type { CuarentenaAlerta, MantenimientoOrdeno, ModuloApp, PlanId, ReproHembra, RolFinca, TipoPrueba, UbicacionVista } from "@/lib/tipos";

/**
 * Semáforos: una sola lectura del estado del hato para actuar a tiempo. Cada señal junta lo que la app ya sabe calcular (partos, FAMACHA, dosis,
 * frío, calidad…) en tres niveles con el mismo significado en toda la app: **rojo** = actúa hoy, **ámbar** = programa una acción, **verde** = en orden.
 * Aquí viven las reglas (puras, con prueba); `lib/semaforos-servidor.ts` trae los datos y `components/Semaforos.tsx` los dibuja.
 */

export type AreaSemaforo = "reproduccion" | "sanidad" | "leche" | "ceba" | "corrales" | "inventario" | "alimento" | "dinero";
export const ETIQUETA_AREA: Record<AreaSemaforo, string> = { reproduccion: "Reproducción", sanidad: "Sanidad", leche: "Leche", ceba: "Ceba", corrales: "Corrales", inventario: "Inventario", alimento: "Alimento", dinero: "Dinero" };
const MODULO_DE_AREA: Record<AreaSemaforo, ModuloApp> = { reproduccion: "reproduccion", sanidad: "sanidad", leche: "leche", ceba: "carne", corrales: "corrales", inventario: "inventario", alimento: "nutricion", dinero: "contabilidad" };

/**
 * Qué áreas ve cada rol: solo lo suyo. El veterinario, reproducción y sanidad; el ordeñador, leche; el contador, dinero; el propietario y el administrador, todo.
 * (Si luego se le abren más áreas a un rol, se cambia aquí y nada más.) Además deben estar en su plan.
 */
const AREAS_DEL_ROL: Record<RolFinca, AreaSemaforo[]> = {
  propietario: ["reproduccion", "sanidad", "leche", "ceba", "corrales", "inventario", "alimento", "dinero"],
  administrador: ["reproduccion", "sanidad", "leche", "ceba", "corrales", "inventario", "alimento", "dinero"],
  veterinario: ["reproduccion", "sanidad", "inventario"],
  ordenador: ["leche", "alimento"],
  contador: ["dinero"],
};

export function areasSemaforo(rol: RolFinca, plan: PlanId): AreaSemaforo[] {
  return AREAS_DEL_ROL[rol].filter((a) => puedeVer(rol, MODULO_DE_AREA[a], plan));
}

export type NivelItem = "rojo" | "ambar";
export type Nivel = NivelItem | "verde";

export type ItemSenal = {
  clave: string;
  /** Quién o qué es: «Luna · MIR-C0001», «Tanque de frío». */
  etiqueta: string;
  /** Por qué está en este nivel, en una frase. */
  detalle: string;
  nivel: NivelItem;
  href: string;
  /** Qué hacer ahora con este caso, en una frase (opcional). */
  queHacer?: string;
  /** Solo en lo que tiene fecha límite: cuántos días lleva vencido (0 = todavía no vence). Sirve para separar lo vencido de lo pendiente. */
  atrasoDias?: number;
  /** Si está, el caso ya se atendió hace poco y no cuenta como pendiente: es lo que se muestra («Pesado hoy»). */
  atendido?: string;
  /** Más chico = más urgente dentro de su nivel. */
  orden: number;
};

export type Senal = {
  id: string;
  area: AreaSemaforo;
  titulo: string;
  nivel: Nivel;
  /** «2 en rojo · 5 en ámbar» o «En orden». */
  resumen: string;
  items: ItemSenal[];
  /** Casos que la persona ya atendió hace poco (p. ej. un animal pesado hoy): no cuentan en el nivel ni en el resumen y se ven aparte, para que no parezcan pendientes. */
  atendidos: ItemSenal[];
  /** Qué hacer con esta tarea, en una o dos frases claras (siempre se escribe: toda señal nueva lleva la suya). */
  queHacer: string;
  queSignifica: string;
  regla: string;
  accion?: { texto: string; href: string };
  nota?: string;
  /**
   * Para las señales que NO se quitan al registrar algo (dependen de una tendencia, de un resultado nuevo o del paso del tiempo): por qué el caso
   * sigue en la lista aunque la persona ya haya hecho lo que tocaba, y qué lo saca. Evita que parezca que «no se guardó».
   */
  sigueAqui?: string;
};

type BaseSenal = Pick<Senal, "id" | "area" | "titulo" | "queHacer" | "queSignifica" | "regla" | "accion" | "nota" | "sigueAqui">;

/** Arma la señal: ordena (rojo primero, luego lo más urgente), calcula su nivel y su resumen. */
export function armarSenal(base: BaseSenal, items: ItemSenal[]): Senal {
  if (!base.queHacer?.trim()) throw new Error(`La señal «${base.id}» no dice qué hacer.`);
  const atendidos = items.filter((i) => i.atendido);
  items = items.filter((i) => !i.atendido);
  const ordenados = [...items].sort((a, b) => (a.nivel === b.nivel ? a.orden - b.orden : a.nivel === "rojo" ? -1 : 1));
  const rojos = ordenados.filter((i) => i.nivel === "rojo").length;
  const ambar = ordenados.length - rojos;
  const nivel: Nivel = rojos > 0 ? "rojo" : ambar > 0 ? "ambar" : "verde";
  const partes = [rojos > 0 ? `${rojos} en rojo` : null, ambar > 0 ? `${ambar} en ámbar` : null].filter(Boolean);
  return { ...base, nivel, resumen: partes.length ? partes.join(" · ") : "En orden", items: ordenados, atendidos };
}

/** Cuántos rojos y ámbar hay en total, para el encabezado. */
export function contarSenales(senales: Senal[]): { rojo: number; ambar: number; verde: number } {
  return {
    rojo: senales.filter((s) => s.nivel === "rojo").length,
    ambar: senales.filter((s) => s.nivel === "ambar").length,
    verde: senales.filter((s) => s.nivel === "verde").length,
  };
}

const corta = (iso: string) => formatoFecha(iso, { day: "numeric", month: "short" });
const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
type Etiqueta = (animalId: string) => string;
const fichaAnimal = (id: string, ancla?: string) => (ancla ? `/hato/${id}#${ancla}` : `/hato/${id}`);

// ───────────────────────── Reproducción ─────────────────────────
/** Desde cuántos días antes del parto conviene preparar la maternidad y la vacuna, y desde cuántos vigilarla a diario (Ajustes de la finca). */
export type PlazosParto = { preparar: number; vigilar: number };

const enGestacion = (f: Pick<ReproHembra, "estado">) => f.estado === "gestante" || f.estado === "servida";

export function senalPartos(filas: ReproHembra[], hoy: string, plazos: PlazosParto, etiqueta: Etiqueta): Senal {
  const items: ItemSenal[] = [];
  for (const f of filas) {
    if (!enGestacion(f) || !f.fecha_prevista_parto) continue;
    const d = diasHasta(f.fecha_prevista_parto, hoy);
    if (d > plazos.preparar) continue;
    const estimada = f.estado === "servida" ? " · fecha estimada, sin confirmar" : "";
    let nivel: NivelItem = "ambar";
    let detalle: string;
    let queHacer: string | undefined;
    if (d < -DIAS_PARTO_ATRASADO) {
      nivel = "rojo";
      queHacer = "Revisa si ya parió y no se registró: si parió, registra el parto; si abortó, registra el aborto. Si sigue gestante, que el veterinario la examine y confirme la fecha del servicio.";
      detalle = `Atrasada ${dias(-d)}: su fecha era el ${corta(f.fecha_prevista_parto)}`;
    } else if (d < 0) {
      detalle = `Debió parir hace ${dias(-d)}`;
      queHacer = "Vigílala hoy mismo. Si ya parió, registra el parto.";
    } else if (d === 0) {
      detalle = "Pare hoy";
    } else if (d <= plazos.vigilar) {
      detalle = `Pare en ${dias(d)}: vigílala a diario`;
    } else {
      detalle = `Pare en ${dias(d)}: prepara la maternidad y la vacuna`;
    }
    items.push({ clave: `parto-${f.animal_id}`, etiqueta: etiqueta(f.animal_id), detalle: detalle + estimada, nivel, href: fichaAnimal(f.animal_id, "reproduccion"), queHacer, orden: d });
  }
  return armarSenal(
    {
      id: "partos",
      area: "reproduccion",
      titulo: "Partos que se acercan",
      queHacer: "Prepara el lugar de parto (maternidad) y vigila a diario a las que están cerca. Cuando paran, registra el parto; si ya pasó la fecha, revísala hoy.",
      queSignifica: `Hembras gestantes o servidas cuyo parto previsto llega en los próximos ${plazos.preparar} días, o que ya pasó su fecha.`,
      regla: `Ámbar: faltan ${plazos.preparar} días o menos (a ${plazos.vigilar} o menos, vigilarla a diario) o pasó hasta ${DIAS_PARTO_ATRASADO} días. Rojo: pasaron más de ${DIAS_PARTO_ATRASADO} días de su fecha sin parir.`,
      accion: { texto: "Ver Reproducción", href: "/reproduccion" },
      nota: "Si la hembra solo está servida, la fecha es una estimación hasta que se confirme la gestación.",
    },
    items,
  );
}

/** Dos señales de lo mismo: servidas a las que ya toca diagnóstico, y diagnósticos dudosos por repetir. */
export function senalesDiagnostico(filas: ReproHembra[], hoy: string, ventana: VentanaDx, etiqueta: Etiqueta): Senal[] {
  const confirmar: ItemSenal[] = [];
  const repetir: ItemSenal[] = [];
  for (const f of filas) {
    const s = seguimientoServida(f, hoy, ventana);
    if (!s || s.estado === "pronto") continue;
    const nivel: NivelItem = s.estado === "atrasado" ? "rojo" : "ambar";
    const item: ItemSenal = {
      clave: `${s.clase}-${f.animal_id}`,
      etiqueta: etiqueta(f.animal_id),
      detalle:
        s.clase === "diagnostico"
          ? s.estado === "atrasado"
            ? `Servida hace ${dias(s.dias)}: pasó la ventana (hasta el ${corta(s.hasta)})`
            : `Servida hace ${dias(s.dias)}: toca diagnóstico (hasta el ${corta(s.hasta)})`
          : s.estado === "atrasado"
            ? `Diagnóstico dudoso hace ${dias(s.dias)}: pasó el plazo para repetirlo`
            : `Diagnóstico dudoso hace ${dias(s.dias)}: toca repetirlo (hasta el ${corta(s.hasta)})`,
      nivel,
      href: fichaAnimal(f.animal_id, "reproduccion"),
      queHacer: s.clase === "diagnostico" ? "En su ficha, en «Reproducción», toca «Diagnóstico» y registra el resultado (gestante, vacía o dudosa)." : "En su ficha, en «Reproducción», toca «Repetir diagnóstico» y registra el nuevo resultado.",
      orden: -s.dias,
    };
    (s.clase === "diagnostico" ? confirmar : repetir).push(item);
  }
  return [
    armarSenal(
      {
        id: "diagnostico",
        area: "reproduccion",
        titulo: "Servicios sin diagnóstico",
        queHacer: "Confirma si quedó gestante (con tu veterinario o con tu método de diagnóstico) y registra el resultado.",
        queSignifica: "Hembras servidas a las que ya toca confirmar si quedaron gestantes.",
        regla: `Ámbar: está dentro de la ventana de diagnóstico (del día ${ventana.desde} al ${ventana.hasta} después del servicio). Rojo: ya la pasó.`,
        accion: { texto: "Ver Reproducción", href: "/reproduccion" },
      },
      confirmar,
    ),
    armarSenal(
      {
        id: "repetir",
        area: "reproduccion",
        titulo: "Diagnósticos por repetir",
        queHacer: "Repite la prueba de diagnóstico a las que quedaron dudosas y registra el resultado.",
        queSignifica: "Hembras cuyo último diagnóstico fue dudoso y siguen en observación.",
        regla: "Ámbar: toca repetir la prueba entre 14 y 21 días después del dudoso. Rojo: pasaron más de 21 días.",
        accion: { texto: "Ver Reproducción", href: "/reproduccion" },
      },
      repetir,
    ),
  ];
}

export function senalSecado(filas: ReproHembra[], hoy: string, secadoDiasAntes: number, ultimoTercioDia: number, etiqueta: Etiqueta): Senal {
  const items: ItemSenal[] = [];
  for (const f of filas) {
    if (debeSecarse(f, hoy, secadoDiasAntes)) {
      const d = diasHasta(f.fecha_prevista_parto!, hoy);
      const justo = d <= 7;
      items.push({
        clave: `secar-${f.animal_id}`,
        etiqueta: etiqueta(f.animal_id),
        detalle: d < 0 ? `Pasó su fecha prevista y sigue en ordeño` : `Faltan ${dias(d)} para parir y sigue en ordeño: toca secarla`,
        nivel: justo ? "rojo" : "ambar",
        href: fichaAnimal(f.animal_id, "lactancia"),
        queHacer: d < 0 ? "Si ya parió, registra el parto (abre su lactancia nueva). Si no, en su ficha, en «Lactancia», toca «Secar» para dejar de ordeñarla." : "En su ficha, en «Lactancia», toca «Secar (sacar del ordeño)».",
        orden: d,
      });
    } else if (enUltimoTercio(f, hoy, ultimoTercioDia)) {
      items.push({
        clave: `tercio-${f.animal_id}`,
        etiqueta: etiqueta(f.animal_id),
        detalle: `Día ${diasDesde(f.ultimo_servicio!, hoy)} de gestación · parto previsto el ${corta(f.fecha_prevista_parto!)}${diasHasta(f.fecha_prevista_parto!, hoy) <= 7 ? " (ya casi)" : ""}`,
        nivel: "ambar",
        href: fichaAnimal(f.animal_id, "reproduccion"),
        queHacer:
          diasHasta(f.fecha_prevista_parto!, hoy) <= 7
            ? "Está por parir: prepara la maternidad y vigílala (mira «Partos que se acercan»). Su ración ya debería estar reforzada."
            : "Es solo un aviso: no hay nada que registrar. Pídele a quien da de comer que le suba la ración hasta el parto.",
        orden: 100 + diasHasta(f.fecha_prevista_parto!, hoy),
      });
    }
  }
  return armarSenal(
    {
      id: "secado",
      area: "reproduccion",
      titulo: "Secado y último tercio",
      queHacer: "Seca a las que ya deben secarse (deja de ordeñarlas) y refuerza el alimento de las que entraron al último tercio de gestación.",
      queSignifica: "Gestantes en ordeño que ya deben secarse, y gestantes que entraron al último tercio y necesitan más alimento.",
      regla: `Ámbar: faltan ${secadoDiasAntes} días o menos para parir y sigue en ordeño (secarla), o lleva ${ultimoTercioDia} días de gestación o más (reforzar). Rojo: faltan 7 días o menos y sigue en ordeño.`,
      accion: items.some((i) => i.clave.startsWith("secar-")) ? { texto: "Secar varias a la vez", href: "/leche/secar" } : { texto: "Ver Reproducción", href: "/reproduccion" },
    },
    items,
  );
}

/**
 * Hembras que parieron y siguen vacías sin servirse: cada día abierto es leche y crías que se pierden. Cuenta desde el último parto (no desde un
 * aborto). No cuenta las que ya están en una temporada de monta abierta (ya se están sirviendo).
 */
export function senalVaciaSinServicio(filas: ReproHembra[], hoy: string, avisoDias: number, urgenteDias: number, etiqueta: Etiqueta): Senal {
  const items: ItemSenal[] = [];
  for (const f of filas) {
    if (f.estado !== "vacia" || !f.ultimo_parto || f.empadronamiento_id) continue;
    const d = diasDesde(f.ultimo_parto, hoy);
    if (d < avisoDias) continue;
    items.push({
      clave: `vacia-${f.animal_id}`,
      etiqueta: etiqueta(f.animal_id),
      detalle: `Parió el ${corta(f.ultimo_parto)} (hace ${dias(d)}) y sigue sin servirse`,
      nivel: d >= urgenteDias ? "rojo" : "ambar",
      href: fichaAnimal(f.animal_id, "reproduccion"),
      queHacer: "En su ficha, en «Reproducción», toca «Servicio» y registra la monta o la inseminación. Si está en retiro de leche o carne, igual se puede servir: el retiro no lo impide.",
      orden: -d,
    });
  }
  return armarSenal(
    {
      id: "vacia",
      area: "reproduccion",
      titulo: "Vacías sin servicio",
      queHacer: "Programa un servicio o una monta para cada una, empezando por las que llevan más días vacías.",
      queSignifica: "Hembras que ya parieron y siguen vacías, sin servicio y fuera de una temporada de monta. Cada día abierto cuesta leche y crías.",
      regla: `Ámbar: pasaron ${avisoDias} días desde el parto. Rojo: pasaron ${urgenteDias} días o más.`,
      accion: { texto: "Ver Reproducción", href: "/reproduccion" },
      nota: "Si una hembra no se va a servir (se va a vender o descartar), sácala de aquí marcando su salida.",
    },
    items,
  );
}

export type AbortoReciente = { id: string; madre_id: string; fecha: string; causa_aborto: string | null };
/** Cuántos abortos en esta ventana de días ponen la señal en ámbar y en rojo. */
export const ABORTOS_VENTANA_DIAS = 30;
export const ABORTOS_AMBAR = 2;
export const ABORTOS_ROJO = 3;

/**
 * Abortos agrupados: dos o más en un mes pueden ser un brote (brucelosis, toxoplasmosis, clamidiosis). Un aborto solo no enciende la señal, salvo que
 * su causa sea infecciosa.
 */
export function senalAbortos(abortos: AbortoReciente[], hoy: string, etiqueta: Etiqueta): Senal {
  const recientes = abortos.filter((a) => diasDesde(a.fecha, hoy) <= ABORTOS_VENTANA_DIAS);
  const grupo = recientes.length;
  const items: ItemSenal[] = [];
  for (const a of recientes) {
    const infecciosa = a.causa_aborto === "infecciosa";
    if (grupo < ABORTOS_AMBAR && !infecciosa) continue;
    items.push({
      clave: `aborto-${a.id}`,
      etiqueta: etiqueta(a.madre_id),
      detalle: `Abortó el ${corta(a.fecha)}${a.causa_aborto ? ` · causa ${a.causa_aborto.replace(/_/g, " ")}` : ""}${infecciosa ? ": aíslala y maneja el feto con guantes" : ""}`,
      nivel: grupo >= ABORTOS_ROJO ? "rojo" : "ambar",
      href: fichaAnimal(a.madre_id, "reproduccion"),
      orden: diasDesde(a.fecha, hoy),
    });
  }
  return armarSenal(
    {
      id: "abortos",
      area: "reproduccion",
      titulo: "Abortos agrupados",
      queHacer: "Llama a tu veterinario hoy: varios abortos juntos pueden ser un brote infeccioso. Registra cada aborto.",
      sigueAqui: "Registrar el aborto no lo quita: la señal cuenta los abortos de los últimos días y baja sola cuando pasa esa ventana sin nuevos.",
      queSignifica: `Abortos de los últimos ${ABORTOS_VENTANA_DIAS} días. Varios juntos pueden ser un brote infeccioso y piden llamar al veterinario.`,
      regla: `Ámbar: ${ABORTOS_AMBAR} abortos en ${ABORTOS_VENTANA_DIAS} días (o uno de causa infecciosa). Rojo: ${ABORTOS_ROJO} o más.`,
      accion: { texto: "Ver Reproducción", href: "/reproduccion" },
    },
    items,
  );
}

export type MuerteCria = { clave: string; animalId: string | null; fecha: string; texto: string };
/** Ventana y umbrales de la mortalidad de crías, y cuántas crías mínimo hacen falta para que el porcentaje diga algo. */
export const MORTALIDAD_VENTANA_DIAS = 90;
export const MORTALIDAD_AMBAR_PCT = 10;
export const MORTALIDAD_ROJO_PCT = 20;
export const MORTALIDAD_MIN_CRIAS = 8;

/**
 * Mortalidad de crías: de las que nacieron en los últimos 90 días, las que nacieron muertas más las que murieron después, sobre todas las que nacieron.
 * Con pocas crías (menos de 8) el porcentaje engaña, así que no enciende la señal.
 */
export function senalMortalidadCrias(nacidas: number, muertes: MuerteCria[], hoy: string): Senal {
  const n = muertes.length;
  const pct = nacidas > 0 ? Math.round((n / nacidas) * 100) : 0;
  const suficiente = nacidas >= MORTALIDAD_MIN_CRIAS;
  const nivel: NivelItem | null = !suficiente ? null : pct > MORTALIDAD_ROJO_PCT ? "rojo" : pct > MORTALIDAD_AMBAR_PCT ? "ambar" : null;
  const items: ItemSenal[] = [];
  if (nivel) {
    items.push({ clave: "mortalidad-resumen", etiqueta: `Mortalidad de ${pct} %`, detalle: `${n} de ${nacidas} crías en ${MORTALIDAD_VENTANA_DIAS} días`, nivel, href: "/reproduccion?vista=partos", queHacer: "Abre los partos del periodo, mira cuáles crías murieron o nacieron muertas y habla con tu veterinario de las causas.", orden: -1 });
    for (const m of muertes) {
      items.push({ clave: m.clave, etiqueta: m.texto, detalle: `${m.animalId ? "Murió" : "Nació muerta"} el ${corta(m.fecha)}`, nivel, href: m.animalId ? fichaAnimal(m.animalId) : "/reproduccion", orden: diasDesde(m.fecha, hoy) });
    }
  }
  return armarSenal(
    {
      id: "mortalidad",
      area: "reproduccion",
      titulo: "Mortalidad de crías",
      queHacer: "Revisa con tu veterinario qué pasó en los partos y en los primeros días de las crías, empezando por las muertes más recientes.",
      sigueAqui: "Revisar o registrar no cambia el porcentaje: baja cuando pasa la ventana de días o nacen crías vivas que lo diluyan.",
      queSignifica: `De las crías que nacieron en los últimos ${MORTALIDAD_VENTANA_DIAS} días, las que nacieron muertas o murieron después, frente a todas las que nacieron.`,
      regla: `Ámbar: más de ${MORTALIDAD_AMBAR_PCT} %. Rojo: más de ${MORTALIDAD_ROJO_PCT} %. Con menos de ${MORTALIDAD_MIN_CRIAS} crías en el periodo no se evalúa.`,
      accion: { texto: "Ver Reproducción", href: "/reproduccion" },
      nota: suficiente ? undefined : `Solo nacieron ${nacidas} ${nacidas === 1 ? "cría" : "crías"} en ${MORTALIDAD_VENTANA_DIAS} días: son pocas para sacar un porcentaje.`,
    },
    items,
  );
}

// ───────────────────────── Sanidad ─────────────────────────
type FilaFamacha = { animal_id: string; puntaje: number; ultima_fecha: string; desparasitado_en: string | null };

export function senalFamacha(filas: FilaFamacha[], etiqueta: Etiqueta): Senal {
  const items: ItemSenal[] = [];
  for (const f of filas) {
    const e = estadoFamacha(f);
    if (e.clave !== "desparasitar" && e.clave !== "vigilar") continue;
    items.push({
      clave: `famacha-${f.animal_id}`,
      etiqueta: etiqueta(f.animal_id),
      detalle: `FAMACHA ${f.puntaje} el ${corta(f.ultima_fecha)}: ${e.clave === "desparasitar" ? "desparasitar" : "vigilar y volver a evaluar"}`,
      nivel: e.clave === "desparasitar" ? "rojo" : "ambar",
      href: fichaAnimal(f.animal_id, "sanidad"),
      orden: -f.puntaje,
    });
  }
  return armarSenal(
    {
      id: "famacha",
      area: "sanidad",
      titulo: "Anemia por parásitos (FAMACHA)",
      queHacer: "Desparasita a los de puntaje 4 o 5 y vigila a los de 3, con el producto y la dosis que indique tu veterinario. Registra cada aplicación.",
      queSignifica: "Animales cuya última evaluación del color de la mucosa muestra anemia y todavía no se desparasitaron desde entonces.",
      regla: "Rojo: puntaje 4 o 5 sin desparasitar. Ámbar: puntaje 3 sin desparasitar (vigilar).",
      accion: { texto: "Ver Sanidad", href: "/sanidad" },
    },
    items,
  );
}

type FilaCoprologico = { animal_id: string; hpg: number | null; ultima_fecha: string; desparasitado_en: string | null };

/** Animales cuyo último coprológico salió alto y todavía no se desparasitaron desde entonces. */
export function senalCoprologico(filas: FilaCoprologico[], etiqueta: Etiqueta): Senal {
  const items: ItemSenal[] = [];
  for (const f of filas) {
    if (f.hpg === null || f.desparasitado_en || f.hpg < HPG_ALTO) continue;
    const lectura = interpretarHpg(f.hpg);
    items.push({
      clave: `coprologico-${f.animal_id}`,
      etiqueta: etiqueta(f.animal_id),
      detalle: `${f.hpg.toLocaleString("es-CO")} huevos por gramo el ${corta(f.ultima_fecha)}: ${lectura.texto.toLowerCase()}, sin desparasitar`,
      nivel: f.hpg >= HPG_MUY_ALTO ? "rojo" : "ambar",
      href: fichaAnimal(f.animal_id, "sanidad"),
      queHacer: lectura.accion,
      orden: -f.hpg,
    });
  }
  return armarSenal(
    {
      id: "coprologico",
      area: "sanidad",
      titulo: "Cargas de parásitos altas (coprológico)",
      queHacer: "Consulta con tu veterinario si toca desparasitarlos y con qué producto; después registra la aplicación.",
      queSignifica: "Animales cuyo último examen coprológico mostró muchos huevos de parásitos y todavía no se desparasitaron desde entonces.",
      regla: `Ámbar: desde ${HPG_ALTO.toLocaleString("es-CO")} huevos por gramo (HPG) sin desparasitar. Rojo: desde ${HPG_MUY_ALTO.toLocaleString("es-CO")} HPG. Son cortes de referencia: tu veterinario manda.`,
      accion: { texto: "Ver Sanidad", href: "/sanidad" },
    },
    items,
  );
}

export type DosisPendiente = { clave: string; titulo: string; fecha: string; animales: number; tipo: "dosis" | "programa"; href: string };

export function senalDosis(pendientes: DosisPendiente[], hoy: string): Senal {
  const items: ItemSenal[] = [];
  for (const p of pendientes) {
    const e = p.tipo === "programa" ? estadoFechaPrograma(p.fecha, hoy) : estadoDosis(p.fecha, hoy);
    if (e.tono === "neutro") continue;
    items.push({
      clave: p.clave,
      etiqueta: p.titulo,
      detalle: `${p.animales} ${p.animales === 1 ? "animal" : "animales"} · ${e.texto.toLowerCase()} (${corta(p.fecha)})`,
      nivel: e.tono === "alerta" ? "rojo" : "ambar",
      href: p.href,
      orden: e.dias,
      atrasoDias: e.dias < 0 ? -e.dias : 0,
    });
  }
  return armarSenal(
    {
      id: "dosis",
      area: "sanidad",
      titulo: "Dosis y programas por aplicar",
      queHacer: "Aplica cada dosis pendiente con su producto a los animales que dice la lista, empezando por las vencidas, y registra la aplicación.",
      queSignifica: "Refuerzos de vacunas, desparasitaciones y jornadas sanitarias programadas que vencen pronto o ya vencieron.",
      regla: "Ámbar: vence hoy o en los próximos 7 días. Rojo: ya venció.",
      accion: { texto: "Ver Sanidad", href: "/sanidad" },
    },
    items,
  );
}

export type FilaRetiro = { animal_id: string; retiro_leche_hasta: string | null; retiro_carne_hasta: string | null };

export function senalRetiro(filas: FilaRetiro[], hoy: string, etiqueta: Etiqueta): Senal {
  const items: ItemSenal[] = [];
  for (const r of filas) {
    const leche = r.retiro_leche_hasta && r.retiro_leche_hasta >= hoy ? r.retiro_leche_hasta : null;
    const carne = r.retiro_carne_hasta && r.retiro_carne_hasta >= hoy ? r.retiro_carne_hasta : null;
    if (!leche && !carne) continue;
    const partes = [leche ? `leche hasta el ${corta(leche)}` : null, carne ? `carne hasta el ${corta(carne)}` : null].filter(Boolean);
    items.push({
      clave: `retiro-${r.animal_id}`,
      etiqueta: etiqueta(r.animal_id),
      detalle: `En retiro: ${partes.join(" · ")}`,
      nivel: "ambar",
      href: fichaAnimal(r.animal_id, "sanidad"),
      orden: diasHasta(leche ?? carne!, hoy),
    });
  }
  return armarSenal(
    {
      id: "retiro",
      area: "sanidad",
      titulo: "Animales en periodo de retiro",
      queHacer: "No mandes al tanque la leche de estos animales ni los vendas o sacrifiques hasta que termine su periodo de retiro.",
      sigueAqui: "Es cuestión de tiempo: el animal sale solo cuando termina su periodo de retiro.",
      queSignifica: "Animales tratados cuya leche no puede ir al tanque o cuya carne no puede salir a consumo hasta que pase el retiro del medicamento.",
      regla: "Ámbar mientras dure el retiro. La app ya descarta esa leche y avisa antes de vender o sacrificar; no hay rojo porque no es una falla, es una restricción.",
      nota: "Respeta la fecha: la leche o la carne con residuos de medicamento no se puede vender.",
    },
    items,
  );
}

// ───────────────────────── Leche ─────────────────────────
export type LecturaFrio = { id: string; fecha: string; momento: string; temperatura_c: number };

export function senalFrio(lecturas: LecturaFrio[], hoy: string): Senal {
  const items: ItemSenal[] = [];
  for (const l of lecturas) {
    const e = estadoTemperatura(Number(l.temperatura_c));
    if (e.tono !== "aviso" && e.tono !== "alerta") continue;
    const etiquetaMomento = l.momento === "tras_ordeno" ? "Tras el ordeño" : l.momento === "almacenada" ? "Almacenada" : "Al despachar";
    items.push({
      clave: `frio-${l.id}`,
      etiqueta: etiquetaMomento,
      detalle: `${Number(l.temperatura_c).toLocaleString("es-CO", { maximumFractionDigits: 1 })} °C el ${corta(l.fecha)}: ${e.texto.toLowerCase()}`,
      nivel: e.tono === "alerta" ? "rojo" : "ambar",
      href: "/leche/frio/nuevo",
      queHacer: "Revisa el tanque (termostato y equipo) y registra una lectura nueva de temperatura; si queda en rango, la alerta se quita.",
      orden: diasDesde(l.fecha, hoy),
    });
  }
  return armarSenal(
    {
      id: "frio",
      area: "leche",
      titulo: "Cadena de frío",
      queHacer: "Revisa que el tanque esté enfriando bien (termostato y equipo) y vuelve a medir la temperatura. Si sigue fuera de rango, la leche está en riesgo.",
      sigueAqui: "Cuenta las lecturas de los últimos 7 días: arreglar el equipo no las borra. Baja sola cuando las lecturas nuevas quedan en rango y las malas salen de esos 7 días.",
      queSignifica: "Lecturas de temperatura del tanque de los últimos 7 días fuera del rango seguro (4 a 6 °C).",
      regla: "Ámbar: hasta 2 °C fuera del rango. Rojo: más de 2 °C fuera, la leche está en riesgo.",
      accion: { texto: "Ver Leche", href: "/leche" },
    },
    items,
  );
}

export type AnalisisTanque = {
  id: string;
  fecha: string;
  rcs_miles_ml: number | null;
  grasa_pct: number | null;
  proteina_pct: number | null;
  crioscopia_c: number | null;
  residuos_antibioticos: "negativo" | "positivo" | null;
};
/** Grasa y proteína pueden no tener rango definido (entonces no se revisan). */
export type LimitesCalidad = { rcs: number; grasaMin: number | null; grasaMax: number | null; proteinaMin: number | null; proteinaMax: number | null };

export function senalCalidad(a: AnalisisTanque | null, l: LimitesCalidad): Senal {
  const items: ItemSenal[] = [];
  if (a) {
    const href = `/leche/calidad/${a.id}`;
    const fecha = corta(a.fecha);
    const poner = (clave: string, etiqueta: string, detalle: string, nivel: NivelItem, orden: number) => items.push({ clave: `${clave}-${a.id}`, etiqueta, detalle: `${detalle} (análisis del ${fecha})`, nivel, href, orden });
    if (a.residuos_antibioticos === "positivo") poner("res", "Residuos de antibiótico", "Positivo: no despachar esa leche", "rojo", 0);
    if (a.rcs_miles_ml != null) {
      const e = estadoRcs(a.rcs_miles_ml, l.rcs);
      if (e.tono === "alerta" || e.tono === "aviso") poner("rcs", "Células somáticas", `${formatoMiles(a.rcs_miles_ml)}: ${e.texto.toLowerCase()} (${formatoMiles(l.rcs)})`, e.tono === "alerta" ? "rojo" : "ambar", 1);
    }
    if (a.crioscopia_c != null) {
      const e = estadoCrioscopia(Number(a.crioscopia_c));
      if (e.tono === "alerta" || e.tono === "aviso") poner("crio", "Crioscopia", `${formatoCrioscopia(Number(a.crioscopia_c))}: ${e.texto.toLowerCase()}`, e.tono === "alerta" ? "rojo" : "ambar", 2);
    }
    if (a.grasa_pct != null && l.grasaMin != null && l.grasaMax != null && (a.grasa_pct < l.grasaMin || a.grasa_pct > l.grasaMax)) poner("grasa", "Grasa", `${a.grasa_pct} % fuera de ${l.grasaMin}–${l.grasaMax} %`, "ambar", 3);
    if (a.proteina_pct != null && l.proteinaMin != null && l.proteinaMax != null && (a.proteina_pct < l.proteinaMin || a.proteina_pct > l.proteinaMax)) poner("prot", "Proteína", `${a.proteina_pct} % fuera de ${l.proteinaMin}–${l.proteinaMax} %`, "ambar", 4);
  }
  return armarSenal(
    {
      id: "calidad",
      area: "leche",
      titulo: "Calidad de la leche",
      queHacer: "Abre el último análisis y mira qué valor falló. Si hay residuos de antibióticos, esa leche no debe ir al tanque.",
      sigueAqui: "Sale cuando un análisis nuevo viene dentro de lo normal; revisar el anterior no cambia el resultado.",
      queSignifica: "El último análisis del tanque (de los últimos 60 días): células somáticas, crioscopia, residuos de antibióticos, grasa y proteína.",
      regla: "Rojo: residuos positivos, células sobre el límite o crioscopia con posible agua. Ámbar: células cerca del límite (80 %), crioscopia más fría de lo habitual, o grasa o proteína fuera de rango.",
      accion: { texto: "Registrar un análisis nuevo", href: "/leche/calidad/nuevo" },
      nota: a ? undefined : "No hay un análisis del tanque en los últimos 60 días.",
    },
    items,
  );
}

export function senalProduccion(tendencias: Tendencia[], etiqueta: Etiqueta): Senal {
  const items: ItemSenal[] = [];
  for (const t of tendencias) {
    if (!esBaja(t)) continue;
    items.push({
      clave: `prod-${t.animal_id}`,
      etiqueta: etiqueta(t.animal_id),
      detalle: mensajeBaja(t),
      nivel: t.nivel === "critico" ? "rojo" : "ambar",
      href: fichaAnimal(t.animal_id, "lactancia"),
      orden: t.variacion,
    });
  }
  return armarSenal(
    {
      id: "produccion",
      area: "leche",
      titulo: "Producción que baja",
      queHacer: "Revisa a las que bajan, empezando por las de baja fuerte: mastitis, parásitos, alimentación, celo o estrés.",
      sigueAqui: "Sale cuando su producción de los últimos días vuelve cerca de su promedio; revisar al animal no la cambia hasta que se ordeñe de nuevo.",
      queSignifica: "Hembras en ordeño cuya producción de los últimos días bajó frente a su propio promedio.",
      regla: "Ámbar: baja notable frente a su promedio. Rojo: baja fuerte, hay que revisarla ya (mastitis, parásitos, alimentación, celo o estrés).",
      accion: { texto: "Ver Leche", href: "/leche" },
    },
    items,
  );
}

// ───────────────────────── Corrales ─────────────────────────
export function senalCorrales(ubicaciones: UbicacionVista[]): Senal {
  const items: ItemSenal[] = [];
  for (const u of ubicaciones) {
    // Sugerencia de a dónde: la mejor opción con espacio para `n` animales, si la hay (se explica mejor en la ficha, con todas las opciones).
    const sugerencia = (n: number) => {
      const d = sugerirDestinos(u, n, ubicaciones, 1)[0];
      return d ? ` Sugerencia: ${d.nombre} (${d.motivo}).` : "";
    };
    if (u.hacinada) {
      const sobran = u.capacidad ? u.ocupantes - u.capacidad : 0;
      items.push({
        clave: `cupo-${u.id}`,
        etiqueta: u.nombre,
        detalle: u.capacidad ? `Pasó su cupo: tiene ${u.ocupantes} animales y le caben ${u.capacidad}` : `Pasó su cupo: ${u.ocupantes} animales`,
        nivel: "rojo",
        href: `/hato/corrales/${u.id}`,
        queHacer: (sobran > 0 ? `Pasa ${sobran} ${sobran === 1 ? "animal" : "animales"} a otra instalación.` : "Pasa algunos animales a otra instalación.") + sugerencia(sobran),
        orden: 0,
      });
    } else if (u.estado === "debe_salir") {
      items.push({
        clave: `rotacion-${u.id}`,
        etiqueta: u.nombre,
        detalle: textoRotacion(u),
        nivel: "rojo",
        href: `/hato/corrales/${u.id}`,
        queHacer: `Pasa el lote a otro potrero para que este descanse ${u.dias_descanso_min} días.` + sugerencia(u.ocupantes),
        orden: 1,
      });
    }
  }
  return armarSenal(
    {
      id: "corrales",
      area: "corrales",
      titulo: "Cupo y rotación",
      queHacer: "Pasa animales a otra instalación si el corral pasó su cupo; rota el lote a otro potrero si el potrero ya cumplió sus días de ocupación.",
      queSignifica: "Corrales con más animales que su cupo y potreros que ya pasaron los días de ocupación y deben desocuparse.",
      regla: "Rojo: el corral pasó su cupo o el potrero pasó los días máximos de ocupación.",
      accion: { texto: "Ver Corrales", href: "/corrales" },
    },
    items,
  );
}

// ───────────────────────── Inventario ─────────────────────────
/**
 * Medicamentos y vacunas que piden algo: rojo si un lote ya venció, si se agotó o si se aplicó más de lo que había; ámbar si llegó al mínimo o un lote vence en
 * `DIAS_AVISO_VENCIMIENTO` días. Los productos «por contar» no avisan: todavía no hay stock del cual hablar.
 */
export function senalInventario(filas: FilaInventario[], hoy: string): Senal {
  const items: ItemSenal[] = [];
  for (const f of filas) {
    const href = `/inventario/${f.producto_id}`;
    const estado = estadoStock(f);
    const venc = estadoVencimiento(f.vence_pronto, hoy);
    if (venc === "vencido" && f.vence_pronto) items.push({ clave: `vencido-${f.producto_id}`, etiqueta: f.nombre, detalle: `Tiene un lote vencido el ${corta(f.vence_pronto)}`, nivel: "rojo", href: rutaBajaLote(f.producto_id), queHacer: "Da de baja el lote vencido: el formulario ya viene con el lote y la cantidad; revisa y guarda. Si la fecha está mal escrita, corrígela en la compra.", orden: 0 });
    if (estado === "negativo") items.push({ clave: `negativo-${f.producto_id}`, etiqueta: f.nombre, detalle: "Se aplicó más de lo que había registrado", nivel: "rojo", href: rutaConteoTotal(f.producto_id), queHacer: "Abre el producto: ahí dice por qué se descuadró y cómo corregirlo. Si ya no queda nada en la bodega, cuenta 0 y se cuadra.", orden: 1 });
    else if (estado === "agotado") items.push({ clave: `agotado-${f.producto_id}`, etiqueta: f.nombre, detalle: "Se agotó", nivel: "rojo", href, queHacer: "Avisa al administrador para que lo compre y registra la compra cuando llegue.", orden: 1 });
    else if (estado === "bajo" && f.stock !== null) items.push({ clave: `bajo-${f.producto_id}`, etiqueta: f.nombre, detalle: `Quedan ${textoStock(f, f.stock)}, en el mínimo o por debajo`, nivel: "ambar", href, queHacer: "Compra lo que falta y registra la compra en Hato → Compras.", orden: 2 });
    if (venc === "pronto" && f.vence_pronto) items.push({ clave: `vence-${f.producto_id}`, etiqueta: f.nombre, detalle: `Un lote vence el ${corta(f.vence_pronto)} (en ${dias(diasHasta(f.vence_pronto, hoy))}); las existencias están bien`, nivel: "ambar", href, queHacer: "Úsalo primero: al aplicar, ese lote ya viene elegido. Si no alcanza a usarse, dalo de baja cuando venza.", orden: 3 });
  }
  return armarSenal(
    {
      id: "inventario",
      area: "inventario",
      titulo: "Medicamentos y vacunas",
      queHacer: "Compra o repone lo que se agotó o está en el mínimo, y no uses los lotes vencidos. Registra la compra para que el inventario se actualice.",
      queSignifica: "Productos de la bodega que se agotaron, llegaron a su mínimo o tienen un lote vencido o por vencer.",
      regla: `Rojo: lote vencido, agotado o aplicado de más. Ámbar: en el mínimo o un lote que vence en ${DIAS_AVISO_VENCIMIENTO} días o menos.`,
      accion: { texto: "Ver Inventario", href: "/inventario" },
    },
    items,
  );
}

// ───────────────────────── Alimento ─────────────────────────
/**
 * Alimentos que se acaban: rojo si se agotó, se dio de comer más de lo registrado o alcanza para menos de la mitad del plazo de aviso; ámbar si alcanza para menos
 * del plazo (`stock_autonomia_dias`, en Ajustes de la finca). Sin días con salidas suficientes no se calcula nada, y lo que está «por contar» no avisa.
 */
export function senalAlimento(filas: FilaAlimento[], plazoDias: number, hoy: string): Senal {
  const items: ItemSenal[] = [];
  for (const f of filas) {
    const href = `/inventario/alimento/${f.producto_id}`;
    const estado = estadoAlimento(f, plazoDias, hoy);
    const dias = autonomiaDias(f, hoy);
    if (estado === "negativo") items.push({ clave: `negativo-${f.producto_id}`, etiqueta: f.nombre, detalle: "Se dio de comer más de lo que había registrado", nivel: "rojo", href, queHacer: "Cuenta lo que hay y ajusta las existencias.", orden: 1 });
    else if (estado === "agotado") items.push({ clave: `agotado-${f.producto_id}`, etiqueta: f.nombre, detalle: "Se agotó", nivel: "rojo", href, queHacer: "Compra más antes de que falte.", orden: 0 });
    else if (estado === "critico" && dias !== null) items.push({ clave: `critico-${f.producto_id}`, etiqueta: f.nombre, detalle: `Alcanza para ${diasTexto(dias)} (quedan ${textoKg(f, f.stock_kg ?? 0)})`, nivel: "rojo", href, queHacer: "Compra más antes de que falte.", orden: 2 + dias / 1000 });
    else if (estado === "bajo" && dias !== null) items.push({ clave: `bajo-${f.producto_id}`, etiqueta: f.nombre, detalle: `Alcanza para ${diasTexto(dias)} (quedan ${textoKg(f, f.stock_kg ?? 0)})`, nivel: "ambar", href, orden: 3 + dias / 1000 });
  }
  return armarSenal(
    {
      id: "alimento",
      area: "alimento",
      titulo: "Alimento",
      queHacer: "Compra o repone el alimento que se acaba y registra la compra. Si dice que se dio de más, revisa que el inventario esté bien contado.",
      queSignifica: "Alimentos de la bodega que se agotaron o que alcanzan para pocos días, según lo que se les ha dado de comer en las últimas dos semanas.",
      regla: `Rojo: se agotó, se dio de más o alcanza para menos de ${diasTexto(plazoDias / 2)}. Ámbar: alcanza para menos de ${diasTexto(plazoDias)} (se cambia en Ajustes de la finca).`,
      accion: { texto: "Ver Inventario", href: "/inventario?vista=alimento" },
    },
    items,
  );
}

// ───────────────────────── Sanidad (segunda tanda) ─────────────────────────
export type FilaPrueba = { animal_id: string; prueba: TipoPrueba; fecha: string; resultado: "negativo" | "positivo" | "sospechoso" | "pendiente" };
/** Pruebas cuyo positivo no se «cura»: el animal sigue siendo un riesgo mientras esté en el hato. */
const PRUEBAS_PERSISTENTES: TipoPrueba[] = ["cae", "brucelosis", "paratuberculosis"];
/** Días que un positivo de mastitis o CMT sigue contando como alerta. */
const DIAS_PRUEBA_TRANSITORIA = 60;
/** Un sospechoso que no se repite en este plazo pasa a rojo. */
const DIAS_REPETIR_SOSPECHOSO = 30;

export function senalPruebas(filas: FilaPrueba[], hoy: string, etiqueta: Etiqueta): Senal {
  // Solo cuenta la última prueba de cada tipo por animal: un positivo viejo ya repetido en negativo no debe alarmar.
  const ultimas = new Map<string, FilaPrueba>();
  for (const f of filas) {
    const k = `${f.animal_id}|${f.prueba}`;
    const previa = ultimas.get(k);
    if (!previa || f.fecha > previa.fecha) ultimas.set(k, f);
  }
  const items: ItemSenal[] = [];
  for (const f of ultimas.values()) {
    const nombre = ETIQUETA_PRUEBA_CORTA[f.prueba] ?? f.prueba;
    const hace = diasDesde(f.fecha, hoy);
    const base = { clave: `prueba-${f.animal_id}-${f.prueba}`, etiqueta: etiqueta(f.animal_id), href: fichaAnimal(f.animal_id, "sanidad") };
    if (f.resultado === "positivo") {
      const persistente = PRUEBAS_PERSISTENTES.includes(f.prueba);
      if (!persistente && hace > DIAS_PRUEBA_TRANSITORIA) continue;
      items.push({ ...base, detalle: `${nombre}: positivo el ${corta(f.fecha)}${persistente ? ". Aíslala y consulta al veterinario" : ""}`, nivel: persistente ? "rojo" : "ambar", orden: persistente ? 0 : 5 });
    } else if (f.resultado === "sospechoso") {
      items.push({ ...base, detalle: `${nombre}: sospechoso el ${corta(f.fecha)}${hace > DIAS_REPETIR_SOSPECHOSO ? `, sin repetir hace ${dias(hace)}` : ": repítela en unas semanas"}`, nivel: hace > DIAS_REPETIR_SOSPECHOSO ? "rojo" : "ambar", orden: 10 - hace / 100 });
    } else if (f.resultado === "pendiente" && hace > 3) {
      items.push({ ...base, detalle: `${nombre}: sin resultado desde el ${corta(f.fecha)}`, nivel: "ambar", orden: 20 });
    }
  }
  return armarSenal(
    {
      id: "pruebas",
      area: "sanidad",
      titulo: "Pruebas de laboratorio",
      queHacer: "Con tu veterinario, define qué hacer con cada positivo o sospechoso (aislarlo, repetir la prueba) y registra el resultado.",
      sigueAqui: "Registrar que lo revisaste no la quita: sale con una prueba nueva que dé negativo o cuando el veterinario la descarte.",
      queSignifica: "Animales cuya última prueba (CAE, brucelosis, paratuberculosis, CMT, cultivo) salió positiva, sospechosa o sin resultado.",
      regla: `Rojo: positivo de CAE, brucelosis o paratuberculosis, o un sospechoso que no se repitió en ${DIAS_REPETIR_SOSPECHOSO} días. Ámbar: sospechoso reciente, positivo de CMT o cultivo de los últimos ${DIAS_PRUEBA_TRANSITORIA} días, o sin resultado.`,
      accion: { texto: "Ver Sanidad", href: "/sanidad" },
    },
    items,
  );
}

export function senalCuarentena(filas: CuarentenaAlerta[], etiqueta: Etiqueta): Senal {
  const items: ItemSenal[] = [];
  for (const c of filas) {
    if (c.situacion === "falta_cuarentena") {
      items.push({ clave: `cuarentena-${c.animal_id}`, etiqueta: etiqueta(c.animal_id), detalle: `Entró hace ${dias(c.dias)} y no pasó por cuarentena`, nivel: "rojo", href: `/hato/corrales/mover?animal=${c.animal_id}`, queHacer: "Llévalo ya a un corral de cuarentena: el formulario abre con él elegido; escoge el corral de cuarentena y guarda.", orden: -c.dias });
    } else {
      const e = estadoCuarentena(c.dias);
      if (e.tono === "aviso") items.push({ clave: `cuarentena-${c.animal_id}`, etiqueta: etiqueta(c.animal_id), detalle: `En cuarentena: ${e.texto}`, nivel: "ambar", href: fichaAnimal(c.animal_id), queHacer: "No hagas nada todavía: déjalo en cuarentena, separado del hato, hasta cumplir los 21 días.", orden: c.dias });
    }
  }
  return armarSenal(
    {
      id: "cuarentena",
      area: "sanidad",
      titulo: "Cuarentena de animales nuevos",
      queHacer: "Pasa a cuarentena a los que entraron sin pasar por ella, y mantén a los que están en cuarentena hasta que cumplan los 21 días.",
      sigueAqui: "Si entró sin cuarentena, sale cuando lo pasas a cuarentena; si está en ella, cuando cumple los 21 días.",
      queSignifica: "Animales que llegaron de afuera y no pasaron por cuarentena, o que siguen en ella sin cumplir el mínimo.",
      regla: "Rojo: el animal entró y no está en cuarentena. Ámbar: está en cuarentena y aún no cumple los 21 días mínimos.",
      accion: { texto: "Ver Corrales", href: "/corrales" },
    },
    items,
  );
}

export type FilaRevision = { animal_id: string; ultima_fecha: string | null };
/** Días de atraso desde los que la revisión de pezuñas pasa a rojo. */
const DIAS_PEZUNAS_ROJO = 14;

export function senalPezunas(podologia: FilaRevision[], pediluvio: FilaRevision[], plazos: { podologiaDias: number; pediluvioDias: number }, hoy: string): Senal {
  const items: ItemSenal[] = [];
  const grupo = (clave: string, titulo: string, filas: FilaRevision[], cadaDias: number) => {
    const atrasadas = filas.map((f) => revisionAtrasada(f.ultima_fecha, cadaDias, hoy)).filter((r) => r !== null);
    if (atrasadas.length === 0) return;
    const nunca = atrasadas.filter((r) => r.diasAtraso === null).length;
    const peor = Math.max(0, ...atrasadas.map((r) => r.diasAtraso ?? 0));
    const rojo = nunca > 0 || peor > DIAS_PEZUNAS_ROJO;
    items.push({
      clave,
      etiqueta: `${titulo}: ${atrasadas.length} ${atrasadas.length === 1 ? "animal atrasado" : "animales atrasados"}`,
      detalle: `${nunca > 0 ? `${nunca} sin registro; ` : ""}${peor > 0 ? `el más atrasado, ${dias(peor)}` : "toca según el plazo de Ajustes"} (cada ${dias(cadaDias)})`,
      nivel: rojo ? "rojo" : "ambar",
      href: "/hato/sanidad/programar",
      orden: rojo ? 0 : 1,
    });
  };
  grupo("pezunas-podologia", "Revisión de pezuñas", podologia, plazos.podologiaDias);
  grupo("pezunas-pediluvio", "Baño de patas (pediluvio)", pediluvio, plazos.pediluvioDias);
  return armarSenal(
    {
      id: "pezunas",
      area: "sanidad",
      titulo: "Pezuñas y pediluvio",
      queHacer: "Programa la revisión de pezuñas o el pediluvio para estos animales y registra cuándo se haga.",
      queSignifica: "Animales a los que ya les tocaba la revisión de pezuñas o el baño de patas según el plazo de la finca.",
      regla: `Ámbar: pasó el plazo de Ajustes. Rojo: más de ${DIAS_PEZUNAS_ROJO} días de atraso o sin registro.`,
      accion: { texto: "Programar en Sanidad", href: "/hato/sanidad/programar" },
    },
    items,
  );
}

export type EventoVacuna = { fecha: string; producto_nombre: string | null };
/** Días antes del vencimiento desde los que una vacuna anual pasa a ámbar. */
const DIAS_AVISO_VACUNA = 30;

/**
 * Vacunas con plazo definido en Ajustes (rabia, clostridiosis): mira la última campaña registrada de cada una por el nombre del producto.
 * Si la finca no definió el plazo, esa vacuna no se evalúa y la señal lo dice.
 */
export function senalVacunas(eventos: EventoVacuna[], rabiaDias: number | null, clostridiosisDias: number | null, hoy: string): Senal {
  const reglas = [
    { clave: "rabia", nombre: "Rabia", patron: /rabia/i, cada: rabiaDias },
    { clave: "clostridiosis", nombre: "Clostridiosis", patron: /clostrid/i, cada: clostridiosisDias },
  ];
  const items: ItemSenal[] = [];
  for (const r of reglas) {
    if (r.cada == null) continue;
    const ultima = eventos.filter((e) => e.producto_nombre && r.patron.test(e.producto_nombre)).map((e) => e.fecha).sort().pop() ?? null;
    if (!ultima) {
      items.push({ clave: `vacuna-${r.clave}`, etiqueta: `Vacuna de ${r.nombre.toLowerCase()}`, detalle: `No hay ninguna campaña registrada (debe ser cada ${dias(r.cada)})`, nivel: "rojo", href: "/hato/sanidad/programar", orden: 0 });
      continue;
    }
    const vence = sumarDias(ultima, r.cada);
    const falta = diasHasta(vence, hoy);
    if (falta < 0) items.push({ clave: `vacuna-${r.clave}`, etiqueta: `Vacuna de ${r.nombre.toLowerCase()}`, detalle: `Vencida hace ${dias(-falta)}: la última campaña fue el ${corta(ultima)}`, nivel: "rojo", href: "/hato/sanidad/programar", orden: falta });
    else if (falta <= DIAS_AVISO_VACUNA) items.push({ clave: `vacuna-${r.clave}`, etiqueta: `Vacuna de ${r.nombre.toLowerCase()}`, detalle: `Toca ${falta === 0 ? "hoy" : `en ${dias(falta)}`} (${corta(vence)}): la última campaña fue el ${corta(ultima)}`, nivel: "ambar", href: "/hato/sanidad/programar", orden: falta });
  }
  const sinPlazo = reglas.filter((r) => r.cada == null).map((r) => r.nombre.toLowerCase());
  return armarSenal(
    {
      id: "vacunas",
      area: "sanidad",
      titulo: "Vacunas anuales",
      queHacer: "Programa con tu veterinario la campaña de rabia o de clostridiosis que toca y registra la aplicación.",
      queSignifica: "Si ya toca repetir la campaña de rabia y de clostridiosis, según cada cuánto la repites (se define en Ajustes).",
      regla: `Ámbar: faltan ${DIAS_AVISO_VACUNA} días o menos para repetirla. Rojo: ya venció o nunca se registró.`,
      accion: { texto: "Programar en Sanidad", href: "/hato/sanidad/programar" },
      nota: sinPlazo.length ? `No se evalúa la vacuna de ${sinPlazo.join(" ni la de ")}: define cada cuántos días se repite en Ajustes de la finca → Sanidad.` : "Se reconoce la vacuna por el nombre del producto (que diga «rabia» o «clostridios…»).",
    },
    items,
  );
}

// ───────────────────────── Leche (segunda tanda) ─────────────────────────
export function senalMantenimiento(filas: MantenimientoOrdeno[], hoy: string): Senal {
  const items: ItemSenal[] = pendientesMantenimiento(filas, hoy).map((p: PendienteEquipo<MantenimientoOrdeno>) => ({
    clave: `mant-${p.registro.tipo}-${p.registro.equipo ?? ""}`,
    etiqueta: `${ETIQUETA_MANTENIMIENTO[p.registro.tipo as keyof typeof ETIQUETA_MANTENIMIENTO] ?? p.registro.tipo}${p.registro.equipo ? ` · ${p.registro.equipo}` : ""}`,
    detalle: p.dias < 0 ? `Atrasada ${dias(-p.dias)}` : p.dias === 0 ? "Toca hoy" : `Toca en ${dias(p.dias)}`,
    nivel: p.dias < 0 ? ("rojo" as const) : ("ambar" as const),
    href: `/leche/equipo/nuevo?de=${p.registro.id}`,
    queHacer: "Haz la tarea y toca «Guardar registro»: la hoja ya viene con lo de la vez anterior y la próxima fecha calculada.",
    orden: p.dias,
  }));
  return armarSenal(
    {
      id: "mantenimiento",
      area: "leche",
      titulo: "Mantenimiento de la sala de ordeño",
      queHacer: "Haz el lavado o la revisión que toca y regístralo, para que la próxima fecha se calcule.",
      queSignifica: "Lavados, revisión de presión y de pulsadores del equipo de ordeño que ya tocan o están por tocar.",
      regla: "Ámbar: toca en los próximos 7 días. Rojo: ya está atrasada.",
      accion: { texto: "Ver el equipo en Leche", href: "/leche?vista=frio" },
    },
    items,
  );
}

// ───────────────────────── Ceba ─────────────────────────
/** Días desde el último peso en los que un animal de ganancia baja se ve como «ya atendido». */
export const DIAS_PESADO_RECIENTE = 3;
export type AnimalEnCeba = { animalId: string; ultimaFecha: string | null; gdpRecienteG: number | null; limiteDias: number };

export function senalesCeba(animales: AnimalEnCeba[], gdpMinimaG: number, hoy: string, etiqueta: Etiqueta): Senal[] {
  const pesaje: ItemSenal[] = [];
  const ganancia: ItemSenal[] = [];
  for (const a of animales) {
    const sin = a.ultimaFecha ? diasDesde(a.ultimaFecha, hoy) : null;
    if (sin === null || sin > a.limiteDias) {
      pesaje.push({
        clave: `pesaje-${a.animalId}`,
        etiqueta: etiqueta(a.animalId),
        detalle: sin === null ? `Sin pesos todavía (conviene pesar cada ${dias(a.limiteDias)})` : `Sin pesar hace ${dias(sin)} (conviene cada ${dias(a.limiteDias)})`,
        nivel: sin === null || sin > a.limiteDias * 2 ? "rojo" : "ambar",
        href: fichaAnimal(a.animalId, "crecimiento"),
        orden: sin === null ? -9999 : -sin,
      });
    }
    if (a.gdpRecienteG != null && a.gdpRecienteG < gdpMinimaG) {
      // Pesado hace poco: la persona ya hizo lo que le tocaba (pesarlo). No es un pendiente nuevo; se ve aparte unos días y, si sigue ganando poco, vuelve.
      const reciente = sin !== null && sin <= DIAS_PESADO_RECIENTE;
      ganancia.push({
        clave: `gdp-${a.animalId}`,
        etiqueta: etiqueta(a.animalId),
        detalle: `Gana ${Math.round(a.gdpRecienteG)} g/día; el mínimo es ${gdpMinimaG}${a.ultimaFecha ? ` · último peso ${corta(a.ultimaFecha)}` : ""}`,
        nivel: a.gdpRecienteG < gdpMinimaG / 2 ? "rojo" : "ambar",
        href: fichaAnimal(a.animalId, "crecimiento"),
        queHacer: reciente
          ? `Ya está pesado. Revisa su ración y su sanidad (desparasitación); vuelve a pesarlo el ${corta(sumarDias(a.ultimaFecha!, a.limiteDias))}.`
          : "Revisa su ración y su sanidad (desparasitación) y pésalo de nuevo para ver si mejoró.",
        atendido: reciente ? (sin === 0 ? "Pesado hoy" : `Pesado hace ${dias(sin!)}`) : undefined,
        orden: a.gdpRecienteG,
      });
    }
  }
  return [
    armarSenal(
      {
        id: "ceba-pesaje",
        area: "ceba",
        titulo: "Pesaje atrasado en ceba",
        queHacer: "Pesa a los animales atrasados y registra el peso.",
        queSignifica: "Animales en engorde (en un lote abierto o machos de carne) que llevan más días sin pesarse de lo que la finca definió.",
        regla: "Ámbar: pasó el plazo de pesaje de Carne → Reglas de ceba. Rojo: pasó el doble del plazo o nunca se ha pesado.",
        accion: { texto: "Pesar en Hato → Ceba", href: "/hato?vista=ceba" },
      },
      pesaje,
    ),
    armarSenal(
      {
        id: "ceba-gdp",
        area: "ceba",
        titulo: "Ganancia de peso baja",
        queHacer: "Revisa la alimentación y la sanidad de los que ganan poco; no basta con pesarlos otra vez.",
        sigueAqui: "Los animales que pesaste en los últimos 3 días pasan a «Ya atendidos» y no cuentan como pendientes. Si pasado ese tiempo siguen ganando poco, vuelven a la lista; salen de verdad cuando, en un pesaje, su ganancia supera el mínimo.",
        queSignifica: "Animales en engorde cuya ganancia diaria reciente está por debajo del mínimo de la finca.",
        regla: `Ámbar: gana menos de ${gdpMinimaG} g/día (Ajustes → Ceba). Rojo: menos de la mitad.`,
        accion: { texto: "Ver Carne", href: "/carne" },
      },
      ganancia,
    ),
  ];
}

// ───────────────────────── Dinero ─────────────────────────
export type CompraPorPagar = { id: string; descripcion: string; monto: number; vence: string };
export type VentaPorCobrar = { clave: string; /** De dónde viene: una venta registrada («venta»), un despacho de leche («leche») o la baja de un animal («animal»). */ origen: string; origen_id: string; producto: string; tercero: string | null; valor: number; cobro_vence: string };

/** A dónde se atiende una venta por cobrar: su propio registro, según de dónde viene (no la lista general). */
export function hrefVenta(origen: string, id: string): string {
  if (origen === "venta") return `/hato/ventas/${id}/editar`;
  if (origen === "leche") return `/leche/despachos/${id}`;
  if (origen === "animal") return `/hato/${id}#salida`;
  return "/hato?vista=ventas";
}
/** Días antes del vencimiento desde los que un pago o un cobro pasa a ámbar. */
const DIAS_AVISO_DINERO = 7;

export function senalesDinero(compras: CompraPorPagar[], ventas: VentaPorCobrar[], hoy: string): Senal[] {
  const nivelDe = (vence: string): NivelItem | null => {
    const d = diasHasta(vence, hoy);
    return d < 0 ? "rojo" : d <= DIAS_AVISO_DINERO ? "ambar" : null;
  };
  const texto = (vence: string, verbo: string) => {
    const d = diasHasta(vence, hoy);
    return d < 0 ? `${verbo} hace ${dias(-d)}` : d === 0 ? `${verbo} hoy` : `${verbo} en ${dias(d)}`;
  };
  const pagar: ItemSenal[] = [];
  for (const c of compras) {
    const nivel = nivelDe(c.vence);
    if (nivel) pagar.push({ clave: `pagar-${c.id}`, etiqueta: c.descripcion, detalle: `${pesos(Number(c.monto))} · ${texto(c.vence, "vence")}`.replace("vence hace", "venció hace"), nivel, href: `/hato/gastos/${c.id}/editar`, queHacer: "Paga y marca la compra como pagada.", orden: diasHasta(c.vence, hoy) });
  }
  const cobrar: ItemSenal[] = [];
  for (const v of ventas) {
    const nivel = nivelDe(v.cobro_vence);
    if (nivel) cobrar.push({ clave: `cobrar-${v.clave}`, etiqueta: `${v.producto}${v.tercero ? ` · ${v.tercero}` : ""}`, detalle: `${pesos(Number(v.valor))} · ${texto(v.cobro_vence, "lo esperabas")}`.replace("lo esperabas en", "lo esperas en").replace("lo esperabas hoy", "lo esperas hoy"), nivel, href: hrefVenta(v.origen, v.origen_id), queHacer: `${v.tercero ? `Cobra a ${v.tercero}` : "Cobra"} y registra el cobro${v.origen === "animal" ? ": en la ficha, en «Cobro», toca «Marcar como cobrada»." : " en la venta."}`, orden: diasHasta(v.cobro_vence, hoy) });
  }
  return [
    armarSenal(
      {
        id: "compras-pagar",
        area: "dinero",
        titulo: "Compras por pagar",
        queHacer: "Paga lo que vence y marca la compra como pagada.",
        queSignifica: "Compras a crédito cuyo pago vence pronto o ya venció.",
        regla: `Ámbar: vence hoy o en los próximos ${DIAS_AVISO_DINERO} días. Rojo: ya venció.`,
        accion: { texto: "Ver Hato → Compras", href: "/hato?vista=gastos" },
      },
      pagar,
    ),
    armarSenal(
      {
        id: "ventas-cobrar",
        area: "dinero",
        titulo: "Ventas por cobrar",
        queHacer: "Cobra lo que vence y registra el cobro; si el cliente se atrasó, comunícate con él.",
        queSignifica: "Ventas (leche, animales, carne, derivados) cuyo cobro esperado vence pronto o ya venció.",
        regla: `Ámbar: se espera cobrar hoy o en los próximos ${DIAS_AVISO_DINERO} días. Rojo: el cobro esperado ya pasó.`,
        accion: { texto: "Ver Hato → Ventas", href: "/hato?vista=ventas" },
      },
      cobrar,
    ),
  ];
}
