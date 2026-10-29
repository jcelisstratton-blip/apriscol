import type { EscenaDef } from "@/lib/escenas";
import type { ModuloApp } from "@/lib/tipos";

/** Cómo se muestra y cómo se guarda en Excel el valor de una columna. */
export type TipoColumna = "texto" | "entero" | "decimal" | "fecha" | "porcentaje" | "pesos";

/** Un valor de una celda: texto, número o, en las fechas, el texto AAAA-MM-DD. `null` = sin dato. */
export type Celda = string | number | null;

export type Columna = {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
  /** Ancho en Excel (caracteres). */
  ancho: number;
  /** Decimales en pantalla y en Excel (solo `decimal`; 1 por defecto). Un `porcentaje` se guarda como proporción (0,25 = 25 %). */
  decimales?: number;
  /** Solo va al Excel: en pantalla ya está en el título de la fila (el arete y el nombre). */
  soloExcel?: boolean;
  /** En pantalla se dibuja como insignia junto al título, no como un dato más. */
  insignia?: boolean;
};

export type TonoFila = "neutro" | "ok" | "aviso" | "alerta" | "musgo";

export type FilaReporte = {
  id: string;
  /** Lo que se lee primero en pantalla: «Luna · A-12». */
  titulo: string;
  /** A dónde lleva tocar el título (la ficha del animal). */
  href?: string;
  /** El color de la insignia. */
  tono?: TonoFila;
  valores: Record<string, Celda>;
};

/** Una cifra del encabezado del reporte («Gestantes · 12»). */
export type Indicador = { etiqueta: string; valor: string; detalle?: string; alerta?: boolean };

export type ResultadoReporte = {
  columnas: Columna[];
  filas: FilaReporte[];
  indicadores: Indicador[];
  /** Avisos sobre cómo se leyó el reporte (qué tan completo es, qué se dejó fuera). */
  notas: string[];
};

export type ReporteId =
  | "inventario" | "salidas" | "vacias" | "por_palpar" | "gestantes" | "partos" | "sementales" | "ordeno" | "peso" | "retiro" | "sanidad"
  | "inv_medicamentos" | "inv_lotes" | "inv_mov_med" | "inv_alimento" | "inv_mov_alimento";
export type GrupoReporte = "poblacion" | "reproduccion" | "produccion" | "sanidad" | "inventario";

export type OpcionFiltro = { valor: string; etiqueta: string; detalle: string; escena: EscenaDef };
export type FiltroDef = { clave: string; titulo: string; opciones: OpcionFiltro[] };

export type PuntoAyudaReporte = { titulo: string; texto: string };

export type ReporteDef = {
  id: ReporteId;
  grupo: GrupoReporte;
  titulo: string;
  /** Una línea: qué se ve ahí. */
  detalle: string;
  /** El módulo que debe poder ver la persona (decide también la base con su RLS). */
  modulo: ModuloApp;
  /** Solo el propietario y el administrador lo ven (el veterinario y el ordeñador ven el módulo, pero no estos reportes). Lo comprueban el catálogo, el servidor y la base. */
  soloGestion?: boolean;
  escena: EscenaDef;
  /** Si el reporte se puede mirar por fechas, y cómo se llama el periodo («Salidas entre…»). */
  periodo?: { etiqueta: string };
  /** Si se puede separar por especie (cabras u ovejas). */
  porEspecie: boolean;
  /** Los filtros propios, además de la especie y el periodo. Cada uno tiene un valor por defecto: la primera opción. */
  filtros: FiltroDef[];
  ayuda: PuntoAyudaReporte[];
  /** Lo que se dice cuando no hay nada que mostrar (con los filtros por defecto). */
  vacio: { titulo: string; texto: string };
};
