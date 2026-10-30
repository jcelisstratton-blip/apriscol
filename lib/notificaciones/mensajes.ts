import { ETIQUETA_AREA, type AreaSemaforo, type ItemSenal, type Senal } from "@/lib/semaforos";
import { formatoFecha } from "@/lib/fechas";
import { LIMITE_MENSAJE, escaparHtml, type BotonUrl } from "@/lib/notificaciones/telegram";

export type NivelMinimo = "rojo" | "ambar";

export type Resumen = {
  texto: string;
  /** Botones debajo del mensaje (una fila por pareja de áreas y una última con Hoy y Semáforos); vacío si no hay una dirección https válida. */
  botones: BotonUrl[][];
  /** Cuántos casos hay en total (rojos = vencido o urgente; ámbar = pendiente). */
  rojos: number;
  ambar: number;
};

/** A qué pantalla de la app lleva el botón de cada área. */
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

/** Cuántos nombres se muestran por tarea antes de «y N más». */
const NOMBRES_POR_TAREA = 3;
/** Margen bajo el límite de Telegram para el encabezado y el pie. */
const MARGEN = 300;

type Tarea = { nivel: "rojo" | "ambar"; titulo: string; cantidad: number; detalle: string | null };

/** «Chispa · MIR-C0046» → «Chispa»: el arete sobra en un mensaje corto (el enlace lleva a la ficha). */
const nombreCorto = (etiqueta: string) => etiqueta.split(" · ")[0];

/**
 * Convierte una señal en tareas: una por nivel (rojo = vencido o urgente, ámbar = pendiente). Lo que tiene fecha límite (`atrasoDias`) cuenta cuántos casos están vencidos
 * y cuál lleva más atraso, en vez de listar cientos de filas.
 */
function tareasDe(senal: Senal, enlace: (i: ItemSenal) => string): Tarea[] {
  const con = (items: ItemSenal[]) => {
    const nombres = items.slice(0, NOMBRES_POR_TAREA).map((i) => enlace(i));
    const resto = items.length - nombres.length;
    return nombres.join(", ") + (resto > 0 ? ` y ${resto} más` : "");
  };
  const tareas: Tarea[] = [];
  const rojos = senal.items.filter((i) => i.nivel === "rojo");
  const ambar = senal.items.filter((i) => i.nivel === "ambar");
  if (rojos.length > 0) {
    const masAtrasado = Math.max(0, ...rojos.map((i) => i.atrasoDias ?? 0));
    const conFecha = rojos.some((i) => i.atrasoDias !== undefined);
    tareas.push({
      nivel: "rojo",
      titulo: conFecha ? `${senal.titulo} · vencidas` : senal.titulo,
      cantidad: rojos.length,
      detalle: conFecha && rojos.length > NOMBRES_POR_TAREA ? `la más atrasada: hace ${masAtrasado} ${masAtrasado === 1 ? "día" : "días"}` : con(rojos),
    });
  }
  if (ambar.length > 0) {
    tareas.push({ nivel: "ambar", titulo: ambar.some((i) => i.atrasoDias !== undefined) ? `${senal.titulo} · pendientes` : senal.titulo, cantidad: ambar.length, detalle: con(ambar) });
  }
  return tareas;
}

/**
 * El resumen del día de una persona, ordenado por área: arriba cuántos casos hay (🔴 vencido o urgente, 🟠 pendiente), luego cada área con sus tareas y,
 * debajo, botones que abren la pantalla de cada área. El detalle largo (qué hacer con cada animal) queda en la app. Nada del texto se interpreta como HTML.
 */
export function armarResumen({
  nombre,
  finca,
  hoy,
  saludo,
  senales,
  nivelMinimo,
  urlBase,
}: {
  nombre: string | null;
  finca: string;
  hoy: string;
  saludo: string;
  senales: Senal[];
  nivelMinimo: NivelMinimo;
  urlBase?: string;
}): Resumen {
  const conBotones = Boolean(urlBase?.startsWith("https://"));
  const enlace = (i: ItemSenal) => {
    const nombreItem = escaparHtml(nombreCorto(i.etiqueta));
    return urlBase ? `<a href="${escaparHtml(urlBase + i.href)}">${nombreItem}</a>` : nombreItem;
  };

  // Cada área con sus tareas; las que tienen algo vencido van primero.
  const filtradas = senales
    .map((s) => ({ ...s, items: s.items.filter((i) => nivelMinimo === "ambar" || i.nivel === "rojo") }))
    .filter((s) => s.items.length > 0);
  const porArea = new Map<AreaSemaforo, Tarea[]>();
  for (const s of filtradas) porArea.set(s.area, [...(porArea.get(s.area) ?? []), ...tareasDe(s, enlace)]);
  const areas = [...porArea.entries()]
    .map(([area, tareas]) => ({ area, tareas, rojos: tareas.filter((t) => t.nivel === "rojo").reduce((n, t) => n + t.cantidad, 0), total: tareas.reduce((n, t) => n + t.cantidad, 0) }))
    .sort((a, b) => b.rojos - a.rojos || b.total - a.total);

  const rojos = areas.reduce((n, a) => n + a.rojos, 0);
  const ambar = areas.reduce((n, a) => n + (a.total - a.rojos), 0);

  const cabecera = `<b>${escaparHtml(finca)}</b>\n${escaparHtml(formatoFecha(hoy, { weekday: "long", day: "numeric", month: "long" }))} · ${escaparHtml(saludo)}${nombre ? `, ${escaparHtml(nombre.split(" ")[0])}` : ""}`;
  const botonesFinales: BotonUrl[] = [
    { texto: "Abrir Hoy", url: `${urlBase}/` },
    { texto: "Ver semáforos", url: `${urlBase}/semaforos` },
  ];

  if (areas.length === 0) {
    return { texto: `${cabecera}\n\nTodo en orden: nada pide atención hoy.`, botones: conBotones ? [botonesFinales] : [], rojos: 0, ambar: 0 };
  }

  const resumen = [rojos > 0 ? `🔴 <b>${rojos}</b> ${rojos === 1 ? "vencido o urgente" : "vencidos o urgentes"}` : null, ambar > 0 ? `🟠 <b>${ambar}</b> ${ambar === 1 ? "pendiente" : "pendientes"}` : null].filter(Boolean).join("   ");

  const bloquesDe = (conNombres: boolean) =>
    areas.map((a) => {
      const lineas = a.tareas.map((t) => {
        const cabeza = `${t.nivel === "rojo" ? "🔴" : "🟠"} ${escaparHtml(t.titulo)} · <b>${t.cantidad}</b>`;
        return conNombres && t.detalle ? `${cabeza}\n      <i>${t.detalle.startsWith("la más") ? escaparHtml(t.detalle) : t.detalle}</i>` : cabeza;
      });
      return `<b>${escaparHtml(ETIQUETA_AREA[a.area].toUpperCase())}</b>\n${lineas.join("\n")}`;
    });

  // Si con los nombres no cabe en un mensaje, se dejan solo las tareas y sus cantidades (los nombres están en la app).
  let texto = `${cabecera}\n\n${resumen}\n\n${bloquesDe(true).join("\n\n")}`;
  if (texto.length > LIMITE_MENSAJE - MARGEN) texto = `${cabecera}\n\n${resumen}\n\n${bloquesDe(false).join("\n\n")}`;

  const botones: BotonUrl[][] = [];
  if (conBotones) {
    const deAreas: BotonUrl[] = areas.map((a) => ({ texto: `${ETIQUETA_AREA[a.area]} · ${a.total}`, url: `${urlBase}${RUTA_AREA[a.area]}` }));
    for (let i = 0; i < deAreas.length; i += 2) botones.push(deAreas.slice(i, i + 2));
    botones.push(botonesFinales);
  }
  return { texto, botones, rojos, ambar };
}
