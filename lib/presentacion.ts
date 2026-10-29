import { Activity, Inbox, CalendarCheck, Coins, Crown, Download, FileBarChart2, FileSpreadsheet, GitFork, Gift, Home, Package, Plus, SlidersHorizontal, Sprout, TrendingUp, Trophy, Users, Wallet, Wrench } from "lucide-react";
import { escena, ESC, ESCENA_HATO, type EscenaDef } from "@/lib/escenas";
import { ESCENA_TODOS_INVENTARIO } from "@/lib/escenas-inventario";
import { menuFinca, menuPrincipal, visibilidadMenu, type EntradaMenu } from "@/lib/menu";
import { MESES_REFERIDO, PORCENTAJE_REFERIDO } from "@/lib/referidos";
import { moduloEnPlan, PLANES, SERVICIOS_PLAN, type ServicioPlan } from "@/lib/planes";
import type { ModuloApp, PlanId } from "@/lib/tipos";

/**
 * Lo que la pantalla de entrada cuenta de cada opción del menú. El orden y los grupos salen de `lib/menu.ts`, así que la presentación sigue el
 * mismo orden que verá la persona al entrar; si se agrega una opción al menú y aquí falta su descripción, `tests/presentacion.test.mjs` falla.
 * Cada texto debe ser verdad: describe solo lo que la app hace.
 */

export type ContenidoOpcion = {
  escena: EscenaDef;
  lema: string;
  puntos: string[];
  /** El módulo o servicio que la pone en un plan superior al primero (para la etiqueta «Desde …»). */
  modulo?: ModuloApp;
  servicio?: ServicioPlan;
  /** Una etiqueta propia en vez de «Desde <plan>» (cuando lo del plan es solo una parte, como el Excel). */
  etiqueta?: string;
};

/** Las opciones del menú que la presentación no describe aparte, y por qué: el plan tiene su propia sección y los datos básicos de la finca van dentro de «Ajustes». */
export const OMITIDAS: Record<string, string> = {
  "/mas/finca": "Datos básicos de la finca: no convence a nadie de registrarse.",
  "/mas/plan": "Los planes tienen su propia sección.",
};

export const CONTENIDO: Record<string, ContenidoOpcion> = {
  "/": {
    escena: escena(Home, "musgo", CalendarCheck),
    lema: "Lo que toca hoy, sin buscarlo",
    puntos: ["Partos de los próximos 30 días y dosis por aplicar", "Animales en periodo de retiro y corrales que piden atención", "Compras por pagar y ventas por cobrar vencidas"],
  },
  "/hato": {
    escena: ESCENA_HATO.todos,
    lema: "Cada animal, con su historia",
    puntos: ["Ficha con foto, edad, estado y padres", "Trae tus animales del libro genealógico o desde un Excel", "Leche, peso, partos y sanidad de cada uno, en su ficha"],
  },
  "/novedades": {
    escena: escena(Inbox, "arcilla", CalendarCheck),
    lema: "Lo que el equipo cuenta de los animales",
    puntos: ["El ordeñador o el veterinario pide una aplicación o una prueba diagnóstica solo eligiendo opciones", "Cada novedad dice quién la envió y la ven el administrador y el veterinario", "Se marca vista o atendida, o se registra de verdad en Sanidad"],
  },
  "/semaforos": {
    escena: escena(Activity, "musgo", CalendarCheck),
    lema: "Qué pide atención, por colores",
    puntos: ["Rojo: actúa hoy; ámbar: programa una acción; verde: en orden", "Partos, diagnósticos, desparasitación, frío y calidad de la leche", "Cada persona ve solo lo de su rol; al tocar una tarjeta ves qué animales son"],
  },
  "/leche": {
    escena: ESCENA_HATO.ordeno,
    lema: "Del ordeño al tanque",
    puntos: ["Ordeño por jornada y por turnos", "Calidad, despachos y frío del tanque", "La leche en retiro se marca como descartada"],
  },
  "/reproduccion": {
    escena: ESCENA_HATO.empadronamiento,
    lema: "Monta, gestación y partos",
    puntos: ["Temporada de monta con control de endogamia", "Fecha prevista de parto de cada hembra", "Partos, crías y lactancias al día"],
  },
  "/carne": {
    escena: ESCENA_HATO.ceba,
    lema: "Cada animal a su peso",
    puntos: ["Pesos, lotes de ceba y ganancia diaria", "Candidatos a ceba según tus propias reglas", "Rendimiento de la canal"],
    modulo: "carne",
  },
  "/sanidad": {
    escena: ESCENA_HATO.sanidad,
    lema: "Vacunas, tratamientos y retiros",
    puntos: ["Programa para un lote y aplica el día que toca", "FAMACHA y pediluvio por animal", "Periodos de retiro de leche y de carne"],
  },
  "/corrales": {
    escena: ESCENA_HATO.corrales,
    lema: "Cada animal en su sitio",
    puntos: ["No deja llenar un corral de más", "Rotación de potreros con días de descanso", "Cuarentena de los animales que llegan"],
    modulo: "corrales",
  },
  "/inventario": {
    escena: ESCENA_TODOS_INVENTARIO,
    lema: "Qué hay en la bodega",
    puntos: ["Medicamentos y vacunas con lo que queda de cada uno", "Las compras suman y las aplicaciones restan, solas", "Aviso de stock bajo y de lotes por vencer"],
    modulo: "inventario",
  },
  "/costos": {
    escena: ESCENA_HATO.gastos,
    lema: "Cuánto cuesta y cuánto deja",
    puntos: ["Compras, ventas y nómina, por lista: eliges, no escribes", "Por pagar y por cobrar, con lo vencido a la vista", "Costo por litro y por animal"],
    modulo: "contabilidad",
  },
  "/reportes": {
    escena: escena(FileBarChart2, "ambar", FileSpreadsheet),
    lema: "Listados listos para decidir",
    puntos: ["Quién está vacía, gestante o por parir, y qué toca palpar", "Ordeño, peso, retiros y sanidad pendiente de todo el hato", "Costos y ventas por las fechas que elijas, todo en Excel"],
    servicio: "reportes",
    etiqueta: "Excel desde Profesional",
  },
  "/proyecciones": {
    escena: escena(TrendingUp, "oliva", Coins),
    lema: "Dónde estará tu aprisco en 1, 2 o 3 años",
    puntos: ["Hato, alimento y dinero mes a mes, con carne y leche por separado", "Parte de tus animales y tus números: cambias un supuesto y ves el efecto", "Compara escenarios y descubre desde qué precio pierdes dinero"],
    modulo: "proyecciones",
  },
  "/mas/productos": {
    escena: escena(Package, "grafito", Users),
    lema: "Tus productos y contactos, una sola vez",
    puntos: ["Productos, proveedores y compradores en una lista", "Después eliges, no escribes: sin nombres repetidos ni mal escritos", "Nada se borra: lo que ya no usas se oculta"],
    modulo: "contabilidad",
  },
  "/hato/endogamia": {
    escena: escena(GitFork, "musgo", Sprout),
    lema: "El parentesco, antes de cruzar",
    puntos: ["La endogamia de cada animal y de todo el hato", "Simula una cruza y mira el resultado antes de montarla", "Sabes con quién comparte antepasados"],
  },
  "/ferias": {
    escena: escena(Trophy, "ambar", Crown),
    lema: "El palmarés de tus animales",
    puntos: ["Ferias y premios de cada animal en su ficha", "El palmarés de toda la finca, en un solo lugar"],
    modulo: "ferias",
  },
  "/mas/ajustes": {
    escena: escena(SlidersHorizontal, "grafito", Wrench),
    lema: "Tu aprisco, con tus reglas",
    puntos: ["Gestación, edad de servicio, ceba, leche y plazos de pezuñas", "Distintos para cabras y para ovejas", "La app avisa con lo que tú definiste, no con números ajenos"],
  },
  "/mas/miembros": {
    escena: ESC.equipo,
    lema: "Cada quien ve lo suyo",
    puntos: ["Invita al ordeñador, al veterinario y al contador", "Cada rol entra solo a lo que le toca", "Tú decides quién entra y quién sale"],
  },
  "/mas/referidos": {
    escena: escena(Gift, "ocre", Wallet),
    lema: "Invita a otro criador",
    puntos: ["Tu enlace personal para invitar", `Recibes el ${PORCENTAJE_REFERIDO} % del plan de quien se une, durante ${MESES_REFERIDO} meses`],
  },
  "/mas/exportar": {
    escena: escena(Download, "musgo", FileSpreadsheet),
    lema: "Tus datos son tuyos",
    puntos: ["Descarga todo lo de tu finca en un Excel, cuando quieras", "Animales, leche, sanidad, partos y cuentas, ordenados por hoja"],
  },
  "/onboarding": {
    escena: escena(Plus, "ocre", Home),
    lema: "Varias fincas, una sola cuenta",
    puntos: ["Cada finca con sus animales y su propio plan, sin tope de fincas", "Cambias de finca en un toque desde el menú"],
  },
};

export type TarjetaFuncion = ContenidoOpcion & { href: string; rotulo: string };
export type GrupoFunciones = { id: string; rotulo: string; titulo: string; texto: string; tarjetas: TarjetaFuncion[] };

/** El encabezado de cada grupo: el mismo nombre del menú y una frase que dice qué se gana. */
const ENCABEZADOS: Record<string, { rotulo: string; titulo: string; texto: string }> = {
  inicio: { rotulo: "Cada día", titulo: "Lo que toca hoy y cada animal con su historia", texto: "Abres la app y ves qué atender; entras a un animal y lo tienes todo." },
  produccion: { rotulo: "Producción y manejo", titulo: "Del ordeño al corral, todo el manejo", texto: "Leche, partos, carne, sanidad, corrales y la bodega, cada uno con sus reglas." },
  dinero: { rotulo: "Dinero y análisis", titulo: "Cuánto cuesta, cuánto deja y qué viene", texto: "Las cuentas de la finca, listados para decidir y una mirada hacia adelante." },
  genealogia: { rotulo: "Genealogía", titulo: "Conoce de dónde viene cada animal", texto: "El parentesco que cuida tu cría y el palmarés que la muestra." },
  finca: { rotulo: "Mi finca", titulo: "Tu finca, con tus reglas y tu equipo", texto: "Defines cómo trabaja tu aprisco, quién entra y qué hacer con tus datos." },
};

const aTarjeta = (e: EntradaMenu): TarjetaFuncion | null => {
  const c = CONTENIDO[e.href];
  return c ? { ...c, href: e.href, rotulo: e.etiqueta } : null;
};

/** Todos los grupos de la presentación, en el orden del menú. Se arma con todo visible: es lo que ofrece la app completa. */
export function gruposDeFunciones(): GrupoFunciones[] {
  const v = visibilidadMenu("propietario", "hacienda");
  const grupos: { id: string; entradas: EntradaMenu[] }[] = [...menuPrincipal(v).map((g) => ({ id: g.id, entradas: g.entradas })), { id: "finca", entradas: menuFinca(v) }];
  return grupos
    .map((g) => ({
      id: g.id,
      ...ENCABEZADOS[g.id],
      tarjetas: g.entradas.filter((e) => !(e.href in OMITIDAS)).map(aTarjeta).filter((t): t is TarjetaFuncion => t !== null),
    }))
    .filter((g) => g.tarjetas.length > 0);
}

/** Desde qué plan se incluye (nulo si está desde el primero) o el texto propio de la etiqueta. */
export function etiquetaDePlan(t: Pick<ContenidoOpcion, "modulo" | "servicio" | "etiqueta">): string | null {
  if (t.etiqueta) return t.etiqueta;
  let desde: PlanId | undefined;
  if (t.servicio) desde = SERVICIOS_PLAN[t.servicio].desde;
  else if (t.modulo) desde = PLANES.find((p) => moduloEnPlan(p.id, t.modulo!))?.id;
  if (!desde || desde === PLANES[0].id) return null;
  return `Desde ${PLANES.find((p) => p.id === desde)!.nombre}`;
}
