# Tutoriales

Los videos de la serie del canal de YouTube de Apriscol, dentro de la app: **Mi finca → Tutoriales** (`/mas/tutoriales`). Es una pantalla para todos los roles y planes: no lee datos de la finca, así
que nunca falla por permisos ni por la base.

## Qué hay en la pantalla

- **Destacado «Tu avance»:** el siguiente tutorial por ver («Empieza por aquí» si no ha visto ninguno, «Sigue donde ibas» después) con su miniatura, el botón para verlo y una barra de «N de M tutoriales
  vistos». Si ya vio todos los disponibles, lo dice. Se oculta mientras se busca.
- **Buscador** (`CampoBusqueda`, sin tildes ni mayúsculas, sobre título y resumen) y, si nada coincide, `EstadoVacio`.
- **Secciones por tema** (`GRUPOS_TUTORIAL`): Empezar aquí, Traer tus datos, Día a día, Producción y manejo, Dinero y análisis, Equipo y cuenta. Cada tarjeta lleva miniatura con el número, duración,
  «Visto» si ya lo abrió, título y una línea de qué se aprende. Una en una columna en el celular (`grid-cols-1`), dos desde `sm`, tres desde `xl`.
- **«Próximamente»:** un tutorial sin enlace de YouTube se muestra apagado, con esa etiqueta, y no se abre.
- **Reproductor** (`Sheet`, `max-w-3xl`): el video de YouTube incrustado, su resumen, «Abrir en YouTube» y **Anterior / Siguiente** entre los que ya se pueden ver. El `iframe` se crea solo al abrir
  la hoja y se vuelve a crear al cambiar de tutorial.

## Decisiones

- **La lista es una sola:** `lib/tutoriales.ts` (`TUTORIALES`). Un tutorial nuevo se agrega ahí con su número, título, resumen, duración, grupo y miniatura (`public/tutoriales/NN.webp`, NN con dos
  cifras, 800×450). Cuando el video se sube a YouTube se le pone `youtube` (los 11 caracteres de `youtu.be/<id>`) y queda activo; hasta entonces es `null` («Próximamente»). Un identificador mal escrito
  no se incrusta nunca (`disponible` lo valida).
- **YouTube en privacidad reforzada:** se incrusta `https://www.youtube-nocookie.com/embed/<id>`. La política de contenido (`lib/cabeceras-seguridad.ts`) permite **solo** ese origen en `frame-src`.
  No se aloja ningún video en la app: no cuesta almacenamiento ni ancho de banda y suma vistas al canal.
- **Lo visto vive en el navegador de cada persona** (`localStorage`, clave `apriscol:tutoriales-vistos`, una lista de números): no se guarda en la base ni se comparte. Sin almacenamiento (ventana
  privada) se recuerda solo en esa visita. `vistosDesde` descarta lo dañado o que no sea un tutorial de la lista.
- **Las miniaturas** son las del canal sin la etiqueta de minutos ni la frase de abajo (la tarjeta ya las muestra como texto). Se sirven tal cual (`unoptimized`): ya son webp livianos (~25 KB).
- **No está en la página de entrada** (`OMITIDAS` en `lib/presentacion.ts`): es ayuda para quien ya tiene cuenta, no una función que convenza de registrarse.

## Pruebas

`tests/tutoriales.test.mjs`: están los 27 (0 al 26) con grupo, duración y miniatura existente; los enlaces son válidos y no se repiten; siguiente y anterior saltan los no disponibles; la búsqueda; lo
«visto» se lee aunque venga manipulado; la entrada del menú y la política de seguridad. `tests/menu.test.mjs` y `tests/reglas.test.mjs` cubren el menú y el `frame-src`.

## Pendiente

- Poner el enlace de YouTube de cada tutorial a medida que se sube (del 8 al 26 están en `null`).
- Botón «¿Cómo funciona?» de cada módulo que lleve directo a su tutorial (hoy abre la ayuda corta).
- Un aviso en Hoy para quien es nuevo («Aprende Apriscol en 6 minutos»).
