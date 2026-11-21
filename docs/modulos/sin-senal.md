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

### En la pantalla de entrada (21 nov 2026)

La pantalla de entrada explica qué se anota sin señal y cómo se llega (sección «Sin señal», pregunta frecuente y, debajo del formulario, el botón
«Registrar sin señal» cuando el celular ya quedó listo). La lista sale de `REGISTROS_SIN_SENAL` (`lib/campo.ts`): **una opción nueva de «Registrar sin
señal» se agrega también ahí** (la prueba lo exige). Detalle en `docs/modulos/presentacion-planes.md`.

**Dónde se encuentra con señal**: en el menú (primer bloque, después de Hato; en el celular, dentro de «Más»), en «Al grano» (pestaña «Registrar»), en
los enlaces «… sin señal» de cada pantalla y, con la app instalada, en el atajo de su ícono. Sin señal, la página «Sin señal» lo ofrece al abrir Apriscol.

### Partos sin señal (21 nov 2026)

**Parto en «Registrar sin señal»** (`components/campo/PartoCampo.tsx`, `/campo#parto`; atajo «Parto sin señal» y enlace en «Registrar parto» de la
ficha): lo mismo que con señal: la hembra (primero las gestantes y servidas; una con un parto guardado en el celular no se ofrece de nuevo), fecha,
qué pasó (normal, asistido, cesárea o aborto), una fila por cría (sexo, viva o muerta, peso, arete y nombre), quién asistió, causa del aborto,
complicaciones, protocolo posoperatorio y observaciones. Lo hace quien registra reproducción (propietario, administrador, veterinario).
- **Una sola regla** (`lib/parto-reglas.ts`: `esquemaParto`, `datosPorTipoParto`, `leerCrias`, `revisarCrias`, `prepararParto`) para `crearParto`, la
  pantalla del celular y el envío (`guardarPartoCampo`). Se guarda con la misma función de la base (`registrar_parto`: el parto, sus crías y los
  animales de las crías con arete, todo o nada; la lactancia la abre un disparador), que ya era idempotente por `client_request_id`. **No hizo falta migración.**
- **El servicio** se liga solo, al enviar, al de la gestación en curso (servida o gestante), como la pantalla con señal; con una gestación en curso, el
  parto debe ser posterior a su servicio (sin señal antes se habría guardado suelto: corregido en la regla compartida).
- **Aretes de las crías**: se avisa en el celular si ya están en la copia o en otro registro sin enviar (un animal nuevo u otro parto: `areteRepetido`
  ahora mira también las crías, `aretesDeCrias`); el servidor lo vuelve a comprobar. Una cría con arete se crea solo si quien envía puede escribir en el
  Hato (si no, el parto queda sin crear ese animal, igual que con señal).
- **Nunca duplica a otra persona**: si la hembra ya tiene un parto (de otra persona u otro aparato) a menos de 30 días del anotado, no se registra otro
  y pasa a «Pendientes con error» con su fecha.
- **Respaldo con señal**: «Registrar parto» (`FormParto`) guarda en el celular si se cae la señal, con sus crías y el mismo identificador; corregir un
  parto avisa y deja lo escrito.

### Dar de baja sin señal y ajustes de «Dados de baja» (21 nov 2026)

**Dar de baja en «Registrar sin señal»** (`components/campo/BajaCampo.tsx`, `/campo#baja`; atajo «Dar de baja sin señal» y enlace en la pantalla «Dar de
baja» de la ficha): lo mismo que con señal: el animal (los activos de la copia; uno con una baja guardada en el celular no se ofrece de nuevo), qué
pasó (venta, muerte, sacrificio o pérdida), cuándo; si fue una venta, comprador (o uno nuevo por nombre), valor, IVA, si ya pagaron y si va para
consumo; peso, guía y destino de una salida comercial; motivo y notas. Avisa si la hembra está en el ordeño. Lo hace quien escribe en el Hato.
- **Una sola regla** (`lib/baja-reglas.ts`: `esquemaBaja`, `revisarBaja`, `datosDeVenta`, `datosComerciales`, `filaBaja`, `entradaBajaDeCampos`) para
  `darDeBaja`/`corregirSalida`, la pantalla del celular y el envío (`guardarBajaCampo`). La base sigue marcando el estado del animal, cerrando su
  lactancia y rechazando sacar para consumo a uno en retiro de carne; el nacimiento lo comprueba el servidor.
- **Identificador de envío en las bajas** (migración `20261121161427_bajas_client_request_id`, solo agrega): reenviar no duplica, y un **doble toque**
  en la ficha ya no da «Ese animal ya tiene una baja registrada».
- **Nunca pisa a otra persona**: si el animal ya salió por otra baja (de otra persona u otro aparato), no se registra otra salida y el registro pasa a
  «Pendientes con error» diciendo cuál fue (tipo y fecha).
- **Respaldo con señal**: «Dar de baja» en la ficha (`FormBaja`) guarda en el celular si se cae la señal (`guardarRespaldo` de `lib/offline/respaldo.ts`,
  para formularios sin `useActionState`); los controles de calidad de una salida para consumo se responden después, con señal.
- **Ajustes de «Dados de baja»**: el valor de la venta se lee con `leerNumero` (antes a mano), y el filtro «Dados de baja» del Hato sin animales
  muestra su propio estado vacío («Ningún animal ha salido del hato») en vez de «Nada con ese filtro».
- **Copia de la finca**: sin cambio de versión; los compradores (de `ventas`) llegan también a quien da de baja animales.

### Ventas sin señal (21 nov 2026)

**Venta en «Registrar sin señal»** (`components/campo/VentaCampo.tsx`, `/campo#venta`; atajo «Venta sin señal» y enlace en Hato → Ventas): lo mismo que
«Registrar una venta» con señal: qué se vendió (los productos de venta que se registran a mano, con su unidad y el último precio), cantidad × precio,
fecha, comprador (o uno nuevo por nombre), «Ya me pagaron» / «Me lo deben» (con la fecha del cobro o cuándo se espera), IVA (el predeterminado de la
finca) y observaciones, en la moneda de la finca. **La leche cruda y los animales no se venden aquí** (entran solos desde Leche → Despachos y desde la
salida del animal): ni la copia los trae ni el servidor los acepta. Lo hace quien registra ventas (propietario, administrador, contador).
- **Una sola regla** (`lib/venta-reglas.ts`: `esquemaVenta`, `revisarVenta`, `comprobarListasVenta`, `filaVenta`) para `crearVenta`/`editarVenta`, la
  pantalla del celular y el envío (`guardarVentaCampo`). Misma tabla (`ventas`); el identificador del registro es su `client_request_id` (reenviar no
  duplica). Recuerda el precio de venta. **No hizo falta migración.**
- **Comprador nuevo sin señal**: «Otro comprador» y su nombre; al enviar se usa el que ya exista o se crea (`asegurarTercero`, la misma regla de compras).
- **Respaldo con señal**: «Registrar una venta» (`FormVenta`) guarda en el celular si se cae la señal; corregir una venta avisa y deja lo escrito.
- **Copia de la finca, versión 7**: suma `ventas` (productos de venta a mano y compradores) y el permiso `ventas`; el IVA predeterminado es el de
  `compras`. Las copias de las versiones 1 a 6 siguen sirviendo.

### Compras sin señal (21 nov 2026)

**Compra en «Registrar sin señal»** (`components/campo/CompraCampo.tsx`, `/campo#compra`; atajo «Compra sin señal» y enlace en Hato → Compras):
lo mismo que «Registrar una compra» con señal: grupo → producto del catálogo (con su unidad y el último precio pagado) o «Otra compra» (rubro y
descripción) → cantidad y precio; fecha; proveedor; lote y vencimiento del producto veterinario (si el plan tiene Sanidad, obligatorio en vacunas,
desparasitantes y tratamientos); a quién se carga (finca, especie, corral, lote de ceba o animal); pagado o por pagar; IVA (con el predeterminado de
la finca) y observaciones. El dinero se escribe en la moneda de la finca. Lo hace quien registra compras (propietario, administrador, contador).
- **Una sola regla** (`lib/compra-reglas.ts`: `esquemaCompra`, `revisarCompra`, `resolverListasCompra`, `filaCompra`, `recordarPrecioCompra`) para
  `crearGasto`/`editarGasto`, la pantalla del celular y el envío (`guardarCompraCampo`). Misma tabla (`gastos`); el identificador del registro es su
  `client_request_id` (reenviar no duplica). Al guardarse recuerda el precio por unidad, como con señal. **No hizo falta migración.**
- **Proveedor nuevo sin señal**: se elige «Otro proveedor» y se escribe el nombre; al enviar se usa el que ya exista con ese nombre o se crea
  (`asegurarTercero` de `lib/terceros-servidor.ts`, la misma regla del selector con señal `crearTercero`: nunca dos con el mismo nombre).
- **Lo que queda para cuando haya señal**: la factura (se adjunta corrigiendo la compra) y la novedad «Comprar» (una compra guardada en el celular
  desde una novedad no la marca atendida: se atiende con señal).
- **Respaldo con señal**: «Registrar una compra» (`FormGasto`) guarda en el celular si se cae la señal, con el mismo identificador; corregir una
  compra avisa y deja lo escrito.
- **Copia de la finca, versión 6**: suma `compras` (productos de compra activos, proveedores, lotes de ceba abiertos, productos veterinarios, especies,
  IVA predeterminado y si el plan tiene Sanidad), la moneda de la finca y el permiso `compras`; los corrales y los animales llegan también a quien
  registra compras (para «a quién se carga»). Las copias de las versiones 1 a 5 siguen sirviendo.

### Corrales sin señal: mover animales (21 nov 2026)

**Corrales en «Registrar sin señal»** (`components/campo/MoverCampo.tsx`, `/campo#corrales`; atajo «Mover animales sin señal» y enlace en Hato →
Corrales): mover uno o varios animales a un corral o potrero, o sacarlos de su ubicación, con fecha (hoy o ayer), motivo (sugerido por el destino:
rotación en potrero, cuarentena, maternidad…) y observaciones. Los animales se eligen en una hoja **por dónde están** («Corral 2 · 14»,
«Sin ubicación · 3») o con el buscador, y cada fila dice dónde está. Lo hace quien puede escribir en Corrales (propietario, administrador, veterinario).
- **Dónde está cada animal** sale de la copia de la finca **más** lo movido en el celular que aún no se envía (`ubicacionesEfectivas` de
  `lib/campo.ts`, en el orden en que se anotó): rotar un lote dos veces seguidas sin señal cuenta bien el cupo y la lista.
- **El cupo se bloquea igual que con señal** (`cupoDestino` y `textoSinCupo` de `lib/movimiento-reglas.ts`, que también usa `FormMover`); avisa si
  el potrero estaba en descanso cuando se guardó la copia y recuerda los días de cuarentena. Los **avisos de mezcla** (lactantes, machos con hembras,
  pesos) necesitan los pesos y etapas del hato: salen al mover con señal.
- **Una sola regla** (`leerMovimiento` de `lib/movimiento-reglas.ts`) para `moverAnimales` y `guardarMovimientoCampo`; se guarda con la misma
  función de la base (`mover_animales`, que vuelve a exigir cupo, fecha y animales activos). **No hizo falta migración.**
- **Reenviar no duplica**: los que ya están en el destino (o sin ubicación, si se sacaban) no se mueven; si son todos, «ya estaba».
- **Nunca pisa a otra persona**: el registro viaja con la hora en que se anotó (`creadoEn`). Si alguno de los animales lo movió **otra persona**
  después de esa hora (su fila abierta se creó después, o con fecha posterior), no se mueve ninguno y el registro pasa a «Pendientes con error»
  diciendo cuáles; se arregla con «Corregir» (quitarlos) y se reenvía. Lo que movió la misma persona no cuenta como ajeno (dos movimientos
  seguidos del mismo lote se aplican en orden). Un animal que salió del hato también lo rechaza, con su arete.
- **Respaldo con señal**: «Mover animales» (`FormMover`) guarda en el celular si se cae la señal (sus avisos de cupo y mezcla ya no fallan sin
  red); corregir un movimiento (`FormMovimiento`) y crear o editar un corral (`FormUbicacion`) avisan y dejan lo escrito.
- **Copia de la finca, versión 5**: suma `ubicaciones` (las activas, con tipo, uso, capacidad y estado de rotación), la ubicación actual de cada
  animal activo y el permiso `corrales`. Las copias de las versiones 1 a 4 siguen sirviendo.

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

### Lo creado sin señal se usa de inmediato (21 nov 2026)

- **Un animal nuevo o una cría con arete creados sin señal ya salen en las demás opciones** sin esperar a que se envíen: la pantalla une a la copia de
  la finca lo que la persona tiene guardado sin enviar (`referenciaConPendientes` en `lib/campo.ts`). Un animal nuevo entra a monta, pesos, sanidad,
  corrales y bajas (y al ordeño si se anotó su último parto); una cría viva con arete, con la especie de la madre; la madre de un parto (no un aborto)
  entra al ordeño; el que tiene una baja guardada sale de las listas (sigue en la copia, inactivo, para poder corregir esa baja). Un registro con error
  no crea nada. Al corregir el animal o el parto, sus propios aretes no cuentan como repetidos (`AnimalHato.origen`).
- **Identificadores**: lo anotado sobre ellos lleva el identificador del celular (el del registro del animal nuevo; a cada cría con arete el celular le
  da uno en `campos.crias[].id`). Al enviar, `/api/campo/enviar` lo traduce al real (`traducirAnimalesLocales` en `lib/campo-servidor.ts`: busca
  `animales.client_request_id` en `animalId`, `animales`, `machoId` y `madre_id`/`padre_id`/`hembra_id`/`macho_id`). Los registros se envían en el
  orden en que se crearon, así que el animal llega antes que lo anotado sobre él; si no entró, lo de él queda en «Pendientes con error».
- **Migración** `20261121175426_crias_con_identificador_del_celular` (solo reemplaza la función): `registrar_parto` guarda el `id` de cada cría como
  `client_request_id` del animal creado (`esquemaCria.id` en `lib/parto-reglas.ts`).

### Aviso para instalar la app (21 nov 2026)

- **`AvisoInstalar`** (`components/AvisoInstalar.tsx`, reglas en `lib/instalar.ts`) en Hoy (solo para quien ve «Registrar sin señal» en el menú) y
  en `/campo`. Instalada, se abre de un toque desde la pantalla de inicio (también sin señal) y el celular no borra lo guardado: **Safari en iPhone
  borra los datos de una página que no se abre en unos días si no está en la pantalla de inicio**, por eso el aviso insiste más en iPhone (los dos
  pasos: Compartir → «Agregar a inicio»). En Android con Chrome ofrece «Instalar» directo (`beforeinstallprompt`); si el navegador no lo permite,
  dice dónde está en el menú. No sale en el computador, si ya está instalada (`display-mode: standalone`) ni durante `DIAS_OCULTAR_INSTALAR` días
  tras «Ahora no» (`localStorage`). Al guardar un registro se pide además `navigator.storage.persist()`.

### Lo que se dio de comer y despachos de leche sin señal (21 nov 2026)

- **Dos opciones nuevas en `/campo`**, entre «Corrales» y «Compra» (`REGISTROS_SIN_SENAL`, misma orden que las tarjetas): **Alimento**
  (`AlimentoCampo`: alimento, cuánto en kg o en bultos, fecha, destino opcional y observaciones; quien escribe en `nutricion`, `puede.alimento`) y
  **Despacho** (`DespachoCampo`: litros, fecha, destino, comprador (o uno nuevo), tanque, guía, precio por litro con IVA, cobrado o por cobrar,
  temperatura y observaciones; quien registra leche). Son registros de todos los días: al guardar, el formulario queda listo para el siguiente.
- **Copia versión 8** (v1–7 siguen sirviendo, sin estas dos opciones hasta renovarse): `alimentacion` (alimentos con conteo de apertura, peso por
  unidad y lo que quedaba; destinos que la persona ve) y `despachos` (compradores, último precio de la leche cruda e IVA predeterminado).
- **Una sola regla**: `lib/alimento-reglas.ts` (también `cargarDestinosSalida`, que salió de `lib/inventario-alimento-servidor.ts` porque ese archivo es
  `server-only`) y `lib/despacho-reglas.ts` (`esquemaDespacho`, `leerDespacho`, `aplicarCompradorDespacho`, `recordarPrecioLeche`), las mismas de
  `guardarSalida`, `crearDespacho` y `editarDespacho`. Envío: `guardarSalidaAlimentoCampo` y `guardarDespachoCampo` (idempotentes por
  `client_request_id`; un comprador nuevo con `asegurarTercero`; el precio queda como el habitual de la leche). Nunca reemplazan otro registro.
- **Respaldo con señal**: «Anotar lo que se dio» (`FormSalidaAlimento`) y «Registrar despacho» (`FormDespacho`) guardan en el celular si se cae la
  señal; los controles de calidad del despacho se responden después, con señal. Enlace «¿Sin señal?» en las dos pantallas, atajos en «Al grano» y
  «Registrar sin señal» en el menú también para quien solo anota alimento (`nutricion` en `sinSenal`). Sin migración.

### «Instalar la app» en Mi finca y aviso más confiable (21 nov 2026)

- **Mi finca → Instalar la app** (`/mas/instalar`, `InstalarApp`), para todos los roles: dice cómo se detectó el aparato («Este aparato: Celular
  Android · Abierta en Chrome · todavía no instalada aquí»), ofrece «Instalar Apriscol» cuando el navegador lo permite, avisa si se abrió dentro de
  otra app (WhatsApp, Instagram, Gmail…: desde ahí no se puede instalar), da los pasos de iPhone, Android y computador (los de este aparato primero) y
  permite volver a mostrar el aviso de Hoy si se ocultó. Si ya está instalada (se abrió desde el ícono), solo dice eso: los pasos quedan bajo «¿Otro celular
  o computador?», sin marcar ninguno como «Este aparato» (dentro de la app instalada no hay menú del navegador). Atajo en Al grano y ayuda en `AYUDA_PANTALLA["/mas/instalar"]`.
- **Dos fallas corregidas del aviso**: (1) un celular que pide el «sitio de escritorio» (Chrome lo hace solo en pantallas grandes y plegables) se
  presentaba como computador y el aviso no salía: ahora una pantalla táctil con puntero de dedo cuenta como celular (`plataformaDe(…, tactil)`); (2)
  Chrome avisa una sola vez por carga que se puede instalar (`beforeinstallprompt`) y se perdía si Hoy no estaba abierto: ahora lo escucha
  `lib/instalar-navegador.ts` desde que carga la app (lo importa `RegistrarSW`) y lo comparten el aviso y la pantalla. Reglas puras en
  `lib/instalar.ts` (`plataformaDe`, `navegadorDe`, `dentroDeApp`), con pruebas.

### Prueba en la finca (Android y iPhone, en modo avión)

Lo emulado en Chromium (Pixel 7 e iPhone 13, sin red) ya pasa: abre `/campo` guardada, anota alimento y despacho, crea un animal y una cría y los usa
en Ordeño y Pesar, y al volver la red todo se envía solo y en orden. Lo que solo se comprueba con los teléfonos reales:

1. Con señal: entrar con la cuenta, abrir Hoy y **instalar la app** (iPhone: Compartir → «Agregar a inicio»; Android: «Instalar»).
2. Abrir la app instalada una vez con señal (deja lista la copia) y luego activar **modo avión**.
3. Abrir la app desde el ícono: debe abrir «Registrar sin señal» (no la página del navegador sin conexión).
4. Anotar uno de cada uno: animal nuevo (con último parto), su ordeño, un parto con una cría con arete y luego el peso de esa cría, alimento en
   bultos y un despacho con comprador nuevo.
5. Cerrar la app del todo, volver a abrirla en modo avión: todo debe seguir en «Guardado».
6. Quitar el modo avión con la app abierta: en segundos todo pasa a «Enviado» (en iPhone, al abrir la app). Revisar con señal que la cría tenga su
   peso, que el alimento haya bajado del inventario y que el despacho tenga su comprador.
7. Repetir el paso 4 con el ordeñador (solo ordeño, alimento y despacho).

## Pasos siguientes (por definir)

- Todo lo del campo ya funciona sin señal (incluidos los partos con sus crías).
