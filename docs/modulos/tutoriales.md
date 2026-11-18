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
  cifras, 800×450). Cuando el video se sube a YouTube se le pone `youtube` (los 11 caracteres de `youtu.be/<id>`) y queda activo; hasta entonces es `null` («Próximamente»). Desde noviembre de 2026 los 30 tutoriales (0 al 29) ya están publicados; el Tutorial 1 es la versión nueva, con las secciones de Telegram y Claude. La duración es la que muestra YouTube (se redondea hacia arriba). Un identificador mal escrito
  no se incrusta nunca (`disponible` lo valida).
- **La serie completa:** en el bloque de arriba hay un enlace «Ver la serie completa en YouTube» a la lista de reproducción del canal (`LISTA_YOUTUBE` en `lib/tutoriales.ts`, validada por `urlLista`); abre YouTube en otra pestaña, no se incrusta.
- **YouTube en privacidad reforzada:** se incrusta `https://www.youtube-nocookie.com/embed/<id>`. La política de contenido (`lib/cabeceras-seguridad.ts`) permite **solo** ese origen en `frame-src`.
  No se aloja ningún video en la app: no cuesta almacenamiento ni ancho de banda y suma vistas al canal.
- **Lo visto vive en el navegador de cada persona** (`localStorage`, clave `apriscol:tutoriales-vistos`, una lista de números): no se guarda en la base ni se comparte. Sin almacenamiento (ventana
  privada) se recuerda solo en esa visita. `vistosDesde` descarta lo dañado o que no sea un tutorial de la lista.
- **Las miniaturas** son las del canal sin la etiqueta de minutos ni la frase de abajo (la tarjeta ya las muestra como texto). Se sirven tal cual (`unoptimized`): ya son webp livianos (~25 KB).
- **No está en la página de entrada** (`OMITIDAS` en `lib/presentacion.ts`): es ayuda para quien ya tiene cuenta, no una función que convenza de registrarse.

## Pruebas

`tests/tutoriales.test.mjs`: están los 31 (0 al 30) con grupo, duración y miniatura existente; los enlaces son válidos y no se repiten; siguiente y anterior saltan los no disponibles; la búsqueda; lo
«visto» se lee aunque venga manipulado; la entrada del menú y la política de seguridad. `tests/menu.test.mjs` y `tests/reglas.test.mjs` cubren el menú y el `frame-src`.

## Cómo llegan las personas a los videos

Tres puertas, y las tres usan el mismo enlace `/mas/tutoriales?ver=N` (`rutaTutorial`), que abre la pantalla con ese video ya reproduciéndose (`numeroDeEnlace` acepta solo un tutorial que existe; cualquier
otra cosa se ignora, y al cerrar la hoja el `?ver=` se quita de la dirección):

1. **Menú de Mi finca → Tutoriales** (la pantalla completa).
2. **Aviso en Hoy** (`components/AvisoTutoriales.tsx`): «Nuevo · Aprende Apriscol en video» con el siguiente tutorial que la persona no ha visto (`proximoSinVer`), un botón «Ver ahora» y «Ver todos». Hoy lo
   muestra a las fincas durante su primer mes (`DIAS_AVISO_FINCA_NUEVA`) y, por ser algo nuevo, a **todas** hasta `ANUNCIO_TUTORIALES_HASTA` (`avisoTutorialesVisible`); pasada esa fecha, solo a las nuevas.
   Se puede ocultar (queda en el navegador, por finca) y desaparece solo cuando la persona vio todos los disponibles. En el celular es compacto (un ícono de play); desde `sm` lleva la miniatura.
3. **«¿Cómo funciona?» de cada módulo** (`AyudaModulo`): cada ayuda de `lib/ayuda.ts` lleva `tutorial: N` y la hoja **siempre** muestra la tarjeta de ese tutorial, para que se sepa que existe.
   Si su video ya está publicado, la tarjeta dice «Míralo en video» y abre el video; si todavía no, se ve apagada con «Tutorial en video · Próximamente» y no se abre. Al ponerle su enlace en
   `lib/tutoriales.ts` se activa sola. Ordeño → 5, Ceba → 14, Empadre → 18, Corrales → 13, Sanidad → 12, Inventario y Alimento → 15, Cargar desde Excel → 7, Compras y Ventas → 9, Costos → 10,
   Proyecciones y Reportes → 20, Personal → 21.

Una ayuda nueva se escribe **con** su `tutorial` (una prueba exige que toda `AYUDA_*` apunte a un tutorial que exista).

## Lo visto

`useTutorialesVistos` (`components/useTutorialesVistos.ts`) guarda en el navegador qué tutoriales abrió la persona y lo comparten la pantalla y el aviso de Hoy (se mantiene al día entre pestañas). Un video
cuenta como visto cuando la persona lo abre o cuando se carga su reproductor (así también cuenta el que se abre desde un enlace).

## Pendiente

- Poner el enlace de YouTube de cada tutorial a medida que se sube (del 9 al 29 están en `null`): con eso se activan solos su tarjeta, su «Siguiente» y su tarjeta en la ayuda del módulo (que hasta entonces dice «Próximamente»).
- Las ayudas de reportes comparten el tutorial 20 (Reportes y proyecciones); si se publica un video por área, se separan.
