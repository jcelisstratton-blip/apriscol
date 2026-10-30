import { ETIQUETA_AREA, type ItemSenal, type Senal } from "@/lib/semaforos";
import { formatoFecha } from "@/lib/fechas";
import { LIMITE_MENSAJE, escaparHtml } from "@/lib/notificaciones/telegram";

export type NivelMinimo = "rojo" | "ambar";

export type Resumen = {
  texto: string;
  /** Cuántos casos tiene el mensaje y cuántos quedaron fuera por espacio (están en la app). */
  mostrados: number;
  omitidos: number;
  rojos: number;
  ambar: number;
};

type Caso = { item: ItemSenal; titulo: string; area: string };

/** Cuántos casos caben en un resumen antes de mandar a la app (un mensaje largo no se lee en el celular). */
const MAX_CASOS = 12;
/** Margen bajo el límite de Telegram para el encabezado y el pie. */
const MARGEN = 400;

/**
 * El resumen del día de una persona: lo que ya le muestran Hoy y Semáforos, en un mensaje corto. Primero lo que se actúa hoy (rojo), luego lo que se programa (ámbar);
 * con nivel mínimo «rojo» solo llega lo urgente. Cada caso lleva un enlace al punto exacto de la app. Nada del texto se interpreta como HTML.
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
  const casos: Caso[] = senales
    .flatMap((s) => s.items.map((item) => ({ item, titulo: s.titulo, area: ETIQUETA_AREA[s.area] })))
    .filter((c) => nivelMinimo === "ambar" || c.item.nivel === "rojo")
    .sort((a, b) => (a.item.nivel === b.item.nivel ? a.item.orden - b.item.orden : a.item.nivel === "rojo" ? -1 : 1));
  const rojos = casos.filter((c) => c.item.nivel === "rojo").length;
  const ambar = casos.length - rojos;

  const cabecera = `<b>${escaparHtml(finca)}</b> · ${escaparHtml(formatoFecha(hoy, { weekday: "long", day: "numeric", month: "long" }))}\n${escaparHtml(saludo)}${nombre ? `, ${escaparHtml(nombre.split(" ")[0])}` : ""}.`;
  const pie = urlBase ? `\nVer todo en <a href="${escaparHtml(urlBase)}/semaforos">Apriscol</a>` : "";

  if (casos.length === 0) {
    return { texto: `${cabecera}\n\nTodo en orden: nada pide atención hoy.${pie}`, mostrados: 0, omitidos: 0, rojos: 0, ambar: 0 };
  }

  const linea = (c: Caso) => {
    const etiqueta = escaparHtml(c.item.etiqueta);
    const enlace = urlBase ? `<a href="${escaparHtml(urlBase + c.item.href)}">${etiqueta}</a>` : etiqueta;
    const queHacer = c.item.queHacer ? `\n   ↳ ${escaparHtml(c.item.queHacer)}` : "";
    return `• ${enlace} — ${escaparHtml(c.item.detalle)}${queHacer}`;
  };

  const bloques: string[] = [];
  let usado = cabecera.length + pie.length + MARGEN;
  let mostrados = 0;
  for (const nivel of ["rojo", "ambar"] as const) {
    const delNivel = casos.filter((c) => c.item.nivel === nivel);
    if (delNivel.length === 0) continue;
    const titulo = nivel === "rojo" ? "🔴 <b>Rojo · actúa hoy</b>" : "🟠 <b>Ámbar · programa</b>";
    const lineas: string[] = [];
    let tituloActual = "";
    for (const c of delNivel) {
      if (mostrados >= MAX_CASOS) break;
      const encabezado = c.titulo !== tituloActual ? `<b>${escaparHtml(c.titulo)}</b>\n` : "";
      const parte = `${encabezado}${linea(c)}`;
      if (usado + parte.length + 1 > LIMITE_MENSAJE) break;
      lineas.push(parte);
      usado += parte.length + 1;
      tituloActual = c.titulo;
      mostrados++;
    }
    if (lineas.length > 0) bloques.push(`${titulo}\n${lineas.join("\n")}`);
  }

  const omitidos = casos.length - mostrados;
  const resto = omitidos > 0 ? `\n… y ${omitidos} ${omitidos === 1 ? "caso más" : "casos más"} en la app.` : "";
  return { texto: `${cabecera}\n\n${bloques.join("\n\n")}${resto}${pie}`, mostrados, omitidos, rojos, ambar };
}
