/**
 * «Migrar mi finca»: los pasos para traer una finca a Apriscol, ordenados por etapas, cada uno con su estado real (sale de lo que ya hay cargado). Es la guía que
 * une los cargues por Excel (corrales, animales, pesos, ordeños, sanidad, medicamentos y alimento) con lo que se revisa al final. Puro: la pantalla le pasa los
 * conteos y los permisos; el ícono y el color de cada tarjeta los pone la pantalla a partir de `id`.
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
  /** Medicamentos y vacunas del catálogo, y cuántos conteos de apertura (por lote) tienen. */
  productosVet: number;
  aperturasVet: number;
  /** Alimentos del catálogo y cuántos tienen conteo de apertura. */
  alimentos: number;
  aperturasAlimento: number;
};

export type PermisosMigracion = { hato: boolean; corrales: boolean; reproduccion: boolean; carne: boolean; leche: boolean; sanidad: boolean; medicamentos: boolean; alimento: boolean };

export type EstadoPaso = "hecho" | "pendiente" | "bloqueado";

export type EtapaId = "preparar" | "hato" | "historia" | "bodega" | "cierre";
export type PasoId = "corrales" | "animales" | "pesajes" | "ordenos" | "sanidad" | "medicamentos" | "alimento" | "revision";

export type SubPaso = { titulo: string; hecho: boolean; dato: string | null };

export type PasoMigracion = {
  id: PasoId;
  etapa: EtapaId;
  titulo: string;
  detalle: string;
  estado: EstadoPaso;
  /** Lo que ya hay, en una línea («124 animales»); null si todavía no hay nada. */
  dato: string | null;
  href: string;
  accion: string;
  /** Otra forma de hacer lo mismo (por ejemplo, crear uno a mano), si la hay. */
  alternativa?: { href: string; texto: string };
  /** Un paso opcional no impide dar la migración por terminada. */
  opcional: boolean;
  /** Si es true, el cargue de este paso es por Excel (y se puede deshacer). */
  porExcel: boolean;
  /** Las partes de un paso que van en el mismo archivo (la genealogía y los partos van con los animales). */
  subpasos?: SubPaso[];
  /** Por qué no se puede avanzar todavía (solo con estado «bloqueado»). */
  motivo?: string;
};

export type EtapaMigracion = { id: EtapaId; titulo: string; detalle: string; pasos: PasoMigracion[]; hechos: number; total: number };

const n = (cantidad: number, uno: string, varios: string) => `${cantidad.toLocaleString("es-CO")} ${cantidad === 1 ? uno : varios}`;

const ETAPAS: Record<EtapaId, { titulo: string; detalle: string }> = {
  preparar: { titulo: "Prepara tu finca", detalle: "Los corrales y potreros se crean primero, para que cada animal llegue ya a su sitio." },
  hato: { titulo: "Tu hato", detalle: "Los animales, con su genealogía, sus partos y su estado reproductivo, todo en un solo archivo." },
  historia: { titulo: "Su historia", detalle: "Lo que ya tienes anotado. Alimenta las gráficas, los semáforos y los reportes." },
  bodega: { titulo: "Tu bodega", detalle: "Cuenta lo que hay hoy: desde ese día, las compras y los consumos mantienen el stock solos." },
  cierre: { titulo: "Listo para operar", detalle: "Una última mirada antes de empezar a trabajar con la app." },
};

export function pasosMigracion(c: ConteosMigracion, p: PermisosMigracion): PasoMigracion[] {
  const sinAnimales = c.animales === 0;
  const primero = "Primero carga tus animales.";
  const pasos: PasoMigracion[] = [];

  if (p.corrales) {
    pasos.push({
      id: "corrales",
      etapa: "preparar",
      titulo: "Corrales y potreros",
      detalle: "Créalos primero y cada animal llegará ya a su corral: el archivo de animales los reconoce por su nombre. Con un Excel los creas todos de una vez.",
      estado: c.ubicaciones > 0 ? "hecho" : "pendiente",
      dato: c.ubicaciones > 0 ? n(c.ubicaciones, "corral o potrero", "corrales y potreros") : null,
      href: "/hato/importar/historia/corrales",
      accion: c.ubicaciones > 0 ? "Cargar más corrales" : "Cargar corrales",
      alternativa: { href: c.ubicaciones > 0 ? "/hato/corrales" : "/hato/corrales/nueva", texto: c.ubicaciones > 0 ? "Ver mis corrales" : "Crear uno a mano" },
      opcional: true,
      porExcel: true,
    });
  }
  if (p.hato) {
    const sub: SubPaso[] = [
      { titulo: "Animales", hecho: c.animales > 0, dato: c.animales > 0 ? `${n(c.animales, "animal", "animales")}${c.desdeExcel > 0 ? ` · ${c.desdeExcel.toLocaleString("es-CO")} desde Excel` : ""}` : null },
      { titulo: "Genealogía (padre y madre)", hecho: c.conPadres > 0, dato: c.conPadres > 0 ? `${c.conPadres.toLocaleString("es-CO")} de ${c.animales.toLocaleString("es-CO")} con padre o madre` : null },
      ...(p.reproduccion ? [{ titulo: "Partos y servicios", hecho: c.servicios + c.lactancias > 0, dato: c.servicios + c.lactancias > 0 ? `${n(c.lactancias, "lactancia", "lactancias")} · ${n(c.servicios, "servicio", "servicios")}` : null }] : []),
    ];
    pasos.push({
      id: "animales",
      etapa: "hato",
      titulo: "Tus animales",
      detalle:
        "Sube tu Excel tal como lo tengas: la app propone qué columna es cuál y tú lo confirmas. Solo el número de arete es indispensable. En el mismo archivo van el arete del padre y de la madre, y los partos y servicios de las hembras. Si ya cargaste animales y te faltó algo, súbelo de nuevo con «Nuevos y completar».",
      estado: c.animales > 0 ? "hecho" : "pendiente",
      dato: null,
      href: "/hato/importar",
      accion: c.animales > 0 ? "Cargar más animales" : "Cargar animales",
      opcional: false,
      porExcel: true,
      subpasos: sub,
    });
  }
  if (p.carne) {
    pasos.push({
      id: "pesajes",
      etapa: "historia",
      titulo: "Historia de pesos",
      detalle: "Los pesajes que ya tienes anotados: arete, fecha y peso. Alimentan la ganancia diaria y la ceba. Tienes una plantilla para descargar, o sirve tu propio Excel.",
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
      etapa: "historia",
      titulo: "Historia de ordeños",
      detalle: "Los litros de cada hembra por día (y jornada, si ordeñas dos veces). Alimentan la curva de lactancia y los reportes de leche. Tienes una plantilla para descargar, o sirve tu propio Excel.",
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
      etapa: "historia",
      titulo: "Historia de sanidad",
      detalle: "Vacunas, desparasitaciones y tratamientos que ya tienes anotados: arete, fecha y tipo (y producto, dosis y próxima fecha si los tienes). De aquí salen las próximas vacunas y los retiros. Lo de cada día se registra desde Sanidad.",
      estado: sinAnimales ? "bloqueado" : c.eventosSanitarios > 0 ? "hecho" : "pendiente",
      dato: c.eventosSanitarios > 0 ? n(c.eventosSanitarios, "evento registrado", "eventos registrados") : null,
      href: "/hato/importar/historia/sanidad",
      accion: c.eventosSanitarios > 0 ? "Cargar más sanidad" : "Cargar sanidad",
      opcional: true,
      porExcel: true,
      motivo: sinAnimales ? primero : undefined,
    });
  }
  if (p.medicamentos) {
    pasos.push({
      id: "medicamentos",
      etapa: "bodega",
      titulo: "Medicamentos y vacunas",
      detalle: "Lo que hay hoy en tu bodega, por lote y con su vencimiento, y los datos de cada producto (presentación, días de retiro). Así la app avisa cuándo algo se acaba o se vence, y descuenta solo lo que aplicas.",
      estado: c.aperturasVet > 0 ? "hecho" : "pendiente",
      dato: c.aperturasVet > 0 ? `${n(c.productosVet, "producto", "productos")} · ${n(c.aperturasVet, "lote contado", "lotes contados")}` : c.productosVet > 0 ? `${n(c.productosVet, "producto", "productos")} sin contar` : null,
      href: "/hato/importar/historia/medicamentos",
      accion: c.aperturasVet > 0 ? "Cargar más medicamentos" : "Cargar medicamentos",
      alternativa: { href: "/inventario", texto: "Ver el inventario" },
      opcional: true,
      porExcel: true,
    });
  }
  if (p.alimento) {
    pasos.push({
      id: "alimento",
      etapa: "bodega",
      titulo: "Alimento",
      detalle: "Cuántos kg tienes hoy de concentrado, forraje, sales y suplementos. Así sabes cuántos días te alcanza y la app te avisa antes de que se acabe.",
      estado: c.aperturasAlimento > 0 ? "hecho" : "pendiente",
      dato: c.aperturasAlimento > 0 ? `${n(c.alimentos, "alimento", "alimentos")} · ${n(c.aperturasAlimento, "contado", "contados")}` : c.alimentos > 0 ? `${n(c.alimentos, "alimento", "alimentos")} sin contar` : null,
      href: "/hato/importar/historia/alimento",
      accion: c.aperturasAlimento > 0 ? "Cargar más alimento" : "Cargar alimento",
      alternativa: { href: "/inventario?vista=alimento", texto: "Ver el inventario de alimento" },
      opcional: true,
      porExcel: true,
    });
  }
  pasos.push({
    id: "revision",
    etapa: "cierre",
    titulo: "Revisa que todo quedó bien",
    detalle: "Mira el hato y los semáforos: lo que pide atención aparece solo, con los datos que cargaste. Si algo no cuadra, deshaz ese cargue desde «Cargues anteriores» y vuelve a subirlo.",
    estado: sinAnimales ? "bloqueado" : "pendiente",
    dato: null,
    href: "/semaforos",
    accion: "Ver semáforos",
    alternativa: { href: "/hato", texto: "Ver mi hato" },
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

/** El paso que sigue: el primero, en el orden de la guía, que se puede hacer y todavía no está hecho. Null cuando no queda ninguno (solo falta revisar). */
export function siguientePaso(pasos: PasoMigracion[]): PasoMigracion | null {
  return pasos.find((p) => p.id !== "revision" && p.estado === "pendiente") ?? null;
}

/** Los pasos agrupados por etapa, en orden; una etapa sin pasos (porque el rol o el plan no los permite) no aparece. */
export function etapasMigracion(pasos: PasoMigracion[]): EtapaMigracion[] {
  return (Object.keys(ETAPAS) as EtapaId[])
    .map((id) => {
      const delaEtapa = pasos.filter((p) => p.etapa === id);
      const trabajo = delaEtapa.filter((p) => p.id !== "revision");
      return { id, ...ETAPAS[id], pasos: delaEtapa, hechos: trabajo.filter((p) => p.estado === "hecho").length, total: trabajo.length };
    })
    .filter((e) => e.pasos.length > 0);
}
