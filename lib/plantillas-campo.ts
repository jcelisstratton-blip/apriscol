import { limpiarNombreArchivo } from "@/lib/excel-estilo";
import { puedeCargar, type TipoHistoria } from "@/lib/importar-historia";
import { puedeEscribir } from "@/lib/permisos";
import type { PlanId, RolFinca } from "@/lib/tipos";

/**
 * «Llevar las plantillas al campo» (modo sin señal, paso 2): todas las plantillas de cargue que la persona puede usar, en un solo .zip,
 * para llenarlas en el potrero o en el ordeño sin señal (en el celular o en el computador) y cargarlas cuando vuelva la conexión.
 * Aquí viven las reglas puras (qué plantillas, en qué orden, con qué nombre y el «Léeme»); la descarga es
 * `app/(app)/hato/migrar/plantillas/route.ts`.
 */
export type TipoPlantilla = "animales" | TipoHistoria;

/** La descarga del .zip (un enlace común: es un archivo, no una pantalla). */
export const RUTA_PLANTILLAS_CAMPO = "/hato/migrar/plantillas";

/** El ancla de su tarjeta en «Migrar mi finca» (el atajo de «Al grano» lleva directo a ella). */
export const ANCLA_PLANTILLAS_CAMPO = "plantillas-campo";

/** El orden es el de «Migrar mi finca»: primero los corrales (los animales llegan a su corral), luego el hato, su historia y la bodega. */
export const ORDEN_PLANTILLAS: readonly TipoPlantilla[] = ["corrales", "animales", "pesajes", "ordenos", "sanidad", "medicamentos", "alimento"];

/** Cómo se llama cada plantilla dentro del .zip y qué se anota en ella (para el «Léeme»). */
export const TEXTO_PLANTILLA: Record<TipoPlantilla, { nombre: string; que: string }> = {
  corrales: { nombre: "Corrales y potreros", que: "una fila por corral o potrero, con cuántos animales caben" },
  animales: { nombre: "Animales", que: "una fila por animal: arete, sexo, especie, raza, fecha de nacimiento, padre y madre" },
  pesajes: { nombre: "Pesajes", que: "arete, fecha y peso de cada pesada" },
  ordenos: { nombre: "Ordeños", que: "arete, fecha y litros de cada ordeño" },
  sanidad: { nombre: "Sanidad", que: "arete, fecha y qué se aplicó: vacuna, desparasitación, tratamiento…" },
  medicamentos: { nombre: "Medicamentos y vacunas", que: "lo que hay hoy en la bodega, por lote y con su vencimiento" },
  alimento: { nombre: "Alimento", que: "lo que hay hoy en la bodega, en kilos" },
};

/** Para que la persona elija hacerlo así (no es para quien no puede cargar animales: esa no ve «Migrar mi finca»). */
export function puedeLlevarPlantillas(rol: RolFinca, plan: PlanId): boolean {
  return puedeEscribir(rol, "hato", plan);
}

/** Las plantillas que esta persona puede llenar y cargar después: las mismas que le ofrecen las pantallas de cargue, en el orden de la migración. */
export function plantillasDisponibles(rol: RolFinca, plan: PlanId): TipoPlantilla[] {
  if (!puedeLlevarPlantillas(rol, plan)) return [];
  return ORDEN_PLANTILLAS.filter((t) => t === "animales" || puedeCargar(t, rol, plan));
}

/** «1. Corrales y potreros.xlsx», «2. Animales.xlsx»…: numeradas para que se lean en orden en cualquier explorador de archivos. */
export function nombreEnZip(tipo: TipoPlantilla, posicion: number): string {
  return `${posicion + 1}. ${TEXTO_PLANTILLA[tipo].nombre}.xlsx`;
}

export const NOMBRE_LEAME = "Léeme primero.txt";

/** El nombre del .zip que se descarga: con la finca (sin caracteres que un sistema de archivos rechace). */
export function nombreZip(finca: string): string {
  return `Plantillas de ${limpiarNombreArchivo(finca) || "mi finca"} - Apriscol.zip`;
}

/** El texto del «Léeme» que va dentro del .zip: qué hay, en qué orden llenarlo y cómo cargarlo al volver la señal. Saltos de línea de Windows (lo abre el Bloc de notas). */
export function textoLeame(finca: string, tipos: readonly TipoPlantilla[]): string {
  const lineas = [
    `Plantillas de ${finca} para llevar al campo`,
    "",
    "Llénalas donde estés, aunque no haya señal: en el computador con Excel, o en el celular con la app de Excel",
    "(abre sin internet los archivos que ya descargaste). Cuando vuelva la señal, entra a Apriscol y cárgalas.",
    "",
    "Qué hay, en el orden en que conviene cargarlas:",
    ...tipos.map((t, i) => `  ${nombreEnZip(t, i)} - ${TEXTO_PLANTILLA[t].que}.`),
    "",
    "Cómo llenarlas:",
    "  - Cada plantilla trae una hoja «Instrucciones» y listas desplegables: elige de la lista en lugar de escribir.",
    "  - Una fila por registro. Las columnas con * son obligatorias; las demás, si las tienes.",
    "  - Escribe los aretes igual que en la app. Fechas como 20/11/2026 y números con coma decimal (3,6).",
    "  - No cambies los títulos de las columnas ni el nombre de las hojas.",
    "",
    "Cómo cargarlas al volver la señal:",
    "  Apriscol > Hato > Migrar mi finca > el paso de cada plantilla > «Cargar». La app revisa cada fila antes de guardar",
    "  y te dice qué corregir; si algo no queda bien, puedes deshacer el cargue.",
    "",
    "Si tus corrales, razas o productos cambian, descarga las plantillas de nuevo: las listas salen de tu finca el día de la descarga.",
  ];
  return lineas.join("\r\n") + "\r\n";
}
