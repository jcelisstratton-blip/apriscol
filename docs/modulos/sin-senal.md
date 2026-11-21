# Modo sin señal

En el potrero o en el ordeño la señal entra y sale. El modo sin señal se construye por pasos; cada paso se puede desplegar solo y no cambia
cómo funciona lo demás de la app.

## Paso 1 — Service worker y página «Sin señal» (hecho, 20 nov 2026)

- **`public/sw.js`** (lo registra `components/RegistrarSW.tsx` desde `app/layout.tsx`, **solo en producción**). Hace una sola cosa: si una
  navegación (abrir una pantalla, recargar, seguir un enlace) **falla por la red**, muestra `public/offline.html` en lugar de la pantalla de error
  del navegador o del dinosaurio. Un 500 o una redirección al login son respuestas del servidor y se muestran tal cual: solo un fallo de red llega
  a la página sin conexión.
- **No guarda en caché ninguna pantalla, dato, foto ni sesión de la finca.** Lo único guardado es `offline.html` y `/logo.webp` (iguales para
  todos). Las consultas a Supabase, los envíos de formularios (POST), las acciones del servidor y `/_next/static` no pasan por el service worker.
- **Precarga de navegación** (`navigationPreload`): la pantalla se pide mientras el service worker arranca, así que con señal débil no agrega espera.
- **`public/offline.html`**: página autónoma (sin fuentes ni estilos de afuera: cuando se muestra no hay red) con el logo, los colores lana y
  musgo (claro y oscuro), «Reintentar» y **reintento automático** cada 5 s y al volver la conexión (`online`): pregunta por la misma dirección con
  `HEAD` (no pasa por el service worker) y, si responde, recarga. Cada intento tiene tiempo límite de 8 s.
- **Cabeceras** (`cabecerasModoSinSenal` en `lib/cabeceras-seguridad.ts`, aplicadas en `next.config.ts`): `sw.js` con `Cache-Control: no-cache, no-store, must-revalidate` (un service worker viejo pegado en una caché dejaría a la persona sin correcciones) y `Service-Worker-Allowed: /`; `offline.html` con `no-cache`. La política de contenido ya permite todo lo que usan (`worker-src 'self'`, solo recursos propios); un recurso externo en `offline.html` la rompería.
- **`sw.js` y `offline.html` se sirven sin sesión**: están excluidos del `matcher` de `proxy.ts` (si no, el filtro de entrada los mandaría a `/login`).
- **Versión de la caché:** `CACHE = "apriscol-offline-vN"`. Si cambia la lista de lo que se guarda, se sube N; al activarse, el service worker
  borra las cachés `apriscol-*` anteriores.

### Límites conocidos

- Con señal **muy débil** la petición no falla, se queda colgada: el navegador espera su propio tiempo antes de rendirse. No se corta antes a
  propósito (una pantalla pesada con 2G puede tardar y ser válida).
- Lo que se estaba escribiendo en un formulario **sin enviar** se pierde si la persona navega sin señal: guardar sin señal es el paso siguiente.
- En desarrollo (`next dev`) no se registra.

### Para probar

`npm run build && npm start`, abrir la app con conexión una vez (se instala el service worker), **apagar el servidor** (la emulación de «sin red»
de las herramientas del navegador no siempre alcanza las peticiones del service worker) y recargar o abrir otra pantalla: debe salir «Sin señal».
Al volver a encender el servidor, la página recarga sola en menos de 5 s. Auditoría de celular a 360 y 320 px. Pruebas: `tests/sin-senal.test.mjs`
(carga `sw.js` en un entorno de service worker de mentira: qué guarda, qué deja pasar, qué responde sin red; y el `matcher`).

## Paso 2 — «Llevar las plantillas al campo» (hecho, 20 nov 2026)

En «Migrar mi finca» (y desde «Al grano»), un solo archivo comprimido con todas las plantillas de cargue que la persona puede usar, las listas
de su finca y un «Léeme primero». Se descarga **con** señal, se llena **sin** ella (Excel en el computador o en el celular) y se carga al volver con
los cargues de siempre, que revisan cada fila y se pueden deshacer. No guarda nada en el service worker: el archivo queda en el dispositivo como
cualquier descarga. Detalle y reglas en `docs/modulos/importar-exportar.md` («Llevar las plantillas al campo»).

## Paso 3 — Registrar la jornada sin señal: ordeño y pesos (hecho, 20 nov 2026)

Anotar el ordeño y los pesos **dentro de la app** sin señal, también cuando la app se abre ya sin conexión en el corral. Lo anotado queda
en el celular y se envía solo al volver la señal, sin duplicar ni pisar nada.

### Cómo funciona

1. **Copia de la finca** (`GET /api/campo/referencia`, `leerReferenciaCampo` en `lib/campo-servidor.ts`). Cada vez que el panel se abre con
   señal, `MotorCampo` (en `app/(app)/layout.tsx`) la pide si falta, tiene más de 15 min o es de otra persona o finca, y la guarda en IndexedDB
   (`apriscol-campo`, tienda `referencia`). Lleva **solo lo indispensable**: hembras con lactancia abierta (arete, nombre, turnos y hasta qué día
   están en retiro de leche) y, si la persona pesa, los animales activos (arete, nombre, si están en ceba y su último peso). Quien no registra
   pesos no se lleva la lista del hato. Las listas salen de las mismas funciones que las pantallas con señal: `hembrasEnLeche`
   (`lib/ordeno-servidor.ts`, también de la captura de leche) y `leerCeba` (`lib/ceba-servidor.ts`, también de Hato → Ceba).
2. **Pantalla `/campo`** («Registrar sin señal», `app/campo/page.tsx` + `components/campo/`). Es **estática e igual para todos** (fuera del
   layout del panel, `force-static`, no lee la sesión): por eso el service worker puede guardarla. Ordeño (jornada, hoy o ayer, hoja con el
   teclado propio y salto a la siguiente, aviso de retiro), Pesar (los de ceba primero, todo el hato con el buscador, último peso para comparar) y
   «Guardado» (por enviar, pendientes con error y enviados). Muestra lo anotado **en este celular** (sin señal no se sabe lo de los demás).
   Funciona igual con señal: guarda en el celular y envía enseguida.
3. **Service worker** (`public/sw.js`, caché `apriscol-offline-v2`): `MotorCampo` le pide `preparar-campo` y guarda `/campo` con sus archivos de
   `/_next/static` (solo con sesión: una redirección al login no se guarda). Al abrir `/campo`: red primero con 4 s de tiempo límite; sin red,
   con la señal colgada o con el servidor caído, la copia guardada. La página «Sin señal» ofrece «Registrar ordeño y pesos sin señal» si el
   aparato ya la tiene lista. **Ninguna otra pantalla ni dato pasa por el service worker.**
4. **Bandeja del celular** (IndexedDB, tienda `registros`; `lib/offline/campo-db.ts`). Cada registro: tipo, finca, persona, animal, fecha,
   jornada, litros o peso, estado (`pendiente` · `enviando` · `error` · `enviado`) y su identificador (`client_request_id`). Corregir antes de
   enviar reutiliza el mismo registro. Lo enviado se muestra 3 días y se borra.
5. **Envío** (`lib/offline/campo-envio.ts`, gancho `useBandejaCampo`): de a uno, en una sola pestaña (Web Locks), al abrir la app, al volver
   la señal (`online`), al volver a la pestaña y cada 30 s mientras haya algo. **En iPhone y en Android solo con la app abierta** (no hay envío en
   segundo plano). Cada petición tiene 15 s de tiempo límite. `POST /api/campo/enviar` exige sesión, que venga de la propia app y que la
   persona pueda registrar eso **en la finca del registro** (no en la activa: pudo cambiar de finca), con el plan al día.
6. **Nada se duplica ni se pisa** (`guardarOrdenoCampo`, `guardarPesoCampo`). Reenviar el mismo registro responde «ya estaba». Si ya había
   otro dato de ese animal en esa jornada (ordeño) o ese día (peso), **no se toca**: el del celular pasa a «Pendientes con error» con lo que
   había, para que la persona decida. Dos envíos a la vez se resuelven por las restricciones únicas de la base. No hizo falta migración.
7. **Errores.** Sin red o servidor caído: queda pendiente y se reintenta solo. Sesión vencida: queda pendiente y la pantalla pide entrar de
   nuevo. Rechazo (animal que salió del hato, un macho en ordeño, permiso o plan que cambió, dato que ya existía): «Pendientes con error», con
   el motivo, «Reintentar» o «Descartar» (con confirmación). La etiqueta flotante del panel («N sin enviar» / «N con error») lleva a la bandeja.
8. **Respaldo en las pantallas con señal.** Si la señal se cae a mitad de la captura de leche (`CapturaLeche`) o de la pesada de Ceba
   (`CebaPesar`), lo escrito se guarda en la misma bandeja (mismo identificador) con «Guardado en el celular. Se enviará al volver la señal.» y
   la fila queda «Por enviar».
9. **Cuentas y privacidad.** Solo se envía lo de la persona con la sesión abierta; lo de otra cuenta en el mismo aparato solo se cuenta. Al
   cerrar sesión (`/login?salio=1` → `LimpiarCampo`) se borra la copia de la finca; lo pendiente se conserva (es trabajo de alguien).

### Entradas

«Al grano» (Registrar sin señal), mantener presionado el ícono de la app instalada (atajo del manifiesto), los enlaces de la captura de leche
y de Ceba, la página «Sin señal» y la etiqueta flotante. La ayuda «¿Cómo funciona?» es `AYUDA_CAMPO` (`lib/ayuda.ts`, tutorial 5).

### Límites conocidos

- Hay que haber abierto Apriscol con señal al menos una vez en ese aparato (y con la sesión abierta) para que `/campo` y la copia queden listas.
- Sin envío en segundo plano: si se cierra la app, lo pendiente espera a la próxima vez que se abra.
- En iPhone, Safari puede borrar lo guardado de un sitio que no se usa en días si la app no está en la pantalla de inicio: conviene instalarla.
- Sin señal no se ven los registros de otras personas ni los avisos de producción baja: eso sigue en la captura de leche con señal.
- Lo ya enviado no se corrige desde `/campo` (se hace con señal en la captura de leche o en la ficha del animal).

### Para probar

`tests/campo.test.mjs` (reglas, el servidor con una base falsa: idempotencia, conflictos, carreras, rechazos y la copia por rol) y
`tests/sin-senal.test.mjs` (el service worker con `/campo`). En el navegador: `npm run build && npm start`, abrir el panel con sesión, cortar
la red **y** apagar el servidor, abrir `/campo`, anotar, volver a encender y ver que se envía. Auditoría de celular a 360 y 320 px.

### Sanidad sin señal y respaldo de todos los formularios (21 nov 2026)

**Sanidad en «Registrar sin señal»** (`components/campo/SanidadCampo.tsx`, `/campo#sanidad`; atajo «Sanidad sin señal» y enlace en Hato → Sanidad):
lo que se le hizo a uno o varios animales (vacuna, desparasitación, tratamiento, podología, pediluvio, cirugía u otro), con lo que pide cada tipo
(`REGLAS` de `lib/sanidad-campos.ts`: contra qué, etapa, motivo, días, cojera, anestesia, solución), el producto del catálogo guardado (con su retiro)
o escrito, dosis, unidad y vía, retiro de leche y carne, quién lo hizo, diagnóstico, próxima dosis (con sus atajos) y observaciones. Los animales
se eligen en una hoja con buscador («Elegir todos» / «Quitar todos»). El **lote de una compra** se elige después, con señal; quien compra
(propietario o administrador) puede escribirlo. Las reglas viven en un solo lugar, `lib/evento-sanitario.ts` (`esquemaEvento`,
`leerEventoSanitario`, `vincularPrograma`), que usan `crearEvento`/`editarEvento` y `guardarSanidadCampo`; se guarda con la misma función de la base
(`guardar_evento_sanitario_detalle`) y el identificador del registro como `client_request_id` (reenviar no duplica).

**Respaldo sin señal en los formularios con señal** (`lib/offline/respaldo.ts`: `accionConRespaldo`, `AvisoGuardadoLocal`). Antes, si la señal
se caía al tocar «Guardar», la acción del servidor fallaba y la app mostraba «Algo no salió bien», perdiendo lo escrito. Ahora, en todo lo que
se puede hacer sin señal:
- **Registro nuevo** → queda en el celular con el mismo identificador del formulario (nunca se duplica) y el formulario lo dice («Guardado en el
  celular…», «Ver lo guardado»): animal nuevo (`FormAnimal`), peso desde la ficha (`FormPeso`, con tipo, condición corporal y observaciones),
  servicio desde la ficha (`FormServicio`: monta, inseminación o transferencia, con `leerServicio` de `lib/servicio-reglas.ts`), diagnóstico desde
  la ficha (`FormDiagnostico`, también «otro método», quién lo hizo y observaciones) y sanidad (`FormEvento`). La captura de leche y la pesada de
  Ceba ya lo hacían.
- **Corrección (editar)** → aviso amable «Sin señal: los cambios no se guardaron… lo que escribiste sigue aquí» (no se guarda en el celular).
- Cualquier otro error sigue su camino de siempre: solo un fallo de **red** cambia el comportamiento.
- El diagnóstico con señal ahora también lleva su identificador de envío (`client_request_id`): un doble toque no lo duplica.

**Copia de la finca, versión 4**: suma `productos` (catálogo activo con su retiro) y los permisos `sanidad` y `lotes`; los animales llegan a quien
crea animales o registra sanidad (el veterinario). Las copias de las versiones 1 a 3 siguen sirviendo.

### Animal nuevo sin señal (21 nov 2026)

Es **lo primero** de «Registrar sin señal» para quien registra en el Hato (propietario y administrador): la tarjeta «Animal nuevo» va de
primera y abre por defecto. También se llega con `/campo#animal` (atajo «Animal nuevo sin señal» de «Al grano» y enlace en Hato → Animal nuevo).

- **Mismos datos y mismas reglas que el formulario con señal** (`components/campo/AnimalCampo.tsx`): especie, sexo, arete, nombre, raza,
  lana o pelo (ovejas), nacimiento, origen, peso al nacer, aptitud y último parto (hembras) o uso (machos), padre y madre del hato (también los
  que ya salieron) y, en «Más datos», color, microchip, marcas, rasgos, padres de fuera y notas. **Quedan para después, desde la ficha, con
  señal:** la foto y el valor y la fecha de compra. Las reglas viven en un solo lugar, `lib/animal-nuevo.ts` (`esquemaAnimal`,
  `prepararAnimalNuevo`, `fotoValida`), que usan `crearAnimal` y el registro sin señal.
- **El arete**: avisa y no deja guardar si ya está en la copia de la finca o en otro animal guardado en el celular (`areteRepetido`, misma
  comparación que la base: sin espacios ni mayúsculas). La base lo vuelve a comprobar al enviar: si otra persona lo creó mientras tanto, queda en
  «Pendientes con error» («Ya hay un animal con el arete…») y se puede **corregir** desde la lista «Creados en este celular».
- **Servidor** (`guardarAnimalCampo`): valida los mismos campos de texto con `esquemaAnimal` y llama a `registrar_animal` con el identificador
  del registro como `client_request_id`: reenviar devuelve el mismo animal; con último parto abre su lactancia en el mismo paso.
- **Respaldo en el formulario con señal** (`FormAnimal`): si la señal se cae al tocar «Guardar animal», el animal queda en el celular con el
  mismo identificador del formulario (nunca se duplica) y el formulario lo dice, con «Ver lo guardado». Antes la app mostraba «Algo no salió
  bien» y se perdía lo escrito. Una **corrección** de un animal sin señal pide intentarlo de nuevo (no se guarda en el celular).
- **Copia de la finca, versión 3**: suma `especies`, `proposito`, `razas` y `animales` (todos los de la finca, también los que salieron: arete,
  nombre, sexo, especie y si sigue activo), solo si la persona registra en el Hato. Las copias de las versiones 1 y 2 siguen sirviendo.

### Monta y diagnóstico de gestación sin señal (20 nov 2026)

La misma pantalla `/campo` suma **Monta** y **Diagnóstico** para quien registra reproducción (propietario, administrador, veterinario):

- **Monta** (`components/campo/MontaCampo.tsx`): se elige el reproductor una vez (del hato, de la misma especie que la hembra, o «De otra
  finca» con su nombre) y se toca cada hembra que montó, hoy o ayer. Se guarda como **servicio por monta natural**, igual que desde la ficha.
  Avisa (sin bloquear) si según la copia está gestante o tiene un servicio de hace menos de 21 días (repetición de celo).
- **Diagnóstico** (`components/campo/DiagnosticoCampo.tsx`): las servidas que esperan diagnóstico salen primero. Ecografía (días de gestación con
  el teclado propio, fetos, latido) o palpación (indicador y condición corporal), con **las mismas reglas que la ficha**: `reglasDiagnostico`
  (`lib/diagnostico-reglas.ts`, que ahora usa también `leerDiagnostico`). «Otro método» sigue siendo con señal (pide escribir la prueba).
  El servicio al que se cuelga lo elige el servidor al enviar (`servicioVigente`), como con señal; una monta anotada antes en el celular abre
  el ciclo porque se envía primero.
- **La temporada de empadre se arma y se cierra con señal**: asignar hembras exige revisar en el momento la endogamia de cada pareja, el cupo de
  cada semental y que la hembra esté libre. Desde Hato → Empadre hay un enlace a «Anotar montas y diagnósticos sin señal».
- **Servidor** (`guardarMontaCampo`, `guardarDiagnosticoCampo`): reenviar responde «ya estaba». Si otra persona ya registró un servicio de esa
  hembra ese día, o un diagnóstico de ese servicio ese día, no se agrega otro: el del celular pasa a «Pendientes con error». Rechaza lo que la
  ficha rechaza (macho, hembra que salió, reproductor de otra especie o que no es macho, monta antes de nacer, sin servicio vigente, ciclo ya
  cerrado en «vacía», reglas del método).
- **Copia de la finca, versión 2**: suma `hembras` (activas, con su estado reproductivo de `v_repro_hembras`) y `machos`, solo si la persona
  registra reproducción. Una copia de la versión 1 sigue sirviendo para ordeño y pesos hasta la próxima apertura con señal.
- **Migración** `20261120190017_diagnosticos_client_request_id` (solo agrega): `diagnosticos_gestacion.client_request_id` con índice único por
  finca, como ya tenían `servicios`, `ordenos` y `pesajes`.

## Pasos siguientes (por definir)

- Otros registros del campo sin señal (sanidad, partos) con el mismo motor, si hace falta. Los partos son más delicados: crean las crías como animales.
