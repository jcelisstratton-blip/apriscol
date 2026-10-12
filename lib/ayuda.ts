import { CUARENTENA_MIN_DIAS, CUARENTENA_RECOMENDADA_DIAS, DIAS_DESCANSO_DEFECTO, DIAS_OCUPACION_DEFECTO } from "@/lib/corrales";
import { DIAS_EDAD_FAMACHA } from "@/lib/famacha";
import { DIAS_PODOLOGIA } from "@/lib/sanidad";

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

export const AYUDA_SANIDAD: Ayuda = {
  titulo: "Sanidad del hato",
  puntos: [
    { titulo: "Programar y aplicar", texto: "Programa una vacuna, desparasitación, tratamiento o pediluvio para los animales que aplican; cuando llega el día lo aplicas y queda en el historial de cada uno." },
    { titulo: "Retiro", texto: "Si un producto tiene días de retiro, la leche y la carne de ese animal no se pueden vender hasta que pasen." },
    {
      titulo: "FAMACHA",
      texto: `Se evalúa el color del párpado de los animales de más de ${meses(DIAS_EDAD_FAMACHA)} meses. 1 y 2: sin anemia. 3: vigílalo. 4 y 5: desparasítalo. Así solo tratas a quien lo necesita.`,
    },
    { titulo: "Pezuñas", texto: `Revisa las pezuñas cada ${meses(DIAS_PODOLOGIA)} meses (podología) y usa pediluvio con sulfato de cobre o de zinc, sobre todo en épocas de lluvia.` },
  ],
  enlace: { href: "/sanidad", texto: "Ver el resumen de toda la finca" },
};

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
