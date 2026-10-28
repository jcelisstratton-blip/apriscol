/**
 * Novedades: avisos informativos que se envían **solo eligiendo opciones** (lo único que se escribe son las observaciones). Tienen destino:
 * «Comprar» (algo que falta en la finca) llega al administrador; «Aplicar dosis» (sobre un animal) llega al veterinario; el propietario atiende ambas.
 * El ordeñador crea las dos; el veterinario, solo «Comprar». No son registros oficiales: no generan retiros, costos ni historial.
 * Las de prueba, coprológico y FAMACHA ya enviadas se siguen viendo.
 */
import { ETIQUETA_GRUPO } from "@/lib/costos";
import { ETIQUETA_MUESTRA, DETALLE_MUESTRA } from "@/lib/coprologico";
import { FAMACHA } from "@/lib/famacha";
import { ETIQUETA_EVENTO, ETIQUETA_PRODUCTO, ETIQUETA_PRUEBA_CORTA, ETIQUETA_RESULTADO_PRUEBA, ETIQUETA_VIA } from "@/lib/sanidad";
import { ANESTESIAS, CATEGORIAS, COJERAS, ETAPAS, MOTIVOS, etiquetaDe } from "@/lib/sanidad-campos";
import type { Novedad } from "@/lib/tipos";

export type TipoNovedad = Novedad["tipo"];
export const TIPOS_NOVEDAD: TipoNovedad[] = ["compra", "aplicacion", "prueba", "coprologico", "famacha"];
/** Qué novedades se pueden crear hoy: comprar y aplicar dosis. Las de prueba, coprológico y FAMACHA ya enviadas se siguen viendo. */
export const TIPOS_NOVEDAD_NUEVA: TipoNovedad[] = ["compra", "aplicacion"];
export const ETIQUETA_TIPO_NOVEDAD: Record<TipoNovedad, string> = {
  compra: "Comprar",
  aplicacion: "Aplicar dosis",
  prueba: "Prueba diagnóstica",
  coprologico: "Examen coprológico",
  famacha: "Evaluación FAMACHA",
};
export const DETALLE_TIPO_NOVEDAD: Record<TipoNovedad, string> = {
  compra: "Avisa al administrador de algo que hace falta en la finca",
  aplicacion: "Vacunación, desparasitación, tratamiento, podología, pediluvio, cirugía u otro",
  prueba: "CAE, brucelosis, CMT…",
  coprologico: "Una muestra de heces tomada",
  famacha: "El color del párpado del animal",
};

export type EstadoNovedad = Novedad["estado"];
export const ESTADOS_NOVEDAD: EstadoNovedad[] = ["nueva", "vista", "atendida"];
export const ETIQUETA_ESTADO_NOVEDAD: Record<EstadoNovedad, string> = { nueva: "Nueva", vista: "Vista", atendida: "Atendida" };
export const TONO_ESTADO_NOVEDAD: Record<EstadoNovedad, "alerta" | "aviso" | "ok"> = { nueva: "alerta", vista: "aviso", atendida: "ok" };

/** Cuándo ocurrió: se elige entre tres opciones (no se escribe una fecha). */
export type CuandoNovedad = "hoy" | "ayer" | "antes_de_ayer";
export const CUANDO_NOVEDAD: { valor: CuandoNovedad; etiqueta: string; dias: number }[] = [
  { valor: "hoy", etiqueta: "Hoy", dias: 0 },
  { valor: "ayer", etiqueta: "Ayer", dias: 1 },
  { valor: "antes_de_ayer", etiqueta: "Antes de ayer", dias: 2 },
];
export function fechaDeNovedad(cuando: CuandoNovedad, hoy: string): string {
  const dias = CUANDO_NOVEDAD.find((c) => c.valor === cuando)?.dias ?? 0;
  return new Date(Date.parse(`${hoy}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
}

type CamposResumen = Pick<Novedad, "tipo" | "grupo_compra" | "compra_producto_nombre" | "tipo_evento" | "categoria" | "etapa" | "motivo" | "cojera" | "anestesia" | "categoria_producto" | "producto_nombre" | "via" | "lote" | "prueba" | "resultado_prueba" | "tipo_muestra" | "puntaje">;

/** Lo que dice una novedad, en una frase: «Vacunación · Clostridiosis y tétanos · Primera dosis · Clostridial · lote CL7-2511». */
export function resumenNovedad(n: CamposResumen): string {
  switch (n.tipo) {
    case "compra":
      return ["Comprar", n.grupo_compra ? ETIQUETA_GRUPO[n.grupo_compra] : null, n.compra_producto_nombre ?? "Otro producto"].filter(Boolean).join(" · ");
    case "aplicacion":
      return [
        n.tipo_evento ? ETIQUETA_EVENTO[n.tipo_evento] : "Aplicar dosis",
        // Las novedades anteriores traían solo el tipo de producto.
        !n.tipo_evento && n.categoria_producto ? ETIQUETA_PRODUCTO[n.categoria_producto] : null,
        n.tipo_evento && n.categoria ? (etiquetaDe(CATEGORIAS[n.tipo_evento], n.categoria) ?? n.categoria) : null,
        n.etapa ? etiquetaDe(ETAPAS, n.etapa) : null,
        n.motivo ? etiquetaDe(MOTIVOS, n.motivo) : null,
        n.cojera !== null && n.cojera !== undefined ? etiquetaDe(COJERAS, String(n.cojera)) : null,
        n.anestesia ? etiquetaDe(ANESTESIAS, n.anestesia) : null,
        n.producto_nombre,
        n.via ? ETIQUETA_VIA[n.via].toLowerCase() : null,
        n.lote ? `lote ${n.lote}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "prueba":
      return ["Prueba diagnóstica", n.prueba ? ETIQUETA_PRUEBA_CORTA[n.prueba] : null, n.resultado_prueba ? ETIQUETA_RESULTADO_PRUEBA[n.resultado_prueba].toLowerCase() : null].filter(Boolean).join(" · ");
    case "coprologico":
      return ["Examen coprológico", n.tipo_muestra ? `${ETIQUETA_MUESTRA[n.tipo_muestra].toLowerCase()} (${DETALLE_MUESTRA[n.tipo_muestra].toLowerCase()})` : null].filter(Boolean).join(" · ");
    case "famacha":
      return ["Evaluación FAMACHA", n.puntaje ? `${n.puntaje}: ${FAMACHA[n.puntaje].color.toLowerCase()}` : null].filter(Boolean).join(" · ");
  }
}

/** La pantalla oficial donde se registra de verdad lo que contó una novedad (con el animal ya elegido). */
export function direccionParaRegistrar(n: Pick<Novedad, "tipo" | "animal_id" | "categoria_producto" | "tipo_evento">): string {
  switch (n.tipo) {
    case "compra":
      return "/hato/gastos/nuevo";
    case "aplicacion": {
      const tipo = n.tipo_evento ?? (n.categoria_producto === "vacuna" ? "vacunacion" : n.categoria_producto === "desparasitante" ? "desparasitacion" : "tratamiento");
      return `/hato/sanidad/nuevo?animal=${n.animal_id}&tipo=${tipo}`;
    }
    case "prueba":
      return `/sanidad/pruebas/nueva?animal=${n.animal_id}`;
    case "coprologico":
      return `/hato/sanidad/coprologico/nuevo?animal=${n.animal_id}`;
    case "famacha":
      return `/hato/sanidad/famacha/nueva?animal=${n.animal_id}`;
  }
}

export type EntradaNovedad = Partial<Pick<Novedad, "tipo" | "grupo_compra" | "compra_producto_nombre" | "tipo_evento" | "categoria_producto" | "producto_id" | "via" | "prueba" | "resultado_prueba" | "tipo_muestra" | "puntaje">>;

/** Qué falta para poder enviar (null si está completa). Cada tipo pide lo suyo, todo por selección. */
export function faltaEnNovedad(e: EntradaNovedad): string | null {
  switch (e.tipo) {
    case "compra":
      return !e.grupo_compra ? "Elige qué hace falta comprar." : null;
    case "aplicacion":
      return !e.tipo_evento && !e.categoria_producto ? "Elige qué se hizo (vacunación, desparasitación, tratamiento…)." : null;
    case "prueba":
      return !e.prueba ? "Elige la prueba." : !e.resultado_prueba ? "Elige cómo salió." : null;
    case "coprologico":
      return !e.tipo_muestra ? "Elige cómo se tomó la muestra." : null;
    case "famacha":
      return !e.puntaje ? "Elige el puntaje (1 a 5)." : null;
    default:
      return "Elige qué quieres avisar.";
  }
}

/** Los productos del catálogo que tienen sentido para lo que se hizo: una vacunación ofrece vacunas, una desparasitación desparasitantes y un tratamiento el resto de medicamentos. */
export function productosParaTipo<T extends { tipo: string }>(tipoEvento: string | null | undefined, productos: T[]): T[] {
  if (tipoEvento === "vacunacion") return productos.filter((p) => p.tipo === "vacuna");
  if (tipoEvento === "desparasitacion") return productos.filter((p) => p.tipo === "desparasitante");
  if (tipoEvento === "tratamiento") return productos.filter((p) => p.tipo !== "vacuna" && p.tipo !== "desparasitante");
  return productos;
}
