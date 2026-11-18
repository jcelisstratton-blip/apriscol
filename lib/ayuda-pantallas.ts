import type { Ayuda } from "@/lib/ayuda";
import type { RolFinca } from "@/lib/tipos";
import { DIAS_ENLACE_ARCHIVO } from "@/lib/exportar-finca";
import { DESCUENTO_ANUAL, DESCUENTO_FINCA_ADICIONAL } from "@/lib/planes";

/**
 * El «¿Cómo funciona?» de cada opción del menú (decisión del dueño del producto, 18 nov 2026): toda pantalla del menú explica para qué sirve,
 * cómo se usa, qué se puede hacer y adónde ir después, con su tarjeta «Míralo en video» y un enlace final que lleva a OTRA pantalla útil
 * (nunca a la misma donde se abre: no haría nada). La clave es la ruta de la opción en `lib/menu.ts`; `tests/ayuda-pantallas.test.mjs` exige que
 * toda opción del menú tenga la suya (o esté en `SIN_AYUDA_PROPIA` con su razón) y que cada enlace lleve a una pantalla que existe.
 * Textos cortos: cuatro o cinco ideas de una frase. Los números que la app usa (descuentos, días) salen de sus constantes.
 */
export const AYUDA_PANTALLA: Record<string, Ayuda> = {
  "/": {
    titulo: "Hoy",
    tutorial: 3,
    puntos: [
      { titulo: "Para qué sirve", texto: "Hoy es tu punto de partida: reúne lo que toca atender en la finca este día, para que no tengas que acordarte ni revisar cuaderno por cuaderno." },
      { titulo: "Qué ves", texto: "Tarjetas con lo del día: partos que se acercan, dosis por aplicar, animales en periodo de retiro, cuentas vencidas y, si te toca revisarlas, las novedades nuevas del equipo. Cada una dice qué hacer y te lleva al animal o al registro." },
      { titulo: "Cada quien lo suyo", texto: "Cada persona ve solo lo que le toca según su rol (propietario, administrador, ordeñador, veterinario, contador) y lo que incluye el plan de la finca." },
      { titulo: "Si es tu primer día", texto: "Si aún no tienes animales, Hoy te propone empezar por el hato: registrar uno por uno o traer tu Excel." },
      { titulo: "Sin abrir la app", texto: "Puedes recibir este mismo resumen cada mañana en Telegram, a la hora que elijas." },
    ],
    enlace: { href: "/semaforos", texto: "Ver todo lo que pide atención, por colores" },
  },

  "/novedades": {
    titulo: "Novedades",
    tutorial: 16,
    puntos: [
      { titulo: "Qué es una novedad", texto: "Un aviso corto de una persona del equipo a quien debe actuar. Por ejemplo: el veterinario ve que se acabó un medicamento y lo reporta, o el ordeñador pide que a una cabra se le aplique una dosis. No es un registro: no genera costos, retiros ni historial." },
      { titulo: "Dos tipos", texto: "«Comprar» avisa que falta algo en la finca (un medicamento, alimento, un insumo) y le llega al administrador. «Aplicar dosis» pide una aplicación a un animal y le llega al veterinario. El propietario recibe las dos." },
      { titulo: "Cada perfil reporta lo suyo", texto: "El ordeñador puede avisar que hay que comprar algo o aplicar una dosis. El veterinario avisa lo que hay que comprar. Se elige con opciones, casi sin escribir, y cada novedad queda con el nombre de quien la envió." },
      { titulo: "Vista y atendida", texto: "Quien las recibe marca «Vista» cuando ya la leyó y «Atendida» cuando hizo lo que pedía. Cada persona solo marca las que le tocan a su perfil." },
      { titulo: "Atender de verdad", texto: "La novedad no reemplaza el registro: para atender una de «Comprar», registra la compra; para una de «Aplicar dosis», registra la aplicación en Sanidad." },
    ],
    // El enlace de abajo depende del perfil (ver `enlaceNovedades`): este es el de quien recibe las de comprar.
    enlace: { href: "/hato?vista=gastos", texto: "Registrar una compra" },
  },

  "/semaforos": {
    titulo: "Semáforos",
    tutorial: 4,
    puntos: [
      { titulo: "Los tres colores", texto: "Rojo: actúa hoy. Ámbar: programa una acción, se viene pronto. Verde: todo en orden. Significan lo mismo en toda la app." },
      { titulo: "Por áreas", texto: "Partos, sanidad, leche, ceba, esquila, corrales, bodega y cuentas. Cada persona ve las de su rol y las que incluye el plan de la finca." },
      { titulo: "Toca una tarjeta", texto: "Se abre qué significa, la regla que lo dispara, los animales o productos afectados y qué hacer. Desde ahí vas directo al animal o al registro donde se resuelve." },
      { titulo: "Varios casos", texto: "Si una señal tiene muchos casos, puedes recorrerlos uno por uno con «Siguiente» y volver a la lista cuando termines." },
      { titulo: "Tus plazos", texto: "Los avisos usan los plazos que tú definiste en Ajustes de la finca. Si cambias un plazo, los semáforos se ajustan solos." },
    ],
    enlace: { href: "/mas/ajustes", texto: "Cambiar los plazos de los avisos en Ajustes" },
  },

  "/hato": {
    titulo: "Hato",
    tutorial: 27,
    puntos: [
      { titulo: "Tu lista de animales", texto: "Aquí está todo el hato. Filtra con las tarjetas (hembras, machos, en ordeño, dados de baja…) y busca por arete o por nombre." },
      { titulo: "La ficha", texto: "Toca un animal y ves toda su historia: datos, padres, peso, leche, partos, sanidad, esquila (si es oveja) y costos." },
      { titulo: "Vistas de trabajo", texto: "Arriba pasas de la lista a ordeño, ceba, empadre, sanidad, corrales, compras y ventas. Cada una trae su propio «¿Cómo funciona?»." },
      { titulo: "Agregar animales", texto: "Registra uno por uno, o trae tu Excel con el asistente: reconoce tus columnas, te muestra qué va a cambiar y puedes deshacer." },
      { titulo: "Dados de baja", texto: "Cuando un animal se vende, muere o sale, se da de baja: deja de contar en el hato activo, pero su historia se conserva." },
    ],
    enlace: { href: "/hato/endogamia", texto: "Ver el parentesco de mis animales (endogamia)" },
  },

  "/leche": {
    titulo: "Leche de toda la finca",
    tutorial: 17,
    puntos: [
      { titulo: "Para qué sirve", texto: "Es la vista de toda la finca: cuánta leche produces y cómo va su calidad, a dónde se despacha y cómo está el frío. El ordeño de cada jornada se anota aparte, en Hato → Ordeño." },
      { titulo: "Calidad", texto: "Grasa, proteína y células somáticas de cada análisis, comparados con los rangos de tu finca. Sirve para detectar a tiempo un problema de sanidad o de manejo." },
      { titulo: "Despachos", texto: "A qué comprador fue la leche, cuántos litros y cuánto te deben. Así sabes lo que ya cobraste y lo que falta, con sus controles." },
      { titulo: "Frío y equipo", texto: "La temperatura del tanque y el estado de tus equipos de ordeño y enfriamiento: la cadena de frío que cuida la calidad hasta que sale la leche." },
      { titulo: "Producción", texto: "Los litros por día y por animal que sumó lo que registraste en el ordeño. Si falta una jornada, aparece como pendiente." },
    ],
    enlace: { href: "/hato?vista=ordeno", texto: "Registrar el ordeño de hoy en el Hato" },
  },

  "/reproduccion": {
    titulo: "Reproducción",
    tutorial: 11,
    puntos: [
      { titulo: "Resumen", texto: "Las gestaciones en curso y los partos que se acercan. La app calcula la fecha prevista con los días de gestación de tu finca." },
      { titulo: "Empadre", texto: "Las temporadas de monta: qué hembras entran, con qué macho y cuánto dura. Antes de cruzar, puedes ver la endogamia de la pareja." },
      { titulo: "Servicios", texto: "Cada monta o inseminación, y después el diagnóstico de gestación: así se sabe quién quedó preñada, quién repite y a quién hay que revisar." },
      { titulo: "Partos", texto: "El parto con sus crías y la lactancia que empieza. Las crías quedan registradas con su madre y su padre." },
      { titulo: "Avisos", texto: "Los partos próximos y los diagnósticos pendientes aparecen en Semáforos, en Hoy y en Telegram, con los plazos de tus Ajustes." },
    ],
    enlace: { href: "/hato?vista=empadronamiento", texto: "Armar una temporada de monta" },
  },

  "/carne": {
    titulo: "Carne y ceba",
    tutorial: 14,
    puntos: [
      { titulo: "Resumen", texto: "Cómo va el engorde de la finca: cuántos animales hay en ceba, su peso y cuáles están cerca de salir." },
      { titulo: "Candidatos", texto: "Los animales que cumplen tus reglas para pasar a ceba. Tú decides cuáles entran." },
      { titulo: "Lotes y pesos", texto: "Agrupa los animales en lotes y pésalos cada cierto tiempo: la app calcula la ganancia de peso por día de cada uno." },
      { titulo: "Canales y salidas", texto: "Anota el rendimiento de la canal cuando se sacrifica y registra la venta o la salida de cada animal." },
      { titulo: "Reglas", texto: "En la pestaña «Reglas» defines con qué criterios la app propone un animal para ceba. Son tus reglas, no las nuestras." },
    ],
    enlace: { href: "/hato?vista=ceba", texto: "Pesar y manejar la ceba en el Hato" },
  },

  "/sanidad": {
    titulo: "Sanidad",
    tutorial: 12,
    puntos: [
      { titulo: "Resumen e historial", texto: "Lo que ya se aplicó y lo que está por atender. El historial guarda cada vacuna, desparasitación o tratamiento de toda la finca." },
      { titulo: "Productos", texto: "Tu catálogo veterinario. Cada producto lleva su periodo de retiro: cuántos días después de aplicarlo la leche o la carne no se pueden usar." },
      { titulo: "Periodo de retiro", texto: "La app lo calcula sola y te dice qué animales no pueden mandar leche al tanque ni salir para carne, para que no corras ese riesgo." },
      { titulo: "Pruebas y coprológicos", texto: "Los diagnósticos del hato y los exámenes de huevos de parásitos en heces. Con ellos decides a quién desparasitar y a quién no." },
      { titulo: "Programar", texto: "Puedes dejar una aplicación programada: cuando llega la fecha aparece como «dosis por aplicar» en Hoy y en Semáforos." },
    ],
    enlace: { href: "/hato?vista=sanidad", texto: "Registrar una vacuna o un tratamiento" },
  },

  "/corrales": {
    titulo: "Corrales",
    tutorial: 13,
    puntos: [
      { titulo: "Resumen", texto: "Qué tan lleno está cada corral o potrero y las alertas: sobrecupo, mezcla de edades, rotación vencida o cuarentena sin hacer." },
      { titulo: "Movimientos", texto: "Por dónde ha pasado cada animal: cuándo entró a un corral y cuándo salió." },
      { titulo: "Crear y mover", texto: "Los corrales se crean y los animales se mueven en Hato → Corrales: uno, varios o un lote completo." },
      { titulo: "Cupo y rotación", texto: "Si un corral está lleno, la app no deja meter más animales. En los potreros avisa cuándo el lote debe salir y cuántos días descansa el potrero." },
    ],
    enlace: { href: "/hato?vista=corrales", texto: "Crear corrales y mover animales" },
  },


  "/reportes": {
    titulo: "Reportes",
    tutorial: 20,
    puntos: [
      { titulo: "Para qué sirven", texto: "Son listados de toda la finca para decidir: quién está vacía, quién pare esta semana, qué reproductor rinde, qué sanidad está pendiente." },
      { titulo: "Por áreas", texto: "Elige un área (población, reproducción, producción, sanidad, inventario) y luego el reporte. Cada tarjeta lleva directo a su lista." },
      { titulo: "Filtros", texto: "Cada reporte se filtra por especie o por fechas. El filtro queda en la dirección: puedes compartirla o recargar la página." },
      { titulo: "Cada fila", texto: "Toca el arete de un animal para abrir su ficha. Cada fila muestra solo los datos que aplican a ese registro." },
      { titulo: "Excel", texto: "El botón de Excel baja el reporte con todas las columnas, no solo las que ves en pantalla." },
    ],
    enlace: { href: "/hato", texto: "Ir al Hato, donde se registra lo que alimenta los reportes" },
  },



  "/mas/productos": {
    titulo: "Productos y terceros",
    tutorial: 9,
    puntos: [
      { titulo: "Tu lista, una sola vez", texto: "Aquí guardas lo que compras, lo que vendes y las personas con las que haces negocio. Después solo los eliges al registrar." },
      { titulo: "Lo que compras", texto: "Concentrado, medicamentos, insumos… agrupados por rubro. Eso permite saber cuánto gastas en cada cosa." },
      { titulo: "Lo que vendes", texto: "Leche, animales, lana… con su unidad de medida." },
      { titulo: "Proveedores y compradores", texto: "Los terceros te dicen a quién le compras, a quién le vendes y cuánto te deben o debes." },
    ],
    enlace: { href: "/hato?vista=gastos", texto: "Registrar una compra con tus productos" },
  },

  "/hato/endogamia": {
    titulo: "Endogamia",
    tutorial: 18,
    puntos: [
      { titulo: "Qué es", texto: "Qué tan emparentados están el padre y la madre de un animal. Si lo están mucho, sus crías pueden salir débiles o con defectos." },
      { titulo: "Qué ves", texto: "Todos los animales con su nivel de endogamia (aceptable, para vigilar, alto o muy alto), ordenados para que veas primero los más delicados." },
      { titulo: "Tu umbral", texto: "Tú defines el umbral desde el que te preocupa. La app marca como «sobre el umbral» lo que lo supere." },
      { titulo: "Pedigrí", texto: "Para calcularla hay que registrar el padre y la madre de cada animal. Sin ellos, no hay nada que medir." },
      { titulo: "Antes de cruzar", texto: "En «Simular una cruza» pruebas una pareja y ves la endogamia de sus crías antes de montarla." },
    ],
    enlace: { href: "/hato/cruza", texto: "Simular una cruza antes de montarla" },
  },

  "/ferias": {
    titulo: "Premios y ferias",
    tutorial: 19,
    puntos: [
      { titulo: "Premios", texto: "Lo que han ganado tus animales y en qué feria lo ganaron." },
      { titulo: "Ferias", texto: "Las ferias en las que participaste y dónde fueron." },
      { titulo: "Dónde se registra", texto: "El premio de un animal se registra en su ficha, no en esta pantalla. Esta es la vista de toda la finca." },
    ],
    enlace: { href: "/hato", texto: "Abrir el hato para registrar el premio en la ficha de un animal" },
  },

  "/mas/finca": {
    titulo: "Datos de la finca",
    tutorial: 22,
    puntos: [
      { titulo: "Quién eres", texto: "El nombre de la finca y dónde queda: país, departamento, municipio y vereda. El país y la moneda definen cómo se muestran los valores de dinero." },
      { titulo: "Propósito", texto: "Para qué la usas: leche, carne o doble propósito." },
      { titulo: "Especies", texto: "Si tienes cabras, ovejas o las dos. Una especie con animales registrados no se puede quitar." },
      { titulo: "Si tienes ovejas", texto: "Aparecen la Esquila en el menú y los ajustes de esquila." },
    ],
    enlace: { href: "/mas/ajustes", texto: "Ajustar los criterios de la finca" },
  },

  "/mas/ajustes": {
    titulo: "Ajustes de la finca",
    tutorial: 22,
    puntos: [
      { titulo: "Para qué sirven", texto: "Aquí defines los tiempos y criterios de tu finca: edad de servicio, días de gestación, ceba, leche, pezuñas, pediluvio, esquila y más." },
      { titulo: "Por qué importan", texto: "La app avisa con lo que tú definiste, no con números ajenos. Si cambias un plazo, los semáforos, Hoy y Telegram se ajustan solos." },
      { titulo: "Por grupo", texto: "Cada grupo (reproducción, ceba, leche, sanidad, esquila…) tiene su propio formulario y se guarda por separado." },
      { titulo: "Valores sugeridos", texto: "En cada grupo, «Volver a los valores sugeridos» devuelve los números de fábrica." },
      { titulo: "Quién cambia", texto: "Todo el equipo puede verlos; solo el propietario los cambia." },
    ],
    enlace: { href: "/semaforos", texto: "Ver cómo se aplican en los semáforos" },
  },

  "/mas/miembros": {
    titulo: "Equipo y roles",
    tutorial: 21,
    puntos: [
      { titulo: "Para qué sirve", texto: "Aquí manejas a las personas que trabajan contigo: quién entra a la app con su propio usuario, con qué perfil, y a quién le pagas. Los pagos están en la pestaña «Pagos»." },
      { titulo: "Cada perfil ve lo suyo", texto: "El propietario y el administrador ven y manejan todo. El ordeñador ve la leche y el alimento, el veterinario sanidad y corrales, y el contador las cuentas. Nadie ve lo que no le toca." },
      { titulo: "Invitar a alguien", texto: "Escribe el correo de la persona y elige su perfil: se crea un enlace de invitación que le mandas. Al abrirlo, la persona entra con su propio usuario. Mientras no la acepte, la invitación queda en «Invitaciones pendientes». Invitar al equipo viene desde el plan Hato." },
      { titulo: "Avisos por Telegram", texto: "El propietario y el administrador definen qué avisos recibe cada persona y a qué hora, según su perfil." },
      { titulo: "Contrato y pagos", texto: "Al agregar a alguien puedes dejar su contrato y lo que se le paga. Cada pago que registras se suma al costo de la finca como mano de obra." },
    ],
    // El enlace de abajo depende del perfil (ver `enlaceEquipo`): este es el de quien invita.
    enlace: { href: "/mas/miembros#agregar", texto: "Ir a «Agregar a alguien»" },
  },

  "/mas/telegram": {
    titulo: "Telegram",
    tutorial: 25,
    puntos: [
      { titulo: "Qué recibes", texto: "Cada día, en tu celular, el resumen de lo que toca hacer, según tu rol y tu plan, sin abrir la app." },
      { titulo: "Conectar", texto: "Toca «Conectar Telegram»: se abre el bot con un código de un solo uso. Solo se vincula tu chat personal." },
      { titulo: "Desde el chat", texto: "Escribe /hoy cuando quieras y te responde al instante. Los botones abren el punto exacto en la app, ya con tu sesión." },
      { titulo: "Tú decides", texto: "Puedes pausar, cambiar la hora o desconectar cuando quieras. El propietario y el administrador también definen qué recibe cada persona de su equipo." },
    ],
    enlace: { href: "/semaforos", texto: "Ver lo mismo en la app" },
  },


  "/mas/tutoriales": {
    titulo: "Tutoriales",
    tutorial: 0,
    puntos: [
      { titulo: "Para qué sirven", texto: "Videos cortos, paso a paso, de cada parte de Apriscol, con ejemplos de una finca real." },
      { titulo: "En orden o por tema", texto: "Puedes verlos en el orden recomendado o buscar el tema que necesitas. Cada pantalla de la app trae su tarjeta «Míralo en video»." },
      { titulo: "Tu avance", texto: "Apriscol recuerda cuáles ya viste y te propone el siguiente." },
      { titulo: "Sin salir de la app", texto: "El video se abre aquí mismo. También puedes verlo en YouTube y encontrar toda la serie en la lista del canal." },
    ],
    enlace: { href: "/", texto: "Volver a Hoy" },
  },

  "/mas/plan": {
    titulo: "Plan de esta finca",
    tutorial: 26,
    puntos: [
      { titulo: "Un plan por finca", texto: "Cada finca tiene su propio plan y su propio pago. Pagas por los servicios que usas, no por cuántos animales tienes." },
      { titulo: "Precios", texto: `Los precios son en dólares por mes, con su equivalente en pesos a la TRM del día. Pagando por año hay ${Math.round(DESCUENTO_ANUAL * 100)} % de descuento, y desde la segunda finca, ${Math.round(DESCUENTO_FINCA_ADICIONAL * 100)} % menos.` },
      { titulo: "Cambiar de plan", texto: "Elige el plan y el periodo, paga por Nequi y toca «Ya pagué». El equipo de Apriscol confirma el pago y activa el plan." },
      { titulo: "Vigencia", texto: "Te avisamos 7 días antes de que venza. Si vence, por unos días la finca queda en solo lectura. Tus datos se conservan y siempre puedes descargarlos en Excel." },
    ],
    enlace: { href: "/mas/exportar", texto: "Descargar mis datos en Excel" },
  },

  "/mas/exportar": {
    titulo: "Exportar los datos",
    tutorial: 22,
    puntos: [
      { titulo: "Tus datos son tuyos", texto: "Un solo archivo de Excel con todo lo de tu finca: animales y genealogía, reproducción, leche, sanidad, compras, ventas, personal, corrales y ajustes. Cada tema va en su hoja." },
      { titulo: "Para llevarlo a otra finca", texto: "La hoja «Animales» tiene el mismo formato de la plantilla de cargue, así que sirve para traer el hato a otra finca." },
      { titulo: "Fotos y documentos", texto: `Van como enlaces que funcionan ${DIAS_ENLACE_ARCHIVO} días: descárgalos antes de que venzan.` },
      { titulo: "Si hay muchos registros", texto: "El archivo puede tardar unos segundos en prepararse." },
    ],
    enlace: { href: "/hato/importar", texto: "Cargar datos desde Excel" },
  },
};

/**
 * El enlace final de la ayuda de Novedades según el perfil: cada quien va a lo que SÍ puede hacer ahí. Quien reporta (ordeñador, veterinario) va a
 * crear una novedad; quien atiende las de comprar (administrador, propietario) va a registrar la compra. El veterinario, que también atiende
 * las de aplicar dosis, tiene además su crear; el enlace de Sanidad lo explica el texto.
 */
export function enlaceNovedades(rol: RolFinca): { href: string; texto: string } {
  if (rol === "ordenador" || rol === "veterinario") return { href: "/novedades/nueva", texto: "Crear una novedad" };
  return AYUDA_PANTALLA["/novedades"].enlace;
}

/**
 * El enlace final de la ayuda de Equipo según el perfil: quien invita (propietario, administrador) baja al formulario «Agregar a alguien», en la
 * misma pantalla; el contador, que no invita, pasa a la pestaña «Pagos», que sí es suya.
 */
export function enlaceEquipo(rol: RolFinca): { href: string; texto: string } {
  if (rol === "contador") return { href: "/mas/miembros?vista=pagos", texto: "Ir a los pagos del personal" };
  return AYUDA_PANTALLA["/mas/miembros"].enlace;
}

/** Opciones del menú que no llevan hoja de ayuda propia, y por qué. Lo exige `tests/ayuda-pantallas.test.mjs` (nada se omite en silencio). */
export const SIN_AYUDA_PROPIA: Record<string, string> = {
  "/mas": "Es el menú «Más» del celular: la lista de las demás opciones, cada una con su propia ayuda.",
  "/mas/referidos": "Ya trae su propia tarjeta «Cómo funciona» visible en la pantalla (los términos del programa).",
  "/onboarding": "Es el asistente para crear otra finca, con sus propios pasos explicados.",
};
