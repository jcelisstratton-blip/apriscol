/**
 * Los tutoriales en video de Apriscol (el canal de YouTube): una fila por video, en el orden en que se recomienda verlos. Es la **única** lista: la pantalla
 * «Tutoriales» (Mi finca) la dibuja y las pruebas la revisan. Un tutorial nuevo se agrega aquí; cuando se sube a YouTube se le pone su `youtube` (los 11
 * caracteres del enlace `youtu.be/<id>`) y queda activo; mientras sea `null` la pantalla lo muestra como «Próximamente».
 *
 * Las miniaturas están en `public/tutoriales/NN.webp` (NN = el número con dos cifras).
 */

export type GrupoTutorial = "empezar" | "datos" | "dia" | "produccion" | "dinero" | "equipo";

export type Tutorial = {
  numero: number;
  titulo: string;
  /** Qué se aprende, en una línea. */
  resumen: string;
  /** Duración del video, «m:ss». */
  duracion: string;
  grupo: GrupoTutorial;
  /** Identificador del video en YouTube (los 11 caracteres de `youtu.be/<id>`), o `null` si todavía no se sube. */
  youtube: string | null;
};

export const GRUPOS_TUTORIAL: { id: GrupoTutorial; titulo: string; detalle: string }[] = [
  { id: "empezar", titulo: "Empezar aquí", detalle: "Qué es Apriscol, tu cuenta y tu primer animal" },
  { id: "datos", titulo: "Traer tus datos", detalle: "Pasa lo que ya llevas en Excel sin escribirlo de nuevo" },
  { id: "dia", titulo: "Día a día", detalle: "Lo que se hace todos los días en el aprisco" },
  { id: "produccion", titulo: "Producción y manejo", detalle: "Reproducción, carne, inventario, leche y genealogía" },
  { id: "dinero", titulo: "Dinero y análisis", detalle: "Compras, ventas, costos y reportes" },
  { id: "equipo", titulo: "Equipo y cuenta", detalle: "Tu equipo, tu finca y tu cuenta" },
];

/** El tutorial de «Al grano»: su tarjeta de video va al pie de la hoja. */
export const TUTORIAL_AL_GRANO = 29;

export const TUTORIALES: Tutorial[] = [
  { numero: 0, titulo: "¿Qué es Apriscol? Para qué sirve", resumen: "Qué es Apriscol, a quién ayuda y qué problemas resuelve, explicado sin tecnicismos.", duracion: "5:33", grupo: "empezar", youtube: "chsXttohDQ4" },
  { numero: 1, titulo: "Pantalla de entrada", resumen: "Recorre la pantalla de entrada: qué resuelve Apriscol, cómo funciona, tu equipo, los avisos por Telegram, Claude y los planes.", duracion: "7:45", grupo: "empezar", youtube: "wPTIS9z_Qn4" },
  { numero: 2, titulo: "Crear tu cuenta y tu primera finca", resumen: "Crea tu cuenta y registra tu primera finca en pocos minutos.", duracion: "7:55", grupo: "empezar", youtube: "0lE_IpvyHOM" },
  { numero: 3, titulo: "Tu primer animal y la pantalla Hoy", resumen: "Registra tu primer animal y aprende a leer la pantalla Hoy.", duracion: "7:00", grupo: "empezar", youtube: "c9S3PW9L7g0" },
  { numero: 4, titulo: "Semáforos: qué hacer hoy", resumen: "Entiende los semáforos rojo, ámbar y verde: qué atender hoy y qué hacer.", duracion: "6:13", grupo: "empezar", youtube: "OJBWxYUmtHo" },
  { numero: 5, titulo: "Ordeño y leche", resumen: "Registra el ordeño de cada jornada y mira la producción de leche.", duracion: "9:09", grupo: "dia", youtube: "CmRbNY1fSGQ" },
  { numero: 6, titulo: "La ficha del animal", resumen: "Todo sobre cada animal en una sola ficha: datos, genealogía, sanidad, peso y más.", duracion: "9:12", grupo: "dia", youtube: "EIXN0XxDSjE" },
  { numero: 7, titulo: "Migrar desde Excel", resumen: "Trae tus animales desde tu Excel con el asistente de columnas, y deshaz si algo sale mal.", duracion: "8:37", grupo: "datos", youtube: "HCbBNQnDjJk" },
  { numero: 8, titulo: "Historia y botiquín", resumen: "Carga la historia de pesos, ordeños y sanidad, y arma tu botiquín por Excel.", duracion: "8:39", grupo: "datos", youtube: "fG5siZumyLE" },
  { numero: 9, titulo: "Compras y ventas", resumen: "Registra tus compras y ventas, con cobros y pagos al día.", duracion: "6:44", grupo: "dinero", youtube: "S54isO_VyYg" },
  { numero: 10, titulo: "Costos", resumen: "Entiende tus costos, tus ventas y el resultado real de tu finca.", duracion: "6:39", grupo: "dinero", youtube: "7NAIfIX3bAo" },
  { numero: 11, titulo: "Reproducción", resumen: "Servicios, diagnósticos de gestación y partos, con las alertas de reproducción.", duracion: "8:50", grupo: "produccion", youtube: "b3law0oIC3I" },
  { numero: 12, titulo: "Sanidad", resumen: "Vacunas, desparasitaciones, FAMACHA, retiros y todo el calendario sanitario.", duracion: "7:20", grupo: "dia", youtube: "uH0LXAXQDd8" },
  { numero: 13, titulo: "Corrales y potreros", resumen: "Instalaciones, hacinamiento, cuarentena y rotación de potreros.", duracion: "7:31", grupo: "dia", youtube: "Ft3c5z-Vipc" },
  { numero: 14, titulo: "Carne y ceba", resumen: "Pesa, mide la ganancia diaria, arma lotes y decide cuándo vender.", duracion: "6:03", grupo: "produccion", youtube: "DVCvOdEW9Ik" },
  { numero: 15, titulo: "Inventario", resumen: "Inventario de medicamentos y alimento: cuánto tienes, qué se vence y para cuántos días alcanza.", duracion: "9:41", grupo: "produccion", youtube: "L9gP_d066KQ" },
  { numero: 16, titulo: "Novedades del equipo", resumen: "Avisos entre ordeñador, veterinario y administrador: comprar y aplicar dosis.", duracion: "6:47", grupo: "dia", youtube: "p-tFKfXLEpo" },
  { numero: 17, titulo: "Leche: calidad, despachos y frío", resumen: "Calidad de la leche, despachos con controles, cadena de frío y equipo de ordeño.", duracion: "8:52", grupo: "produccion", youtube: "gevxbS3TEKQ" },
  { numero: 18, titulo: "Genealogía y empadre", resumen: "Endogamia, simulador de cruzas y temporadas de monta.", duracion: "7:03", grupo: "produccion", youtube: "iD9nVZN2PNs" },
  { numero: 19, titulo: "Premios y ferias", resumen: "El palmarés de tus animales: ferias, premios y fotos.", duracion: "5:02", grupo: "produccion", youtube: "lGjzcJKxMYc" },
  { numero: 20, titulo: "Reportes y proyecciones", resumen: "Reportes por área con Excel, y proyecciones a 12, 24 o 36 meses.", duracion: "7:01", grupo: "dinero", youtube: "vX47zBcd1X8" },
  { numero: 21, titulo: "Equipo y roles", resumen: "Invita a tu equipo, asigna perfiles y registra los pagos al personal.", duracion: "6:10", grupo: "equipo", youtube: "X4c_rqfAuRA" },
  { numero: 22, titulo: "Mi finca", resumen: "Datos de la finca, ajustes, plan, productos y terceros, exportar y Telegram.", duracion: "7:00", grupo: "equipo", youtube: "HF4XqanGuys" },
  { numero: 23, titulo: "Bajas de animales", resumen: "Vender, sacrificar, registrar muertes y pérdidas, con controles y canal.", duracion: "6:00", grupo: "equipo", youtube: "EI_bx9FZoG4" },
  { numero: 24, titulo: "Varias fincas y referidos", resumen: "Maneja varias fincas en una cuenta y gana con tu enlace de referidos.", duracion: "4:30", grupo: "equipo", youtube: "ammDWXAbStc" },
  { numero: 25, titulo: "Avisos por Telegram", resumen: "Qué recibe cada persona del equipo por Telegram, y a qué hora.", duracion: "3:47", grupo: "equipo", youtube: "CmKSsTt2_0U" },
  { numero: 26, titulo: "Cuenta, invitación y plan vencido", resumen: "Recupera tu clave, acepta invitaciones y qué hacer si tu plan vence.", duracion: "5:14", grupo: "equipo", youtube: "SlDQhPiSjNI" },
  { numero: 27, titulo: "Recorrido por el Hato", resumen: "Los filtros, la lista y las tarjetas de trabajo del Hato: el mapa para llegar a cada módulo.", duracion: "3:55", grupo: "empezar", youtube: "kct_KaubruU" },
  { numero: 28, titulo: "Conecta Claude con tu finca", resumen: "Conecta Claude a tu cuenta para preguntarle qué atender hoy, cómo va la leche o buscar un animal. Solo lee, y lo quitas cuando quieras.", duracion: "4:14", grupo: "equipo", youtube: "AnM3MFMZHWw" },
  { numero: 29, titulo: "Encuentra todo con «Al grano»", resumen: "El botón del rayo: escribe lo que quieres hacer y la app te lleva directo, sin buscar en los menús.", duracion: "2:28", grupo: "dia", youtube: "FuCeC8w3kiE" },
];

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

/** La lista de reproducción del canal con la serie completa, en orden (el identificador que sigue a `list=`). */
export const LISTA_YOUTUBE = "PLdG_mLMTrkq8";
const ID_LISTA = /^PL[A-Za-z0-9_-]{8,40}$/;
/** El enlace de la lista completa, o `null` si el identificador no es válido. */
export const urlLista = (id: string = LISTA_YOUTUBE): string | null => (ID_LISTA.test(id) ? `https://www.youtube.com/playlist?list=${id}` : null);

/** ¿Ya se puede ver? Solo si tiene un identificador de YouTube válido. */
export const disponible = (t: Tutorial): boolean => t.youtube !== null && ID_YOUTUBE.test(t.youtube);

/** La miniatura del tutorial (en `public/tutoriales`). */
export const miniatura = (t: Tutorial): string => `/tutoriales/${String(t.numero).padStart(2, "0")}.webp`;

/** El video para incrustar: YouTube en modo de privacidad reforzada (no instala rastreadores hasta que se reproduce). */
export const urlIncrustada = (t: Tutorial): string | null =>
  disponible(t) ? `https://www.youtube-nocookie.com/embed/${t.youtube}?autoplay=1&rel=0&modestbranding=1&playsinline=1&hl=es&cc_lang_pref=es` : null;

/** El mismo video en YouTube (para abrirlo aparte). */
export const urlYoutube = (t: Tutorial): string | null => (disponible(t) ? `https://youtu.be/${t.youtube}` : null);

/** El siguiente tutorial que ya se puede ver, después de `numero`; `null` si no hay más. */
export const siguienteDisponible = (numero: number): Tutorial | null => TUTORIALES.find((t) => t.numero > numero && disponible(t)) ?? null;

/** El anterior que ya se puede ver, antes de `numero`; `null` si no hay. */
export const anteriorDisponible = (numero: number): Tutorial | null => [...TUTORIALES].reverse().find((t) => t.numero < numero && disponible(t)) ?? null;

/** Los tutoriales que contienen el texto (sin tildes ni mayúsculas) en el título o el resumen. Con la búsqueda vacía, todos. */
export function buscarTutoriales(texto: string, normalizar: (t: string) => string): Tutorial[] {
  const q = normalizar(texto.trim());
  if (!q) return TUTORIALES;
  return TUTORIALES.filter((t) => normalizar(`${t.titulo} ${t.resumen}`).includes(q));
}

/** Los números de tutorial que el navegador guardó como vistos (un JSON como «[0,1,4]»): lo dañado o que no sea un tutorial de la lista se descarta. */
export function vistosDesde(crudo: string): number[] {
  try {
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    const validos = datos.filter((n): n is number => Number.isInteger(n) && TUTORIALES.some((t) => t.numero === n));
    return [...new Set(validos)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/** La dirección que abre la pantalla de Tutoriales ya con ese video reproduciéndose (la usan el aviso de Hoy y las ayudas «¿Cómo funciona?»). */
export const rutaTutorial = (numero: number): string => `/mas/tutoriales?ver=${numero}`;

/** El número que trae el enlace `?ver=N`: solo un tutorial que existe; cualquier otra cosa, `null`. */
export function numeroDeEnlace(valor: string | string[] | undefined): number | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto || !/^\d{1,2}$/.test(texto)) return null;
  const n = Number(texto);
  return TUTORIALES.some((t) => t.numero === n) ? n : null;
}

/** Los tutoriales se anuncian en Hoy a todas las fincas hasta este día (después, solo a las fincas nuevas). */
export const ANUNCIO_TUTORIALES_HASTA = "2026-12-20";
/** Cuántos días desde que se creó la finca Hoy le ofrece los tutoriales. */
export const DIAS_AVISO_FINCA_NUEVA = 30;

/** ¿Hoy muestra el aviso de tutoriales? A las fincas nuevas durante su primer mes y, por ser algo nuevo, a todas hasta el día del anuncio. */
export const avisoTutorialesVisible = (diasDeFinca: number, hoy: string): boolean => diasDeFinca <= DIAS_AVISO_FINCA_NUEVA || hoy <= ANUNCIO_TUTORIALES_HASTA;

/** El siguiente tutorial que esta persona todavía no ha visto (entre los que ya se pueden ver), o `null` si los vio todos. */
export const proximoSinVer = (vistos: ReadonlySet<number>): Tutorial | null => TUTORIALES.find((t) => disponible(t) && !vistos.has(t.numero)) ?? null;
