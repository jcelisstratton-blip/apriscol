/**
 * «Migrar mi finca»: los pasos para traer una finca a Apriscol, cada uno con su estado real (sale de lo que ya hay cargado). Es la guía que une los
 * cargues sueltos (animales, pesajes, ordeños) con lo que se registra desde su propio módulo (corrales, sanidad, inventario). Puro: la pantalla le pasa
 * los conteos y los permisos.
 */

export type ConteosMigracion = {
  ubicaciones: number;
  animales: number;
  desdeExcel: number;
  conPadres: number;
  servicios: number;
  lactancias: number;
  pesajes: number;
  ordenos: number;
  eventosSanitarios: number;
  aperturas: number;
};

export type PermisosMigracion = { hato: boolean; corrales: boolean; reproduccion: boolean; carne: boolean; leche: boolean; sanidad: boolean; inventario: boolean };

export type EstadoPaso = "hecho" | "pendiente" | "bloqueado";

export type PasoMigracion = {
  id: "corrales" | "animales" | "genealogia" | "reproduccion" | "pesajes" | "ordenos" | "sanidad" | "inventario" | "revision";
  titulo: string;
  detalle: string;
  estado: EstadoPaso;
  /** Lo que ya hay, en una línea («124 animales»); null si todavía no hay nada. */
  dato: string | null;
  href: string;
  accion: string;
  /** Un paso opcional no impide dar la migración por terminada. */
  opcional: boolean;
  /** Si es true, el cargue de este paso es por Excel (y se puede deshacer); si no, se registra desde su módulo. */
  porExcel: boolean;
  /** Por qué no se puede avanzar todavía (solo con estado «bloqueado»). */
  motivo?: string;
};

const n = (cantidad: number, uno: string, varios: string) => `${cantidad.toLocaleString("es-CO")} ${cantidad === 1 ? uno : varios}`;

export function pasosMigracion(c: ConteosMigracion, p: PermisosMigracion): PasoMigracion[] {
  const sinAnimales = c.animales === 0;
  const primero = "Primero carga tus animales.";
  const pasos: PasoMigracion[] = [];

  if (p.corrales) {
    pasos.push({
      id: "corrales",
      titulo: "Corrales y potreros",
      detalle: "Créalos antes de cargar los animales si quieres que cada uno llegue ya a su corral: el archivo los reconoce por el nombre.",
      estado: c.ubicaciones > 0 ? "hecho" : "pendiente",
      dato: c.ubicaciones > 0 ? n(c.ubicaciones, "corral o potrero", "corrales y potreros") : null,
      href: c.ubicaciones > 0 ? "/hato/corrales" : "/hato/corrales/nueva",
      accion: c.ubicaciones > 0 ? "Ver corrales" : "Crear corrales",
      opcional: true,
      porExcel: false,
    });
  }
  if (p.hato) {
    pasos.push({
      id: "animales",
      titulo: "Tus animales",
      detalle: "Sube tu Excel tal como lo tengas: la app propone qué columna es cuál y tú la confirmas. Solo el número de arete es indispensable.",
      estado: c.animales > 0 ? "hecho" : "pendiente",
      dato: c.animales > 0 ? `${n(c.animales, "animal", "animales")}${c.desdeExcel > 0 ? ` · ${c.desdeExcel.toLocaleString("es-CO")} desde Excel` : ""}` : null,
      href: "/hato/importar",
      accion: c.animales > 0 ? "Cargar más animales" : "Cargar animales",
      opcional: false,
      porExcel: true,
    });
    pasos.push({
      id: "genealogia",
      titulo: "Genealogía",
      detalle: "El arete del padre y de la madre de cada animal. Va en el mismo archivo de animales; si ya los cargaste sin ella, sube el archivo de nuevo con «Nuevos y completar».",
      estado: sinAnimales ? "bloqueado" : c.conPadres > 0 ? "hecho" : "pendiente",
      dato: c.conPadres > 0 ? `${c.conPadres.toLocaleString("es-CO")} de ${c.animales.toLocaleString("es-CO")} con padre o madre` : null,
      href: "/hato/importar",
      accion: "Completar con Excel",
      opcional: false,
      porExcel: true,
      motivo: sinAnimales ? primero : undefined,
    });
  }
  if (p.reproduccion) {
    pasos.push({
      id: "reproduccion",
      titulo: "Partos y servicios",
      detalle: "El último parto, el último servicio y la preñez de cada hembra. Van en el archivo de animales (columnas de partos y servicio); de ahí salen las fechas previstas de parto y el estado reproductivo.",
      estado: sinAnimales ? "bloqueado" : c.servicios + c.lactancias > 0 ? "hecho" : "pendiente",
      dato: c.servicios + c.lactancias > 0 ? `${n(c.lactancias, "lactancia", "lactancias")} · ${n(c.servicios, "servicio", "servicios")}` : null,
      href: "/hato/importar",
      accion: "Cargar con estas columnas",
      opcional: false,
      porExcel: true,
      motivo: sinAnimales ? primero : undefined,
    });
  }
  if (p.carne) {
    pasos.push({
      id: "pesajes",
      titulo: "Historia de pesos",
      detalle: "Los pesajes que ya tengas anotados: arete, fecha y peso. Alimentan la ganancia diaria y la ceba.",
      estado: sinAnimales ? "bloqueado" : c.pesajes > 0 ? "hecho" : "pendiente",
      dato: c.pesajes > 0 ? n(c.pesajes, "pesaje", "pesajes") : null,
      href: "/hato/importar/historia/pesajes",
      accion: c.pesajes > 0 ? "Cargar más pesajes" : "Cargar pesajes",
      opcional: true,
      porExcel: true,
      motivo: sinAnimales ? primero : undefined,
    });
  }
  if (p.leche) {
    pasos.push({
      id: "ordenos",
      titulo: "Historia de ordeños",
      detalle: "Los litros de cada hembra por día (y jornada, si ordeñas dos veces). Alimentan la curva de lactancia y los reportes de leche.",
      estado: sinAnimales ? "bloqueado" : c.ordenos > 0 ? "hecho" : "pendiente",
      dato: c.ordenos > 0 ? n(c.ordenos, "ordeño", "ordeños") : null,
      href: "/hato/importar/historia/ordenos",
      accion: c.ordenos > 0 ? "Cargar más ordeños" : "Cargar ordeños",
      opcional: true,
      porExcel: true,
      motivo: sinAnimales ? primero : undefined,
    });
  }
  if (p.sanidad) {
    pasos.push({
      id: "sanidad",
      titulo: "Historia de sanidad",
      detalle: "Vacunas, desparasitaciones y tratamientos que ya tengas anotados: arete, fecha y tipo (y producto, dosis, próxima fecha si los tienes). Las próximas vacunas y los retiros salen de aquí. Lo de cada día se registra desde Sanidad.",
      estado: sinAnimales ? "bloqueado" : c.eventosSanitarios > 0 ? "hecho" : "pendiente",
      dato: c.eventosSanitarios > 0 ? n(c.eventosSanitarios, "evento registrado", "eventos registrados") : null,
      href: "/hato/importar/historia/sanidad",
      accion: c.eventosSanitarios > 0 ? "Cargar más sanidad" : "Cargar sanidad",
      opcional: true,
      porExcel: true,
      motivo: sinAnimales ? primero : undefined,
    });
  }
  if (p.inventario) {
    pasos.push({
      id: "inventario",
      titulo: "Inventario de bodega",
      detalle: "Cuenta lo que tienes hoy de cada medicamento y alimento: es el conteo de apertura. A partir de ahí, las compras y las aplicaciones lo mantienen al día.",
      estado: c.aperturas > 0 ? "hecho" : "pendiente",
      dato: c.aperturas > 0 ? n(c.aperturas, "conteo de apertura", "conteos de apertura") : null,
      href: "/inventario",
      accion: "Ir al inventario",
      opcional: true,
      porExcel: false,
    });
  }
  pasos.push({
    id: "revision",
    titulo: "Revisa que todo quedó bien",
    detalle: "Mira el hato y los semáforos: lo que pide atención aparece solo con los datos que cargaste. Si algo no cuadra, deshaz el cargue desde «Cargues anteriores» y vuélvelo a subir.",
    estado: sinAnimales ? "bloqueado" : "pendiente",
    dato: null,
    href: "/semaforos",
    accion: "Ver semáforos",
    opcional: true,
    porExcel: false,
    motivo: sinAnimales ? primero : undefined,
  });
  return pasos;
}

/** Cuántos pasos con trabajo hay y cuántos están hechos (el último, «revisa», no cuenta: es una mirada, no un cargue). */
export function avanceMigracion(pasos: PasoMigracion[]): { hechos: number; total: number } {
  const trabajo = pasos.filter((p) => p.id !== "revision");
  return { hechos: trabajo.filter((p) => p.estado === "hecho").length, total: trabajo.length };
}
