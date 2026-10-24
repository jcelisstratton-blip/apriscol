import { CUARENTENA_MIN_DIAS, CUARENTENA_RECOMENDADA_DIAS, DIAS_DESCANSO_DEFECTO, DIAS_OCUPACION_DEFECTO } from "@/lib/corrales";
import { DIAS_EDAD_FAMACHA } from "@/lib/famacha";
import { MAX_FILAS_IMPORTAR } from "@/lib/importar-animales";
import { textoPlazo, type AjustesFinca } from "@/lib/ajustes";

/** Una idea de la hoja «¿Cómo funciona?»: un título corto y una sola frase. */
export type PuntoAyuda = { titulo: string; texto: string };
export type Ayuda = { titulo: string; puntos: PuntoAyuda[]; enlace: { href: string; texto: string } };

const meses = (dias: number) => Math.round(dias / 30);

/**
 * Lo que explica cada vista de trabajo del Hato. Los números salen de las mismas constantes que usa la app, para que la ayuda no diga una
 * cosa y el sistema haga otra. Corto a propósito: lo demás está junto a cada campo.
 */
export const AYUDA_CORRALES: Ayuda = {
  titulo: "Corrales y potreros",
  puntos: [
    { titulo: "Instalaciones", texto: "Crea tus corrales y potreros y dile a la app cuántos animales caben en cada uno." },
    { titulo: "Cupo", texto: "Si un corral está lleno, la app no deja meter más animales: así se evita el hacinamiento, que causa estrés, peleas y enfermedades." },
    { titulo: "Mover", texto: "Mueve uno, varios o todo un lote. Cada animal guarda por dónde ha pasado, y si te equivocas puedes corregir el movimiento." },
    {
      titulo: "Rotación de potreros",
      texto: `El lote debe salir a los ${DIAS_OCUPACION_DEFECTO} días y el potrero descansa ${DIAS_DESCANSO_DEFECTO}: así los parásitos no completan su ciclo. Puedes cambiar esos días en cada potrero.`,
    },
    { titulo: "Cuarentena", texto: `Todo animal que llega pasa ${CUARENTENA_MIN_DIAS} a ${CUARENTENA_RECOMENDADA_DIAS} días aislado antes de unirse al lote. La app avisa a los que no la hicieron.` },
  ],
  enlace: { href: "/corrales", texto: "Ver el resumen de toda la finca" },
};

/** Cargar animales desde Excel: el tope sale de la misma constante que usa la validación. */
export const AYUDA_IMPORTAR: Ayuda = {
  titulo: "Cargar animales desde Excel",
  puntos: [
    { titulo: "La plantilla", texto: `Descárgala, escribe un animal por fila (hasta ${MAX_FILAS_IMPORTAR} por archivo) y súbela. Los desplegables te ayudan con la especie, el sexo y la raza.` },
    { titulo: "Genealogía", texto: "Escribe el arete del padre y de la madre. Pueden ser animales del mismo archivo (el orden de las filas no importa) o animales que ya están en tu hato." },
    { titulo: "Padres de fuera", texto: "Si el padre o la madre no son tuyos, escribe su nombre o registro en las columnas «si no está en tu hato»." },
    { titulo: "Partos, servicio y corral", texto: "Si tu plan lo permite, la plantilla trae columnas para los partos de cada hembra, su último servicio y preñez, y el corral o potrero donde está hoy. Así la finca arranca con su estado reproductivo y sus corrales ya armados." },
    { titulo: "Revisión", texto: "Antes de guardar ves cada fila. Si algo está mal, la app dice la fila y qué corregir; mientras haya errores no se guarda nada." },
    { titulo: "Solo animales nuevos", texto: "Un arete que ya existe en tu finca se rechaza: este cargue crea animales, no cambia los que ya tienes." },
  ],
  enlace: { href: "/hato", texto: "Volver al hato" },
};

/** La ayuda de Sanidad: los tiempos de pezuñas y pediluvio son los que definió el propietario en los ajustes de la finca. */
export const ayudaSanidad = (a: Pick<AjustesFinca, "podologia_inspeccion_dias" | "pediluvio_dias" | "pediluvio_dias_lluvia">): Ayuda => ({
  titulo: "Sanidad del hato",
  puntos: [
    { titulo: "Programar y aplicar", texto: "Programa una vacuna, desparasitación, tratamiento o pediluvio para los animales que aplican; cuando llega el día lo aplicas y queda en el historial de cada uno." },
    { titulo: "Retiro", texto: "Si un producto tiene días de retiro, la leche y la carne de ese animal no se pueden vender hasta que pasen." },
    {
      titulo: "FAMACHA",
      texto: `Se evalúa el color del párpado de los animales de más de ${meses(DIAS_EDAD_FAMACHA)} meses. 1 y 2: sin anemia. 3: vigílalo. 4 y 5: desparasítalo. Así solo tratas a quien lo necesita.`,
    },
    {
      titulo: "Pezuñas",
      texto: `Revisa las pezuñas cada ${textoPlazo(a.podologia_inspeccion_dias)} (podología) y usa pediluvio con sulfato de cobre o de zinc cada ${textoPlazo(a.pediluvio_dias)}, y cada ${textoPlazo(a.pediluvio_dias_lluvia)} en épocas de lluvia.`,
    },
  ],
  enlace: { href: "/sanidad", texto: "Ver el resumen de toda la finca" },
});

export const AYUDA_EMPADRONAMIENTO: Ayuda = {
  titulo: "Temporada de monta",
  puntos: [
    { titulo: "Temporada", texto: "Reúne a los sementales y a las hembras que se montan en un periodo, con su fecha de inicio y de cierre prevista." },
    { titulo: "Sementales", texto: "Cada semental tiene su número de hembras. Pueden ser tuyos o prestados de otro hato." },
    { titulo: "Hembras libres", texto: "Solo entran hembras sin gestación, sin servicio esperando diagnóstico y fuera de otra temporada abierta." },
    { titulo: "Endogamia", texto: "La app calcula la endogamia de cada pareja antes de confirmarla. Si llega al umbral, solo entra como excepción registrada." },
    { titulo: "Cierre", texto: "Al cerrar la temporada cada hembra queda servida, y de ahí se sigue su gestación y su parto." },
  ],
  enlace: { href: "/reproduccion?vista=empadronamiento", texto: "Ver todas las temporadas" },
};

export const AYUDA_CEBA: Ayuda = {
  titulo: "Ceba",
  puntos: [
    { titulo: "Candidatos", texto: "La app te sugiere a quién pasar a ceba según las reglas de tu finca; tú decides." },
    { titulo: "Lotes", texto: "Agrupa los animales en engorde en lotes, cada uno con su meta de peso." },
    { titulo: "Pesos", texto: "Pésalos seguido: la app calcula la ganancia por día y cuánto falta para la meta." },
    { titulo: "Salida", texto: "Al sacrificar o vender un animal, registra su salida y su canal: así queda el rendimiento." },
  ],
  enlace: { href: "/carne", texto: "Ver el resumen de carne" },
};

export const AYUDA_ORDENO: Ayuda = {
  titulo: "Ordeño",
  puntos: [
    { titulo: "Registrar", texto: "Anota los litros de cada animal en cada jornada; el total del día se suma solo." },
    { titulo: "Turnos", texto: "Programa qué hembras se ordeñan y en qué turno, para que el registro salga rápido." },
    { titulo: "Retiro", texto: "Si un animal está en retiro por un tratamiento, su leche se marca como descartada y no entra al tanque." },
    { titulo: "Calidad", texto: "Guarda los análisis de la leche (grasa, proteína, células) de un animal o del tanque." },
  ],
  enlace: { href: "/leche", texto: "Ver la producción de la finca" },
};

export const AYUDA_GASTOS: Ayuda = {
  titulo: "Compras del aprisco",
  puntos: [
    { titulo: "Elegir, no escribir", texto: "Escoges qué compraste de la lista de productos de tu finca y a quién; solo escribes la cantidad. El precio de la última vez ya viene puesto." },
    { titulo: "A quién se carga", texto: "A toda la finca, a una especie, a un corral, a un lote o a un animal. Así sabes cuánto cuesta cada animal y cada litro." },
    { titulo: "Lo que ya registraste", texto: "El costo de cada tratamiento (Sanidad), el alimento de la ceba y la compra de cada animal comprado se suman solos. Si registras aquí el mismo alimento o medicina, el resumen de Costos te avisa para que no se cuente dos veces." },
    { titulo: "Por pagar", texto: "Si lo compraste a crédito, deja la fecha de vencimiento: te avisamos en Hoy cuando se pase y lo marcas pagado con un toque." },
    { titulo: "Tu lista", texto: "Si algo que compras no está en la lista, elige «Otra compra» o agrégalo a tus productos en Más → Productos y terceros." },
  ],
  enlace: { href: "/costos?vista=compras", texto: "Ver las compras de toda la finca" },
};

export const AYUDA_VENTAS: Ayuda = {
  titulo: "Ventas del aprisco",
  puntos: [
    { titulo: "Lo que entra solo", texto: "La leche que despachas con precio y los animales que vendes o sacrificas aparecen aquí sin escribirlos de nuevo." },
    { titulo: "Lo que registras tú", texto: "Carne, queso, abono, lana y demás: eliges el producto y el comprador, escribes la cantidad y el precio de la última vez ya viene puesto." },
    { titulo: "Por cobrar", texto: "Si te lo deben, déjalo «por cobrar» con la fecha en que lo esperas. Cuando te paguen, lo marcas cobrado con un toque." },
    { titulo: "Tu lista", texto: "Los productos y compradores se manejan en Más → Productos y terceros." },
  ],
  enlace: { href: "/costos?vista=ventas", texto: "Ver las ventas de toda la finca" },
};

export const AYUDA_PERSONAL: Ayuda = {
  titulo: "Personal y pagos",
  puntos: [
    { titulo: "Cada persona, una vez", texto: "En Equipo agregas a alguien: eliges su perfil y, ahí mismo, su contrato (trabajo o prestación de servicios) y lo que se le paga: salario, jornal o valor por servicio. Quien no usa la app queda «sin acceso»." },
    { titulo: "El pago se calcula solo", texto: "Eliges a la persona y escribes cuántos meses, días o servicios se pagan: el valor viene de su contrato." },
    { titulo: "Lo que cuesta de verdad", texto: "Con contrato de trabajo, el costo suma las cargas de ley con el factor prestacional que defines en Ajustes. Por prestación de servicios cuesta lo que se le paga." },
    { titulo: "Seguridad social", texto: "A quien trabaja por prestación de servicios se le adjunta el comprobante de pago de su seguridad social (PILA) para registrar el pago como hecho." },
    { titulo: "Aparte de las compras", texto: "La mano de obra se suma en Costos como «Mano de obra», separada de lo que compras." },
  ],
  enlace: { href: "/mas/ajustes", texto: "Ver el factor prestacional en Ajustes" },
};

export const AYUDA_COSTOS: Ayuda = {
  titulo: "Cómo leer las cuentas",
  puntos: [
    { titulo: "Compras y ventas, separadas", texto: "Compras es lo que pagas; ventas es lo que cobras; la mano de obra se cuenta aparte. El resultado es lo vendido menos todo lo que costó." },
    { titulo: "Fechas", texto: "Todo el resumen y cada reporte usan el periodo que elijas: un año, unos meses o cualquier rango entre dos fechas." },
    { titulo: "Lo que cuesta", texto: "Suma las compras registradas, el costo de los tratamientos, el alimento de la ceba y la compra de animales." },
    { titulo: "Costo por litro", texto: "Es el costo total del periodo dividido entre los litros que se registraron en el ordeño." },
    { titulo: "Costo por animal", texto: "Suma lo cargado al animal y su parte de lo cargado a su lote, su corral o su especie. Lo de toda la finca no se reparte; la compra del animal se muestra aparte." },
    { titulo: "Saca y mortalidad", texto: "Compara lo que costó cada animal con lo que se recibió al venderlo, o lo perdido si murió. Pide el valor de compra en la ficha." },
  ],
  enlace: { href: "/hato?vista=gastos", texto: "Registrar compras" },
};

export const AYUDA_PROYECCIONES: Ayuda = {
  titulo: "Cómo funcionan las proyecciones",
  puntos: [
    { titulo: "Parte de tu hato de hoy", texto: "Cuenta tus reproductoras, tus sementales y tus crías por edad, y usa las fechas previstas de parto que ya registraste para los primeros meses." },
    { titulo: "De dónde sale cada número", texto: "«De tu finca» es un promedio de tus propios registros (verás de cuántos). «Referencia» es un valor típico mientras tu finca no tiene datos suficientes. «Tu ajuste» es el que cambiaste tú." },
    { titulo: "Cámbialos y mira qué pasa", texto: "En «Supuestos» puedes cambiar cualquier número y todo se recalcula al instante. Guarda tus ajustes para verlos la próxima vez." },
    { titulo: "Carne y leche, por separado", texto: "Elige «Carne» o «Leche» arriba para mirar cada una sola, o «Todo» para el resultado completo con todos los costos." },
    { titulo: "Escenarios y comparación", texto: "Guarda hasta 10 escenarios («con más hembras», «si baja el precio») y compáralos de a tres en «Comparar»: lo mejor de cada cifra va marcado." },
    { titulo: "Qué tan firme es", texto: "«Riesgos» dice desde qué precio pierdes dinero, qué número mueve más tu resultado (un 10 % arriba o abajo) y qué pasa si todo sale peor o mejor de lo esperado." },
    { titulo: "Es una estimación, no una promesa", texto: "El simulador no sabe de sequías, enfermedades ni cambios del mercado. Úsalo para comparar caminos y detectar problemas a tiempo (falta de espacio, de reemplazos o de caja)." },
  ],
  enlace: { href: "/mas/ajustes", texto: "Ajustes de la finca" },
};
