import { FMT } from "@/lib/excel-estilo";
import { limpiarNombreArchivo } from "@/lib/excel-estilo";

/**
 * Exportación completa de una finca a Excel: qué hojas lleva, cómo se llaman las columnas y cómo se escribe cada valor. Sin dependencias de
 * Excel ni de la base: lo que se puede probar solo vive aquí; `lib/exportar-finca-excel.ts` lo usa para armar el libro.
 */

export type BusquedaId = "animales" | "ubicaciones" | "lotes" | "lotes_ceba" | "terceros" | "productos" | "veterinarios" | "personal" | "ferias" | "empadronamientos" | "eventos" | "programas" | "razas";

export type Hoja = {
  tabla: string;
  hoja: string;
  /** Columna estable para paginar (por defecto `id`). */
  orden?: string;
  /** A qué catálogo apunta `producto_id` en esta tabla. */
  producto?: "productos" | "veterinarios";
  ocultar?: string[];
};

/** Orden de las hojas: lo del hato primero, luego reproducción, leche, sanidad, dinero y la finca en sí. */
export const HOJAS: Hoja[] = [
  { tabla: "ubicaciones", hoja: "Corrales y potreros" },
  { tabla: "movimientos_animales", hoja: "Movimientos de corral", orden: "desde" },
  { tabla: "lotes", hoja: "Lotes" },
  { tabla: "lotes_ceba", hoja: "Lotes de ceba" },
  { tabla: "servicios", hoja: "Servicios" },
  { tabla: "diagnosticos_gestacion", hoja: "Diagnósticos de preñez" },
  { tabla: "partos", hoja: "Partos" },
  { tabla: "crias", hoja: "Crías" },
  { tabla: "celos", hoja: "Celos" },
  { tabla: "lactancias", hoja: "Lactancias" },
  { tabla: "empadronamientos", hoja: "Temporadas de monta" },
  { tabla: "empadronamiento_hembras", hoja: "Hembras en monta" },
  { tabla: "empadronamiento_machos", hoja: "Sementales en monta" },
  { tabla: "sementales_externos", hoja: "Sementales de fuera" },
  { tabla: "ordenos", hoja: "Ordeños" },
  { tabla: "despachos_leche", hoja: "Despachos de leche" },
  { tabla: "analisis_leche", hoja: "Análisis de leche" },
  { tabla: "controles_calidad", hoja: "Controles de calidad" },
  { tabla: "controles_frio", hoja: "Controles de frío" },
  { tabla: "mantenimiento_ordeno", hoja: "Mantenimiento de ordeño" },
  { tabla: "pesajes", hoja: "Pesajes" },
  { tabla: "canales", hoja: "Canales" },
  { tabla: "consumo_lote", hoja: "Consumo de alimento" },
  { tabla: "eventos_sanitarios", hoja: "Tratamientos", producto: "veterinarios" },
  { tabla: "evento_sanitario_animales", hoja: "Animales tratados", orden: "evento_id" },
  { tabla: "programas_sanitarios", hoja: "Programas sanitarios", producto: "veterinarios" },
  { tabla: "programa_sanitario_animales", hoja: "Animales programados", orden: "programa_id" },
  { tabla: "pruebas_sanitarias", hoja: "Pruebas sanitarias" },
  { tabla: "evaluaciones_famacha", hoja: "FAMACHA" },
  { tabla: "productos_veterinarios", hoja: "Productos veterinarios" },
  { tabla: "gastos", hoja: "Compras", producto: "productos" },
  { tabla: "ventas", hoja: "Ventas", producto: "productos" },
  { tabla: "bajas", hoja: "Bajas" },
  { tabla: "finca_productos", hoja: "Catálogo de productos", ocultar: ["clave", "orden"] },
  { tabla: "finca_terceros", hoja: "Proveedores y compradores" },
  { tabla: "personal", hoja: "Personal" },
  { tabla: "pagos_personal", hoja: "Pagos de personal" },
  { tabla: "ferias", hoja: "Ferias" },
  { tabla: "participaciones_feria", hoja: "Premios y participaciones" },
  { tabla: "finca_ajustes", hoja: "Ajustes de la finca", orden: "finca_id" },
  { tabla: "finca_ajustes_especie", hoja: "Ajustes por especie", orden: "especie" },
  { tabla: "reglas_ceba", hoja: "Reglas de ceba", orden: "especie" },
];

/** Columnas que no sirven a una persona (identificadores internos, quién editó, vínculos con el libro de la asociación). */
export const COLUMNAS_OCULTAS = new Set(["id", "finca_id", "created_by", "created_at", "updated_at", "updated_by", "deleted_at", "client_request_id", "libro_id"]);

/** Columnas con un id que se cambia por el nombre o el arete de lo que apuntan. Las demás `*_id` se descartan. */
export const BUSQUEDA_POR_COLUMNA: Record<string, { busqueda: BusquedaId; etiqueta: string }> = {
  animal_id: { busqueda: "animales", etiqueta: "Animal (arete)" },
  hembra_id: { busqueda: "animales", etiqueta: "Hembra (arete)" },
  madre_id: { busqueda: "animales", etiqueta: "Madre (arete)" },
  padre_id: { busqueda: "animales", etiqueta: "Padre (arete)" },
  macho_id: { busqueda: "animales", etiqueta: "Macho (arete)" },
  madre_genetica_id: { busqueda: "animales", etiqueta: "Madre genética (arete)" },
  ubicacion_id: { busqueda: "ubicaciones", etiqueta: "Corral o potrero" },
  lote_id: { busqueda: "lotes", etiqueta: "Lote" },
  lote_ceba_id: { busqueda: "lotes_ceba", etiqueta: "Lote de ceba" },
  tercero_id: { busqueda: "terceros", etiqueta: "Proveedor o comprador" },
  feria_id: { busqueda: "ferias", etiqueta: "Feria" },
  personal_id: { busqueda: "personal", etiqueta: "Persona" },
  empadronamiento_id: { busqueda: "empadronamientos", etiqueta: "Temporada de monta" },
  evento_id: { busqueda: "eventos", etiqueta: "Tratamiento" },
  programa_id: { busqueda: "programas", etiqueta: "Programa" },
  raza_id: { busqueda: "razas", etiqueta: "Raza" },
};

/** Dónde vive cada archivo (foto o documento) que una fila puede traer, para convertir su ruta en un enlace. */
export const ARCHIVO_POR_COLUMNA: Record<string, "fotos-animales" | "premios" | "soportes"> = {
  "animales.foto_path": "fotos-animales",
  "participaciones_feria.foto_path": "premios",
  "analisis_leche.soporte_path": "soportes",
  "controles_calidad.soporte_path": "soportes",
  "gastos.soporte_path": "soportes",
  "pruebas_sanitarias.soporte_path": "soportes",
  "pagos_personal.soporte_pila": "soportes",
};
/** Los enlaces a archivos duran una semana (el máximo razonable para un enlace firmado): hay que descargarlos antes. */
export const DIAS_ENLACE_ARCHIVO = 7;

const ETIQUETAS: Record<string, string> = {
  fecha: "Fecha", hora: "Hora", tipo: "Tipo", motivo: "Motivo", estado: "Estado", resultado: "Resultado", observaciones: "Observaciones", notas: "Notas", detalle: "Detalle",
  nombre: "Nombre", descripcion: "Descripción", especie: "Especie", sexo: "Sexo", numero_arete: "Número de arete", chip: "Microchip", color: "Color", marcas: "Marcas", rasgos: "Rasgos",
  raza: "Raza", peso_kg: "Peso (kg)", peso_nacer_kg: "Peso al nacer (kg)", peso_adulto_hembra_kg: "Peso adulto de la hembra (kg)", litros: "Litros", jornada: "Jornada",
  valor: "Valor", valor_total: "Valor total", monto: "Monto", costo: "Costo", cantidad: "Cantidad", unidad: "Unidad", precio_litro: "Precio por litro", precio_unitario: "Precio unitario",
  valor_base: "Valor base", valor_pago: "Valor del pago", costo_total: "Costo total", factor: "Factor prestacional", vence: "Vence", pagado_en: "Pagado en", cobrado_en: "Cobrado en", cobro_vence: "El cobro vence",
  proveedor: "Proveedor", comprador: "Comprador", rubro: "Rubro", linea: "Línea", destino: "Destino", destino_tipo: "Destino", automatico: "Automático", activo: "Activo", activa: "Activa",
  desde: "Desde", hasta: "Hasta", fecha_inicio: "Fecha de inicio", fecha_fin: "Fecha final", fecha_fin_prevista: "Fecha final prevista", fecha_base: "Fecha base", cerrado_en: "Cerrado en", cancelado_en: "Cancelado en",
  fecha_parto: "Fecha del parto", fecha_secado: "Fecha de secado", fecha_nacimiento: "Fecha de nacimiento", fecha_nacimiento_aprox: "Nacimiento aproximado", fecha_baja: "Fecha de baja", fecha_compra: "Fecha de compra", valor_compra: "Valor de compra ($)",
  fecha_programada: "Fecha programada", fecha_vencimiento: "Fecha de vencimiento", fecha_ingreso: "Fecha de ingreso", fecha_retiro: "Fecha de retiro", proxima_fecha: "Próxima fecha", periodo_desde: "Periodo desde", periodo_hasta: "Periodo hasta",
  prestamo_desde: "Préstamo desde", prestamo_hasta: "Préstamo hasta", padre_externo: "Padre (si no está en el hato)", madre_externa: "Madre (si no está en el hato)", macho_externo: "Semental de fuera", origen: "Origen",
  vocacion: "Aptitud", uso_macho: "Uso del macho", partos_previos: "Partos previos", numero_crias: "Número de crías", complicaciones: "Complicaciones", causa_aborto: "Causa del aborto", experiencia_anios: "Años de experiencia", formacion: "Formación", tarjeta_profesional: "Tarjeta profesional", tipo_contador: "Tipo de contador", especialidades: "Especialidades", acreditaciones: "Acreditaciones", turno_ordeno: "Turno de ordeño", tipo_ordeno: "Tipo de ordeño", curso_manipulacion: "Curso de manipulación de alimentos", curso_manipulacion_vence: "Vence el curso de manipulación", labor_principal: "Labor principal", asistido_por: "Asistido por", es_veterinario: "Es veterinario de la finca", protocolo_posoperatorio: "Protocolo posoperatorio y fármacos", metodo: "Método", dias_gestacion: "Días de gestación (ecografía)", num_fetos: "Fetos detectados", viabilidad_fetal: "Viabilidad fetal", indicador_palpacion: "Indicador de la palpación", prueba_nombre: "Prueba o kit", prueba_resultado: "Resultado de la prueba", semen_lote: "Pajilla o lote de semen", tecnica_inseminacion: "Técnica de inseminación", tipo_transferencia: "Tipo de transferencia", embrion_codigo: "Código del embrión", madre_genetica_externa: "Madre genética (otra finca)", responsable: "Responsable o técnico",
  muestra: "Muestra", grasa_pct: "Grasa (%)", proteina_pct: "Proteína (%)", rcs_miles_ml: "RCS (miles/ml)", laboratorio: "Laboratorio", solidos_totales_pct: "Sólidos totales (%)", lactosa_pct: "Lactosa (%)", crioscopia_c: "Crioscopia (°C)",
  residuos_antibioticos: "Residuos de antibióticos", temperatura_c: "Temperatura (°C)", equipo: "Equipo", momento: "Momento", presion_kpa: "Presión (kPa)", cmt: "CMT", descartada: "Descartada", motivo_descarte: "Motivo del descarte",
  kg_alimento: "Alimento (kg)", alimento: "Alimento", tanque: "Tanque", guia: "Guía", guia_movilizacion: "Guía de movilización", destino_consumo: "Destino de consumo", tipo_baja: "Tipo de baja", peso_vivo_kg: "Peso vivo (kg)",
  peso_canal_caliente_kg: "Peso de la canal caliente (kg)", peso_canal_fria_kg: "Peso de la canal fría (kg)", conformacion: "Conformación", engrasamiento: "Engrasamiento", grasa_dorsal_mm: "Grasa dorsal (mm)", grasa_visceral: "Grasa visceral", planta: "Planta",
  condicion_corporal: "Condición corporal", puntaje: "Puntaje", puesto: "Puesto", categoria: "Categoría", nivel: "Nivel", departamento: "Departamento", municipio: "Municipio", organizador: "Organizador",
  premio_descripcion: "Premio", premio_en_dinero: "Premio en dinero", producto_nombre: "Producto", lote_producto: "Lote del producto", dosis: "Dosis", unidad_dosis: "Unidad de la dosis", via: "Vía",
  retiro_leche_dias: "Retiro de leche (días)", retiro_carne_dias: "Retiro de carne (días)", fin_retiro_leche: "Fin del retiro de leche", fin_retiro_carne: "Fin del retiro de carne", diagnostico: "Diagnóstico",
  registro_ica: "Registro ICA", prueba: "Prueba", cargo: "Cargo", vinculacion: "Vinculación", forma_pago: "Forma de pago", correo: "Correo", rol: "Rol", soporte_pila: "Soporte de la PILA", soporte_path: "Documento", foto_path: "Foto",
  capacidad: "Capacidad", area_m2: "Área (m²)", piso: "Piso", agua: "Agua", uso: "Uso", dias_ocupacion_max: "Días de ocupación máx.", dias_descanso_min: "Días de descanso mín.", num_hembras: "Número de hembras", externo: "Externo",
  endogamia: "Endogamia", excepcion: "Excepción", hembras_por_macho: "Hembras por macho", edad_min_meses: "Edad mínima (meses)", peso_min_kg: "Peso mínimo (kg)", cc_min: "Condición corporal mínima",
  hato_origen: "Hato de origen", propietario: "Propietario", telefono: "Teléfono", sanidad: "Sanidad", condiciones: "Condiciones", peso_meta_kg: "Peso meta (kg)", vivo: "Vivo", numero: "Número", orden: "Orden", clave: "Clave",
  tipo_parto_origen: "Tipo de parto de origen", turnos_ordeno: "Turnos de ordeño", ceba_pospuesto_hasta: "Ceba pospuesta hasta", gestacion_dias: "Gestación (días)", factor_prestacional: "Factor prestacional",
};

/** Título de una columna: el de la lista si lo hay y, si no, el nombre con espacios y mayúscula inicial. */
export function etiquetaColumna(columna: string): string {
  const conocida = ETIQUETAS[columna];
  if (conocida) return conocida;
  const texto = columna.replace(/_/g, " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Columnas cuyo valor es una opción de lista guardada como `monta_natural`: se escribe «Monta natural». */
const COLUMNAS_OPCION = new Set([
  "tipo", "motivo", "estado", "resultado", "metodo", "jornada", "rubro", "linea", "destino_tipo", "vinculacion", "forma_pago", "uso", "piso", "sexo", "especie", "origen", "vocacion", "uso_macho",
  "rol", "nivel", "categoria", "tipo_baja", "momento", "via",
]);

/** Opciones que se guardan sin tildes: así se leen en el Excel. */
const OPCIONES_CON_TILDE: Record<string, string> = {
  inseminacion: "Inseminación", transferencia_embrionaria: "Transferencia de embrión", ecografia: "Ecografía", palpacion: "Palpación", cesarea: "Cesárea", vacia: "Vacía",
  manana: "Mañana", perdida: "Pérdida", baja_produccion: "Baja producción", rotacion: "Rotación", alta_produccion: "Alta producción", crias: "Crías", vacunacion: "Vacunación",
  desparasitacion: "Desparasitación", podologia: "Podología", compra_animales: "Compra de animales", mano_obra: "Mano de obra", por_servicio: "Por servicio", nomina: "Nómina",
  gestacion: "Gestación", sanitario: "Sanitario", cuarentena: "Cuarentena", analisis: "Análisis", dudoso: "Dudoso", mantenimiento: "Mantenimiento",
};

export const humanizarOpcion = (valor: string) => {
  if (OPCIONES_CON_TILDE[valor]) return OPCIONES_CON_TILDE[valor];
  const t = valor.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export type ValorCelda = { valor: string | number | Date | boolean | null; formato?: string };

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_MARCA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const CINCO_HORAS = 5 * 60 * 60 * 1000;

/** Convierte lo que devuelve la base en lo que se escribe en la celda: fechas reales, Sí/No, listas con comas y opciones legibles. */
export function aCelda(columna: string, valor: unknown): ValorCelda {
  if (valor === null || valor === undefined || valor === "") return { valor: null };
  if (typeof valor === "boolean") return { valor: valor ? "Sí" : "No" };
  if (Array.isArray(valor)) return { valor: valor.map((v) => (typeof v === "string" && COLUMNAS_OPCION.has(columna) ? humanizarOpcion(v) : String(v))).join(", ") || null };
  if (typeof valor === "number") return { valor };
  if (typeof valor === "string") {
    if (RE_FECHA.test(valor)) return { valor: new Date(`${valor}T00:00:00Z`), formato: FMT.fecha };
    if (RE_MARCA.test(valor)) {
      // Colombia no cambia de hora: se guarda la hora local de Bogotá (UTC-5) como si fuera la del libro.
      const f = new Date(new Date(valor).getTime() - CINCO_HORAS);
      return Number.isNaN(f.getTime()) ? { valor } : { valor: f, formato: FMT.fechaHora };
    }
    if (COLUMNAS_OPCION.has(columna) && /^[a-z][a-z0-9]*(_[a-z0-9]+)+$|^[a-z]+$/.test(valor)) return { valor: humanizarOpcion(valor) };
    return { valor };
  }
  if (typeof valor === "object") return { valor: JSON.stringify(valor) };
  return { valor: String(valor) };
}

/** Nombre de hoja válido en Excel: máximo 31 caracteres y sin `[]:*?/\`. */
export const nombreHoja = (n: string) => n.replace(/[[\]:*?/\\]/g, "-").slice(0, 31);

export function nombreArchivoFinca(finca: string, hoy: string): string {
  const limpio = limpiarNombreArchivo(finca) || "Finca";
  return `${limpio} - Datos de la finca - ${hoy}.xlsx`;
}
