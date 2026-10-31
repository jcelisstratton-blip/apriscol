import { ETIQUETA_AREA, type AreaSemaforo, type ItemSenal, type Senal } from "@/lib/semaforos";
import { formatoFecha } from "@/lib/fechas";
import { rutaInternaSegura } from "@/lib/notificaciones/destinos";
import { LIMITE_MENSAJE, escaparHtml, type Boton } from "@/lib/notificaciones/telegram";

export type NivelMinimo = "rojo" | "ambar";

export type Resumen = {
  texto: string;
  /** Los botones de debajo: uno por área (muestra su detalle aquí mismo) y, si hay una dirección https, «Abrir Hoy» y «Ver semáforos». */
  botones: Boton[][];
  /** Cuántos casos hay en total (rojos = vencido o urgente; ámbar = pendiente). */
  rojos: number;
  ambar: number;
};

/** A qué pantalla de la app lleva «Abrir … en la app» de cada área. */
export const RUTA_AREA: Record<AreaSemaforo, string> = {
  reproduccion: "/reproduccion",
  sanidad: "/sanidad",
  leche: "/leche",
  ceba: "/carne",
  corrales: "/corrales",
  inventario: "/inventario",
  alimento: "/inventario?vista=alimento",
  dinero: "/costos",
};

// ───────────────────────── Lo que dicen los botones ─────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Accion = { tipo: "area"; area: AreaSemaforo; fincaId: string } | { tipo: "resumen"; fincaId: string };

/** Lo que se le pone a un botón (Telegram admite hasta 64 caracteres): «ar:sanidad:<finca>» y «res:<finca>». */
export const datosArea = (area: AreaSemaforo, fincaId: string) => `ar:${area}:${fincaId}`;
export const datosResumen = (fincaId: string) => `res:${fincaId}`;

/** Lo que llega de Telegram nunca se da por bueno: se valida el área y la finca antes de usarlos. */
export function leerAccion(datos: string): Accion | null {
  const partes = datos.split(":");
  if (partes.length === 2 && partes[0] === "res" && UUID.test(partes[1])) return { tipo: "resumen", fincaId: partes[1] };
  if (partes.length === 3 && partes[0] === "ar" && Object.hasOwn(RUTA_AREA, partes[1]) && UUID.test(partes[2])) return { tipo: "area", area: partes[1] as AreaSemaforo, fincaId: partes[2] };
  return null;
}

// ───────────────────────── Armado ─────────────────────────
export type EntradaResumen = {
  nombre: string | null;
  finca: string;
  fincaId: string;
  hoy: string;
  saludo: string;
  senales: Senal[];
  nivelMinimo: NivelMinimo;
  urlBase?: string;
};

type Tarea = { id: string; titulo: string; queHacer: string; rojos: ItemSenal[]; ambar: ItemSenal[] };
type Area = { area: AreaSemaforo; tareas: Tarea[]; rojos: number; ambar: number };

const nombreCorto = (etiqueta: string) => etiqueta.split(" · ")[0];
const recortar = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
/** Cuántas tareas llevan su propio botón en el detalle de un área (el resto se ve con «Ver toda el área»). */
const MAX_BOTONES_TAREA = 8;
const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
const esHttps = (urlBase?: string) => Boolean(urlBase?.startsWith("https://"));

/**
 * Un botón que abre Apriscol dentro de Telegram, en la ruta interna que dice `ruta` (ya revisada: `rutaInternaSegura`). Así no sale el aviso con la dirección que Telegram
 * muestra al abrir un enlace; la sesión se abre con la firma que Telegram entrega (`/telegram/entrar`).
 */
const botonApp = (texto: string, e: { urlBase?: string; fincaId: string }, ruta: string): Boton[] =>
  esHttps(e.urlBase) && rutaInternaSegura(ruta) ? [{ texto, miniApp: `${e.urlBase}/telegram/entrar?f=${e.fincaId}&d=${encodeURIComponent(ruta)}` }] : [];

/** Las tareas (una por señal) de cada área, con las que tienen algo vencido primero; con nivel mínimo «rojo» no entra lo pendiente. */
function agrupar(senales: Senal[], nivelMinimo: NivelMinimo): Area[] {
  const porArea = new Map<AreaSemaforo, Tarea[]>();
  for (const s of senales) {
    const rojos = s.items.filter((i) => i.nivel === "rojo");
    const ambar = nivelMinimo === "ambar" ? s.items.filter((i) => i.nivel === "ambar") : [];
    if (rojos.length + ambar.length === 0) continue;
    porArea.set(s.area, [...(porArea.get(s.area) ?? []), { id: s.id, titulo: s.titulo, queHacer: s.queHacer, rojos, ambar }]);
  }
  return [...porArea.entries()]
    .map(([area, tareas]) => ({
      area,
      tareas: [...tareas].sort((a, b) => b.rojos.length - a.rojos.length || b.ambar.length - a.ambar.length),
      rojos: tareas.reduce((n, t) => n + t.rojos.length, 0),
      ambar: tareas.reduce((n, t) => n + t.ambar.length, 0),
    }))
    .sort((a, b) => b.rojos - a.rojos || b.ambar - a.ambar);
}

/** «Hasta 3 días de atraso» de lo que tiene fecha límite; `null` si la tarea no la tiene. */
function masAtrasado(items: ItemSenal[]): number | null {
  const con = items.filter((i) => i.atrasoDias !== undefined);
  return con.length > 0 ? Math.max(...con.map((i) => i.atrasoDias ?? 0)) : null;
}

const cabeceraDe = (e: EntradaResumen) =>
  `<b>${escaparHtml(e.finca)}</b>\n${escaparHtml(formatoFecha(e.hoy, { weekday: "long", day: "numeric", month: "long" }))} · ${escaparHtml(e.saludo)}${e.nombre ? `, ${escaparHtml(e.nombre.split(" ")[0])}` : ""}`;

const totales = (rojos: number, ambar: number) =>
  [rojos > 0 ? `🔴 <b>${rojos}</b> ${rojos === 1 ? "vencido o urgente" : "vencidos o urgentes"}` : null, ambar > 0 ? `🟠 <b>${ambar}</b> ${ambar === 1 ? "pendiente" : "pendientes"}` : null].filter(Boolean).join("   ");

const conteos = (rojos: number, ambar: number) => [rojos > 0 ? `🔴 ${rojos}` : null, ambar > 0 ? `🟠 ${ambar}` : null].filter(Boolean).join(" · ");

/** Máximo de tareas en «Lo más urgente» del resumen automático: lo demás se ve al tocar su área. */
const MAX_URGENTES = 6;

/**
 * El resumen automático del día: corto. Arriba cuántos casos hay (🔴 vencido o urgente, 🟠 pendiente), luego lo más urgente (una línea por tarea) y debajo un botón
 * por área que muestra su detalle en el mismo chat. Nada del texto se interpreta como HTML.
 */
export function armarResumen(e: EntradaResumen): Resumen {
  const areas = agrupar(e.senales, e.nivelMinimo);
  const rojos = areas.reduce((n, a) => n + a.rojos, 0);
  const ambar = areas.reduce((n, a) => n + a.ambar, 0);
  const finales: Boton[] = [...botonApp("Abrir Hoy", e, "/"), ...botonApp("Ver semáforos", e, "/semaforos")];
  const cabecera = cabeceraDe(e);

  if (areas.length === 0) return { texto: `${cabecera}\n\nTodo en orden: nada pide atención hoy.`, botones: finales.length ? [finales] : [], rojos: 0, ambar: 0 };

  // Lo más urgente: las tareas con vencidos (o, si no hay, las pendientes), de más a menos casos.
  const urgentes = areas
    .flatMap((a) => a.tareas.map((t) => ({ ...t, area: a.area })))
    .filter((t) => (rojos > 0 ? t.rojos.length > 0 : t.ambar.length > 0))
    .sort((a, b) => (rojos > 0 ? b.rojos.length - a.rojos.length : b.ambar.length - a.ambar.length));
  const lineas = urgentes.slice(0, MAX_URGENTES).map((t) => {
    const items = rojos > 0 ? t.rojos : t.ambar;
    const atraso = rojos > 0 ? masAtrasado(items) : null;
    return `${rojos > 0 ? "🔴" : "🟠"} <b>${items.length}</b> · ${escaparHtml(t.titulo)}${atraso !== null && items.length > 1 ? ` <i>(la más atrasada: hace ${dias(atraso)})</i>` : ""}`;
  });
  const mas = urgentes.length - lineas.length;
  const titulo = rojos > 0 ? "Lo más urgente" : "Lo pendiente";
  const texto = `${cabecera}\n\n${totales(rojos, ambar)}\n\n<b>${titulo}</b>\n${lineas.join("\n")}${mas > 0 ? `\n… y ${mas} ${mas === 1 ? "tarea más" : "tareas más"}` : ""}\n\n<i>Toca un área para ver el detalle.</i>`;

  const deAreas: Boton[] = areas.map((a) => ({ texto: `${ETIQUETA_AREA[a.area]} · ${conteos(a.rojos, a.ambar)}`, accion: datosArea(a.area, e.fincaId) }));
  const botones: Boton[][] = [];
  for (let i = 0; i < deAreas.length; i += 2) botones.push(deAreas.slice(i, i + 2));
  if (finales.length) botones.push(finales);
  return { texto, botones, rojos, ambar };
}

/** Cuántos nombres se muestran por tarea en el detalle de un área antes de «y N más». */
const NOMBRES_DETALLE = 5;

/**
 * El detalle de un área, para cuando la persona toca su botón: cada tarea con sus casos vencidos y pendientes y los nombres (con enlace a su ficha). Si no cabe en un
 * mensaje se corta con un «y N tareas más en la app». Debajo: abrir esa área en la app y volver al resumen.
 */
export function armarDetalleArea(e: EntradaResumen & { area: AreaSemaforo }): Resumen {
  const areas = agrupar(e.senales, e.nivelMinimo);
  const a = areas.find((x) => x.area === e.area);
  const volver: Boton = { texto: "← Volver al resumen", accion: datosResumen(e.fincaId) };
  const verArea: Boton[] = botonApp("Ver toda el área", e, `/semaforos?area=${e.area}`);
  if (!a) return { texto: `<b>${escaparHtml(ETIQUETA_AREA[e.area].toUpperCase())}</b>\nNada pide atención en esta área.`, botones: [[volver]], rojos: 0, ambar: 0 };

  const nombres = (items: ItemSenal[]) => {
    const unicos = [...new Map(items.map((i) => [nombreCorto(i.etiqueta), i])).values()];
    // Los nombres van como texto, sin enlace: cada enlace dentro del texto hace que Telegram muestre su aviso con la dirección completa. La salida a la app es el botón de abajo.
    const vistos = unicos.slice(0, NOMBRES_DETALLE).map((i) => escaparHtml(nombreCorto(i.etiqueta)));
    const resto = unicos.length - vistos.length;
    return vistos.join(", ") + (resto > 0 ? ` y ${resto} más` : "");
  };
  const linea = (emoji: string, items: ItemSenal[], sufijo: string) => {
    const atraso = emoji === "🔴" ? masAtrasado(items) : null;
    const cola = atraso !== null && items.length > 1 ? `<i>la más atrasada: hace ${dias(atraso)}</i>` : nombres(items);
    // Un solo caso: se dice por qué está ahí y qué hacer, para que se sepa antes de abrir la app. Con varios, el detalle de cada uno está en su lista.
    const uno = items.length === 1 ? items[0] : null;
    const explica = uno ? `\n   ${escaparHtml(uno.detalle)}.${uno.queHacer ? ` <b>Qué hacer:</b> ${escaparHtml(uno.queHacer)}` : ""}` : "";
    return `${emoji} <b>${items.length}</b>${sufijo} · ${cola}${explica}`;
  };

  const encabezado = `<b>${escaparHtml(ETIQUETA_AREA[e.area].toUpperCase())}</b> · ${conteos(a.rojos, a.ambar)}`;
  const bloques: string[] = [];
  let usado = encabezado.length + 400;
  for (const t of a.tareas) {
    const conFecha = [...t.rojos, ...t.ambar].some((i) => i.atrasoDias !== undefined);
    const partes = [`<b>${escaparHtml(t.titulo)}</b>`];
    if (t.rojos.length > 0) partes.push(linea("🔴", t.rojos, conFecha ? " vencidas" : ""));
    if (t.ambar.length > 0) partes.push(linea("🟠", t.ambar, conFecha ? " pendientes" : ""));
    // Qué hacer con la tarea. Si es un solo caso y ese caso ya trae su propia instrucción (más concreta), no se repite la general.
    const casos = [...t.rojos, ...t.ambar];
    if (!(casos.length === 1 && casos[0].queHacer)) partes.push(`➜ <b>Qué hacer:</b> ${escaparHtml(t.queHacer)}`);
    const bloque = partes.join("\n");
    if (usado + bloque.length + 2 > LIMITE_MENSAJE) break;
    bloques.push(bloque);
    usado += bloque.length + 2;
  }
  const faltan = a.tareas.length - bloques.length;
  const texto = `${encabezado}\n\n${bloques.join("\n\n")}${faltan > 0 ? `\n\n… y ${faltan} ${faltan === 1 ? "tarea más" : "tareas más"} en la app.` : ""}`;

  // Un botón por tarea de las que se listan arriba: lleva directo a lo suyo. Si la tarea tiene UN solo caso, a la pantalla donde se atiende ese caso; si tiene varios, a su
  // lista en Semáforos (ya con la tarea abierta y solo esa área). Así nadie tiene que adivinar dónde está lo que acaba de leer.
  const botonesTarea: Boton[][] = a.tareas.slice(0, Math.min(bloques.length, MAX_BOTONES_TAREA)).flatMap((t) => {
    const items = [...t.rojos, ...t.ambar];
    const unico = items.length === 1 ? items[0] : null;
    const directa = unico ? rutaInternaSegura(unico.href) : null;
    const ruta = directa ?? `/semaforos?area=${e.area}&s=${t.id}`;
    const etiqueta = unico && directa ? `${t.titulo} · ${nombreCorto(unico.etiqueta)}` : `${t.titulo} (${items.length})`;
    const boton = botonApp(recortar(etiqueta, 60), e, ruta);
    return boton.length > 0 ? [boton] : [];
  });
  return { texto, botones: [...botonesTarea, [...verArea, volver]], rojos: a.rojos, ambar: a.ambar };
}
