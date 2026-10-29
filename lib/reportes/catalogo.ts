import { ESCENA_FILTRO, ESCENA_REPORTE } from "@/lib/escenas-reportes";
import { CC_ALTA, CC_BAJA, DIAS_MINIMOS_GDP, DIAS_SIN_PESAR, EDAD_DESTETE_MESES } from "@/lib/reportes/calculos";
import { DIAS_PARTO_PROXIMO, DIAS_REPETIR_DX_DESDE, DIAS_REPETIR_DX_HASTA } from "@/lib/reproduccion";
import { DIAS_AVISO_VENCIMIENTO } from "@/lib/inventario";
import { DIAS_VENTANA_CONSUMO, MIN_DIAS_CON_SALIDA } from "@/lib/inventario-alimento";
import type { FiltroDef, GrupoReporte, OpcionFiltro, ReporteDef, ReporteId } from "@/lib/reportes/tipos";
import type { Especie, ModuloApp } from "@/lib/tipos";

const opcion = (valor: string, etiqueta: string, detalle: string): OpcionFiltro => ({ valor, etiqueta, detalle, escena: ESCENA_FILTRO[valor] });
const filtro = (clave: string, titulo: string, opciones: OpcionFiltro[]): FiltroDef => ({ clave, titulo, opciones });
const coma = (n: number) => String(n).replace(".", ",");

/** El filtro por especie, igual en todos los reportes. Solo se ofrece si la finca tiene las dos especies. */
export const FILTRO_ESPECIE: FiltroDef = filtro("especie", "Especie", [
  opcion("todos", "Todas", "Cabras y ovejas"),
  opcion("caprino", "Cabras", "Solo caprinos"),
  opcion("ovino", "Ovejas", "Solo ovinos"),
]);

export const GRUPOS_REPORTE: { id: GrupoReporte; titulo: string; detalle: string }[] = [
  { id: "poblacion", titulo: "Población", detalle: "Qué animales hay y cuáles salieron" },
  { id: "reproduccion", titulo: "Reproducción", detalle: "Quién está lista, gestante o por parir" },
  { id: "produccion", titulo: "Producción", detalle: "Leche, peso y condición corporal" },
  { id: "sanidad", titulo: "Sanidad", detalle: "Retiros y lo que está pendiente" },
  { id: "inventario", titulo: "Inventario", detalle: "Existencias, lotes y movimientos de la bodega (propietario y administrador)" },
];

export const REPORTES: ReporteDef[] = [
  {
    id: "inventario",
    grupo: "poblacion",
    titulo: "Inventario del hato",
    detalle: "Todos los animales activos por categoría",
    modulo: "hato",
    escena: ESCENA_REPORTE.inventario,
    porEspecie: true,
    filtros: [
      filtro("categoria", "Categoría", [
        opcion("todos", "Todos", "Cada animal activo"),
        opcion("hembra_adulta", "Hembras adultas", "Ya en edad de servicio"),
        opcion("macho_adulto", "Machos adultos", "Ya en edad de servicio"),
        opcion("levante", "Levante", "Crecen hacia la edad de servicio"),
        opcion("cria", "Crías", `Hasta los ${EDAD_DESTETE_MESES} meses`),
        opcion("sin_edad", "Sin fecha", "Falta la fecha de nacimiento"),
      ]),
    ],
    ayuda: [
      { titulo: "Qué cuenta", texto: "Solo los animales activos. Los que se vendieron, murieron o se perdieron están en «Salidas del hato»." },
      { titulo: "Categorías", texto: `Cría: hasta los ${EDAD_DESTETE_MESES} meses. Levante: hasta la edad mínima de servicio de tus Ajustes. Adulta o adulto: desde esa edad. Sin fecha de nacimiento no se adivina: queda aparte para que la completes.` },
      { titulo: "Estado reproductivo y corral", texto: "Aparecen si tu rol puede ver Reproducción y Corrales. El estado sale del último servicio, diagnóstico y parto, nunca se escribe a mano." },
    ],
    vacio: { titulo: "Aún no hay animales activos", texto: "Cuando registres animales, aquí verás cuántos hay de cada categoría." },
  },
  {
    id: "salidas",
    grupo: "poblacion",
    titulo: "Salidas del hato",
    detalle: "Ventas, muertes, sacrificios y pérdidas",
    modulo: "hato",
    escena: ESCENA_REPORTE.salidas,
    periodo: { etiqueta: "Salidas del" },
    porEspecie: true,
    filtros: [
      filtro("tipo", "Tipo de salida", [
        opcion("todos", "Todas", "Cualquier salida"),
        opcion("venta", "Ventas", "Pasaron a otro dueño"),
        opcion("muerte", "Muertes", "Murieron en la finca"),
        opcion("sacrificio", "Sacrificios", "Para consumo"),
        opcion("perdida", "Pérdidas", "No se sabe dónde están"),
      ]),
    ],
    ayuda: [
      { titulo: "Qué cuenta", texto: "Cada animal que salió del hato en el periodo, con el motivo y a quién fue. La fecha es la de la salida." },
      { titulo: "Valores", texto: "El valor de cada salida solo lo ven quienes pueden ver las cuentas de la finca." },
    ],
    vacio: { titulo: "Ninguna salida en este periodo", texto: "Las ventas, muertes, sacrificios y pérdidas del hato aparecerán aquí." },
  },
  {
    id: "vacias",
    grupo: "reproduccion",
    titulo: "Hembras vacías",
    detalle: "Disponibles para el próximo servicio",
    modulo: "reproduccion",
    escena: ESCENA_REPORTE.vacias,
    porEspecie: true,
    filtros: [
      filtro("situacion", "Mostrar", [
        opcion("todos", "Todas", "Vacías y sin datos"),
        opcion("aptas", "Listas para servicio", "Edad y condición corporal al día"),
        opcion("vacia", "Vacías", "Sin servicio vigente"),
        opcion("sin_datos", "Sin datos", "Nunca se les registró nada"),
      ]),
    ],
    ayuda: [
      { titulo: "Quién sale aquí", texto: `Hembras activas sin servicio vigente (vacías) o de las que no hay ningún dato reproductivo. Las crías de menos de ${EDAD_DESTETE_MESES} meses no se listan.` },
      { titulo: "Lista para servicio", texto: "Tiene la edad mínima y, si está pesada, la condición corporal mínima que definiste en Ajustes de la finca. Si no se pesó, solo se revisa la edad." },
      { titulo: "Días abiertos", texto: "Días desde el último parto sin quedar servida de nuevo. Mientras más largo, más cuesta el intervalo entre partos." },
    ],
    vacio: { titulo: "No hay hembras disponibles", texto: "Las hembras sin servicio vigente aparecerán aquí, con los días que llevan abiertas." },
  },
  {
    id: "por_palpar",
    grupo: "reproduccion",
    titulo: "Por palpar",
    detalle: "Servidas sin diagnóstico de gestación",
    modulo: "reproduccion",
    escena: ESCENA_REPORTE.por_palpar,
    porEspecie: true,
    filtros: [
      filtro("momento", "Momento", [
        opcion("todos", "Todas", "Servidas y dudosas"),
        opcion("toca", "Ya toca", "Dentro de la ventana o atrasadas"),
        opcion("pronto", "Aún no", "Todavía es temprano"),
        opcion("repetir", "Repetir", "Su diagnóstico fue dudoso"),
      ]),
    ],
    ayuda: [
      { titulo: "Ventana del diagnóstico", texto: "Depende del método, por eso la fijas en Ajustes de la finca: desde qué día después del servicio se diagnostica y hasta cuál se considera atrasado." },
      { titulo: "Diagnóstico dudoso", texto: `Queda en observación: se repite entre ${DIAS_REPETIR_DX_DESDE} y ${DIAS_REPETIR_DX_HASTA} días después.` },
    ],
    vacio: { titulo: "Nada por diagnosticar", texto: "Cuando sirvas a una hembra, aquí verás cuándo toca confirmar si quedó gestante." },
  },
  {
    id: "gestantes",
    grupo: "reproduccion",
    titulo: "Gestantes y partos",
    detalle: "Quién pare y cuándo, con crías esperadas",
    modulo: "reproduccion",
    escena: ESCENA_REPORTE.gestantes,
    porEspecie: true,
    filtros: [
      filtro("ventana", "Mostrar", [
        opcion("todos", "Todas", "Gestantes confirmadas"),
        opcion("proximos", "Pronto", `Paren en los próximos ${DIAS_PARTO_PROXIMO} días`),
        opcion("atrasadas", "Atrasadas", "Pasaron la fecha prevista"),
        opcion("ultimo_tercio", "Último tercio", "Conviene reforzar la alimentación"),
        opcion("por_secar", "Por secar", "En ordeño y cerca del parto"),
      ]),
    ],
    ayuda: [
      { titulo: "Quién sale aquí", texto: "Hembras con la gestación confirmada. Las que solo están servidas y falta diagnosticar están en «Por palpar»." },
      { titulo: "Crías esperadas", texto: "Salen del número de fetos de la ecografía. Si no se contó, se asume una cría (por eso el total es un mínimo)." },
      { titulo: "Fecha prevista", texto: "Es el día del servicio más los días de gestación de la especie (o los que fijaste en Ajustes)." },
    ],
    vacio: { titulo: "Aún no hay gestantes confirmadas", texto: "Cuando confirmes una gestación, aquí verás cuándo pare y cuántas crías se esperan." },
  },
  {
    id: "partos",
    grupo: "reproduccion",
    titulo: "Partos del periodo",
    detalle: "Crías, abortos y eficiencia reproductiva",
    modulo: "reproduccion",
    escena: ESCENA_REPORTE.partos,
    periodo: { etiqueta: "Partos del" },
    porEspecie: true,
    filtros: [
      filtro("tipo", "Tipo de evento", [
        opcion("todos", "Todos", "Partos y abortos"),
        opcion("normal", "Normales", "Sin ayuda"),
        opcion("asistido", "Asistidos", "Con ayuda"),
        opcion("cesarea", "Cesáreas", "Cirugía"),
        opcion("aborto", "Abortos", "Pérdida de la gestación"),
      ]),
    ],
    ayuda: [
      { titulo: "Prolificidad", texto: "Crías nacidas por parto; los abortos no cuentan como parto. Un valor sobre 1 significa que hay mellizos o trillizos." },
      { titulo: "Mortalidad al nacer", texto: "Crías nacidas muertas sobre todas las crías nacidas." },
      { titulo: "Tasa de abortos", texto: "Abortos sobre el total de gestaciones terminadas (partos más abortos)." },
      { titulo: "Intervalo entre partos", texto: "Días entre un parto y el anterior de la misma hembra. Se calcula con todo su historial." },
    ],
    vacio: { titulo: "Ningún parto en este periodo", texto: "Los partos y abortos que registres aparecerán aquí con sus indicadores." },
  },
  {
    id: "sementales",
    grupo: "reproduccion",
    titulo: "Rendimiento de sementales",
    detalle: "Preñez, partos y crías por reproductor",
    modulo: "reproduccion",
    escena: ESCENA_REPORTE.sementales,
    periodo: { etiqueta: "Servicios del" },
    porEspecie: true,
    filtros: [
      filtro("servicio", "Tipo de servicio", [
        opcion("todos", "Todos", "Monta, inseminación y embriones"),
        opcion("monta_natural", "Monta natural", "Con el macho"),
        opcion("inseminacion", "Inseminación", "Con semen"),
        opcion("transferencia_embrionaria", "Transferencia", "Con embriones"),
      ]),
    ],
    ayuda: [
      { titulo: "Tasa de preñez", texto: "De los servicios que ya tienen resultado, cuántos quedaron preñados. Un servicio sin diagnóstico ni parto está «pendiente» y no cuenta, para no castigar al reproductor por falta de datos." },
      { titulo: "Resultado de un servicio", texto: "Manda el parto o aborto registrado; si no hay, el último diagnóstico. Un diagnóstico dudoso deja el servicio pendiente." },
      { titulo: "Comparación por tipo", texto: "Arriba ves la tasa de preñez de la monta natural, la inseminación y la transferencia de embriones." },
    ],
    vacio: { titulo: "Ningún servicio en este periodo", texto: "Cuando registres servicios, aquí verás cómo le va a cada reproductor." },
  },
  {
    id: "ordeno",
    grupo: "produccion",
    titulo: "Ordeño y secas",
    detalle: "Hembras en ordeño o secas, con su producción",
    modulo: "leche",
    escena: ESCENA_REPORTE.ordeno,
    porEspecie: true,
    filtros: [
      filtro("situacion", "Situación", [
        opcion("todos", "Todas", "En ordeño y secas"),
        opcion("ordeno", "En ordeño", "Lactancia abierta"),
        opcion("seca", "Secas", "Sin lactancia abierta"),
        opcion("por_secar", "Por secar", "Gestantes cerca del parto"),
      ]),
    ],
    ayuda: [
      { titulo: "En ordeño o seca", texto: "En ordeño es la hembra con una lactancia abierta (sin fecha de secado). Se listan las de vocación de leche o doble propósito y las que ya tuvieron una lactancia." },
      { titulo: "Producción", texto: "Litros de los últimos 30 días, con lo descartado aparte. El promedio diario cuenta solo los días con ordeño." },
      { titulo: "Por secar", texto: "Gestante en ordeño a pocos días del parto, según los días de secado de tus Ajustes." },
    ],
    vacio: { titulo: "Aún no hay hembras de leche", texto: "Las hembras en ordeño y las secas aparecerán aquí con su producción." },
  },
  {
    id: "peso",
    grupo: "produccion",
    titulo: "Peso y condición corporal",
    detalle: "Último peso, ganancia diaria y alertas",
    modulo: "carne",
    escena: ESCENA_REPORTE.peso,
    porEspecie: true,
    filtros: [
      filtro("alerta", "Alerta", [
        opcion("todos", "Todos", "Cada animal activo"),
        opcion("cc_baja", "Flacos", `Condición corporal menor de ${coma(CC_BAJA)}`),
        opcion("cc_alta", "Engrasados", `Condición corporal mayor de ${coma(CC_ALTA)}`),
        opcion("sin_pesar", "Sin pesar", `Más de ${DIAS_SIN_PESAR} días`),
        opcion("gdp_baja", "Crecen poco", "Debajo de la ganancia mínima"),
        opcion("sin_pesaje", "Nunca pesados", "Sin ningún pesaje"),
      ]),
    ],
    ayuda: [
      { titulo: "Ganancia diaria", texto: `Entre los dos últimos pesajes, en gramos por día. Si están a menos de ${DIAS_MINIMOS_GDP} días no se calcula: un pequeño error de la báscula se vería enorme.` },
      { titulo: "Condición corporal", texto: `Escala de 1 a 5. Menos de ${coma(CC_BAJA)} es flaca y más de ${coma(CC_ALTA)} es engrasada.` },
      { titulo: "Crecen poco", texto: "Crías y animales en levante con una ganancia diaria menor que la mínima de tus Ajustes." },
    ],
    vacio: { titulo: "Aún no hay animales para mostrar", texto: "Cuando pesas a tus animales, aquí verás su peso, su ganancia diaria y su condición corporal." },
  },
  {
    id: "retiro",
    grupo: "sanidad",
    titulo: "Animales en retiro",
    detalle: "Leche o carne que aún no se pueden usar",
    modulo: "sanidad",
    escena: ESCENA_REPORTE.retiro,
    porEspecie: true,
    filtros: [
      filtro("tipo", "Retiro de", [
        opcion("todos", "Todos", "Leche o carne"),
        opcion("leche", "Leche", "No va al tanque"),
        opcion("carne", "Carne", "No sale para consumo"),
      ]),
    ],
    ayuda: [
      { titulo: "Qué es el retiro", texto: "Los días después de un tratamiento en que la leche o la carne no se pueden consumir ni vender, hasta que salga el medicamento." },
      { titulo: "De dónde sale", texto: "Del último tratamiento de cada animal con retiro vigente. Lo calcula la base de datos, no se escribe a mano." },
    ],
    vacio: { titulo: "Ningún animal en retiro", texto: "Ahora mismo toda la leche y la carne se pueden usar." },
  },
  {
    id: "sanidad",
    grupo: "sanidad",
    titulo: "Sanidad pendiente",
    detalle: "Dosis vencidas, FAMACHA, podología y pediluvio",
    modulo: "sanidad",
    escena: ESCENA_REPORTE.sanidad,
    porEspecie: true,
    filtros: [
      filtro("tipo", "Pendiente", [
        opcion("todos", "Todos", "Todo lo que toca atender"),
        opcion("dosis", "Dosis", "Vacunas y refuerzos"),
        opcion("famacha", "FAMACHA", "Anemia por parásitos"),
        opcion("podologia", "Podología", "Revisión de pezuñas"),
        opcion("pediluvio", "Pediluvio", "Baño de pezuñas"),
      ]),
    ],
    ayuda: [
      { titulo: "Dosis", texto: "Refuerzos y siguientes aplicaciones que se programaron, ordenados del más atrasado al más lejano." },
      { titulo: "FAMACHA", texto: "Animales con puntaje 3 o más en su última evaluación que aún no se desparasitaron desde entonces." },
      { titulo: "Podología y pediluvio", texto: "Animales cuya última revisión es más vieja que los días que fijaste en Ajustes de la finca (el pediluvio cambia en época de lluvia)." },
    ],
    vacio: { titulo: "Todo al día", texto: "No hay dosis vencidas, ni animales por desparasitar, ni revisiones atrasadas." },
  },
  {
    id: "inv_medicamentos",
    grupo: "inventario",
    titulo: "Existencias de medicamentos",
    detalle: "Qué queda de cada medicamento y vacuna",
    modulo: "inventario",
    soloGestion: true,
    escena: ESCENA_REPORTE.inv_medicamentos,
    porEspecie: false,
    filtros: [
      filtro("estado", "Estado", [
        opcion("todos", "Todos", "Cada producto activo"),
        opcion("atencion", "Piden atención", "Agotados, descuadrados, en el mínimo o con un lote por vencer"),
        opcion("por_contar", "Por contar", "Sin conteo de apertura"),
        opcion("al_dia", "Al día", "Con existencias suficientes"),
      ]),
    ],
    ayuda: [
      { titulo: "De dónde sale", texto: "Del conteo de apertura de cada producto más las compras y menos las aplicaciones registradas desde ese día. Lo calcula la base de datos: no se escribe a mano." },
      { titulo: "Estados", texto: `Descuadrado: se aplicó más de lo que había registrado. Agotado: no queda nada. Stock bajo: en el mínimo o por debajo. Por contar: todavía no tiene conteo de apertura. Un lote vencido o que vence en ${DIAS_AVISO_VENCIMIENTO} días o menos también pide atención.` },
      { titulo: "Unidades", texto: "Las existencias están en la unidad de la dosis del producto (ml, dosis, tableta…). Si el producto tiene presentación (por ejemplo, frasco de 100 ml), se muestra también en presentaciones." },
    ],
    vacio: { titulo: "Aún no hay productos", texto: "Cuando registres medicamentos y vacunas en Sanidad, aquí verás lo que queda de cada uno." },
  },
  {
    id: "inv_lotes",
    grupo: "inventario",
    titulo: "Lotes y vencimientos",
    detalle: "Cada lote con lo que queda y cuándo vence",
    modulo: "inventario",
    soloGestion: true,
    escena: ESCENA_REPORTE.inv_lotes,
    porEspecie: false,
    filtros: [
      filtro("vencimiento", "Vencimiento", [
        opcion("todos", "Todos", "Lotes con existencias"),
        opcion("vencido", "Vencidos", "Ya pasó su fecha"),
        opcion("por_vencer", "Por vencer", `Vencen en ${DIAS_AVISO_VENCIMIENTO} días o menos`),
        opcion("vigente", "Vigentes", "Con fecha lejana"),
        opcion("sin_fecha", "Sin fecha", "No se anotó el vencimiento"),
      ]),
    ],
    ayuda: [
      { titulo: "Qué lista", texto: "Solo los lotes con existencias, del que vence primero al que vence último. El lote y su vencimiento se anotan al comprar o al hacer el conteo de apertura." },
      { titulo: "Un lote vencido", texto: "No se debe aplicar. Sácalo de la bodega y dalo de baja desde el inventario, con el motivo «Vencido»." },
      { titulo: "Primero lo que vence", texto: "Usa primero los lotes que vencen antes: la lista ya viene en ese orden." },
    ],
    vacio: { titulo: "No hay lotes para mostrar", texto: "Cuando haya medicamentos o vacunas con existencias, aquí verás cada lote y su vencimiento." },
  },
  {
    id: "inv_mov_med",
    grupo: "inventario",
    titulo: "Movimiento de medicamentos",
    detalle: "Compras, aplicaciones y ajustes del periodo",
    modulo: "inventario",
    soloGestion: true,
    escena: ESCENA_REPORTE.inv_mov_med,
    periodo: { etiqueta: "Movimientos del" },
    porEspecie: false,
    filtros: [
      filtro("tipo", "Movimiento", [
        opcion("todos", "Todos", "Todo lo que entró y salió"),
        opcion("compra", "Compras", "Lo que entró a la bodega"),
        opcion("aplicacion", "Aplicaciones", "Lo que se aplicó a los animales"),
        opcion("ajuste", "Conteos y ajustes", "Aperturas, mermas y correcciones"),
      ]),
    ],
    ayuda: [
      { titulo: "Qué cuenta", texto: "Lo mismo que mueve las existencias: las compras con producto veterinario (suman), las aplicaciones (restan: dosis × animales × días del tratamiento) y los conteos y ajustes. Solo desde el conteo de apertura de cada producto." },
      { titulo: "Lo que no se pudo sumar", texto: "Una compra sin cantidad, o de un producto sin presentación definida, y una aplicación sin dosis aparecen sin cantidad y lo dicen: arréglalas para que el inventario cuadre." },
      { titulo: "Quién", texto: "Cada movimiento dice quién lo registró." },
    ],
    vacio: { titulo: "Sin movimientos", texto: "En este periodo no hubo compras, aplicaciones ni ajustes de medicamentos." },
  },
  {
    id: "inv_alimento",
    grupo: "inventario",
    titulo: "Existencias de alimento",
    detalle: "Qué queda y para cuántos días alcanza",
    modulo: "nutricion",
    soloGestion: true,
    escena: ESCENA_REPORTE.inv_alimento,
    porEspecie: false,
    filtros: [
      filtro("estado", "Estado", [
        opcion("todos", "Todos", "Cada alimento"),
        opcion("atencion", "Piden atención", "Agotados, descuadrados o que alcanzan poco"),
        opcion("por_contar", "Por contar", "Sin conteo de apertura"),
        opcion("al_dia", "Al día", "Alcanzan para más del plazo de aviso"),
      ]),
    ],
    ayuda: [
      { titulo: "Todo en kg", texto: "Lo que compras en bultos o pacas se pasa a kg con lo que pesa cada unidad; lo que se da de comer se anota en kg." },
      { titulo: "Para cuántos días alcanza", texto: `Existencias ÷ lo que se dio por día en los últimos ${DIAS_VENTANA_CONSUMO} días. Con menos de ${MIN_DIAS_CON_SALIDA} días con salidas anotadas no se calcula: no se inventa una cifra.` },
      { titulo: "Cuándo avisa", texto: "Ámbar si alcanza para menos de los días que fijaste en Ajustes de la finca; rojo si es menos de la mitad, si se agotó o si se dio de comer más de lo registrado." },
    ],
    vacio: { titulo: "Aún no hay alimentos", texto: "Los alimentos salen de tu catálogo de compras (concentrado, forraje, sales y suplementos, leche maternizada)." },
  },
  {
    id: "inv_mov_alimento",
    grupo: "inventario",
    titulo: "Movimiento de alimento",
    detalle: "Compras, lo que se dio de comer y ajustes",
    modulo: "nutricion",
    soloGestion: true,
    escena: ESCENA_REPORTE.inv_mov_alimento,
    periodo: { etiqueta: "Movimientos del" },
    porEspecie: false,
    filtros: [
      filtro("tipo", "Movimiento", [
        opcion("todos", "Todos", "Todo lo que entró y salió"),
        opcion("compra", "Compras", "Lo que entró a la bodega"),
        opcion("salida", "Lo que se dio", "Raciones anotadas por el equipo"),
        opcion("ajuste", "Conteos y ajustes", "Aperturas, mermas y correcciones"),
      ]),
    ],
    ayuda: [
      { titulo: "Cuánto se consumió", texto: "Las cifras de arriba suman, en kg, lo comprado, lo que se dio de comer y los ajustes del periodo; el balance es lo que cambió la bodega." },
      { titulo: "A quién se le dio", texto: "Cada salida puede decir el corral o el lote de ceba al que fue y quién la anotó." },
      { titulo: "Lo que no se pudo sumar", texto: "Una compra sin cantidad o de un alimento sin el peso de cada unidad aparece sin kg y lo dice." },
    ],
    vacio: { titulo: "Sin movimientos", texto: "En este periodo no hubo compras, raciones ni ajustes de alimento." },
  },
];

const POR_ID = new Map<ReporteId, ReporteDef>(REPORTES.map((r) => [r.id, r]));
export const esReporteId = (v: string | undefined | null): v is ReporteId => Boolean(v && POR_ID.has(v as ReporteId));
export const definicionReporte = (id: ReporteId): ReporteDef => POR_ID.get(id)!;

/** Los reportes que una persona puede abrir según los módulos que ve; los del inventario, además, solo si gestiona la finca (propietario o administrador). */
export const reportesVisibles = (puedeVer: (m: ModuloApp) => boolean, gestiona = false): ReporteDef[] => REPORTES.filter((r) => puedeVer(r.modulo) && (!r.soloGestion || gestiona));

/** Todos los filtros de un reporte, empezando por la especie (si la finca tiene las dos). */
export const filtrosDe = (def: ReporteDef, especies: Especie[]): FiltroDef[] => [...(def.porEspecie && especies.length > 1 ? [FILTRO_ESPECIE] : []), ...def.filtros];

/** Lee los filtros de la dirección: lo que no sea una opción válida vuelve a la primera (la de por defecto). */
export function leerFiltros(def: ReporteDef, especies: Especie[], params: Record<string, string | undefined>): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const f of filtrosDe(def, especies)) {
    const pedido = params[f.clave];
    valores[f.clave] = f.opciones.some((o) => o.valor === pedido) ? (pedido as string) : f.opciones[0].valor;
  }
  return valores;
}

/** Las etiquetas de los filtros que no están en su valor por defecto (para el encabezado del Excel). */
export function textoFiltros(def: ReporteDef, especies: Especie[], valores: Record<string, string>): string[] {
  return filtrosDe(def, especies)
    .filter((f) => valores[f.clave] !== f.opciones[0].valor)
    .map((f) => `${f.titulo}: ${f.opciones.find((o) => o.valor === valores[f.clave])?.etiqueta ?? ""}`);
}
