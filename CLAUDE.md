# Apriscol — convenciones del repo

Gestión integral de un aprisco (cabras y ovejas): hato, genealogía y endogamia, leche, sanidad con periodos de
retiro, reproducción. SaaS multi-finca, **pensado primero para el celular**.

Stack: Next.js 16 (App Router, `proxy.ts`, **sin** Cache Components) · Supabase (Postgres + Auth + Storage, proyecto
`apriscol`, región `ca-central-1`) · Vercel · Tailwind 4. Antes de escribir código de Next.js, leer la guía
correspondiente en `node_modules/next/dist/docs/` (esta versión cambia APIs: `middleware` → `proxy`).

## Reglas duras

1. **Cero secretos versionados.** Solo la URL y la *publishable key* de Supabase viajan al navegador
   (`NEXT_PUBLIC_*`, ver `.env.example`). La service role, tokens y contraseñas de BD **nunca** entran al repo ni
   a variables `NEXT_PUBLIC_`.
2. **La finca es el tenant.** Toda tabla de datos lleva `finca_id`, y las llaves foráneas entre tablas de finca son
   **compuestas** `(x_id, finca_id)` para que un registro no pueda apuntar a otra finca. Prohibido duplicar un
   `id_propietario` por tabla: los permisos salen de `finca_miembros` + `private.puede_ver/puede_escribir`.
3. **Tabla nueva ⇒ RLS en la misma migración**: `select private.crear_politicas_finca('<tabla>', '<modulo>');` y
   `grant … to authenticated` (nunca a `anon`). Una tabla sin RLS no se mergea.
   **Las políticas de lectura usan `finca_id in (select private.fincas_ver('<modulo>'))`** (lo hace `crear_politicas_finca`), nunca
   `(select private.puede_ver(finca_id, …))`: con una columna de la fila Postgres evalúa la función por cada fila (leer 16.548 ordeños
   costaba 3,2 s; por conjunto, 4 ms). Una política escrita a mano sigue el mismo patrón (`fincas_ver` / `fincas_miembro`).
4. **Migraciones versionadas** en `supabase/migrations/<timestamp>_<descripcion>.sql`. Nada de cambios sueltos en la
   consola de Supabase. Se aplican al proyecto y el archivo queda con la misma versión que registra Supabase.
   Deben ser **retrocompatibles** (agregar antes de quitar): la base cambia antes de que Vercel termine de desplegar.
5. **Lo derivado no se guarda**: edad, GDP, fecha prevista de parto, totales del día, ITH, stock… son columnas
   generadas, vistas (`security_invoker = true`) o funciones. Las vistas siempre en modo invoker para que respeten RLS.
6. **SQL parametrizado**: nunca interpolar texto del usuario en una consulta. Con PostgREST, los filtros `.or()` con
   texto libre se sanean (ver `ListaHato`).
7. Funciones `SECURITY DEFINER`: solo cuando es imprescindible, con `search_path = ''`, validando dentro quién llama y
   con `revoke execute … from public, anon`.
8. Fechas en `timestamptz`/`date` y **día calendario de Colombia** (`lib/fechas.ts#hoyBogota`), nunca el del servidor.
9. Storage: un bucket por tipo de uso (`fotos-animales`, `soportes`, `premios`) y dentro la carpeta de la finca por su
   uuid (`<finca_id>/<uuid>.<ext>`). El servidor arma el nombre y emite una URL firmada de subida; además, cada bucket
   con subida desde el navegador lleva políticas en `storage.objects` **acotadas a la carpeta de la finca** y al rol
   (`private.carpeta_finca` + `puede_ver/puede_escribir`), con el formato del nombre forzado por la propia política. Así
   no se necesita la llave de servicio en el servidor web. Los buckets son privados: las fotos se muestran con URLs
   firmadas de corta vida (`lib/fotos.ts`). Las fotos se reducen en el navegador antes de subir (ahorra datos en el campo).
10. Módulo nuevo ⇒ valor nuevo en el enum `modulo_app` en **su propia migración** (un valor de enum recién creado no puede
   usarse en la misma transacción), y luego tablas + `crear_politicas_finca`. `puede_ver/puede_escribir` niegan por
   defecto: un rol solo accede a un módulo si aparece listado.
11. **Libro genealógico = única tabla global** (`libro_genealogico`, sin `finca_id`), **legible solo por el superadmin**
   (`plataforma_admins`); las fincas nunca la consultan, solo reciben cálculos por funciones `security definer` que validan su finca.
   Se llena con `importar_libro_lote` (service_role). Los documentos de titulares nunca se guardan en claro (`private.hash_documento`,
   pepper en Vault). **El propietario es dueño y administrador de su finca**: trae sus animales con `traer_animales_libro`
   sin aprobación de nadie, pero **solo una vez, en un paso al crear la cuenta** (`/onboarding/animales`, `perfiles.libro_resuelto_en`; se cierra al terminar u omitir, y el superadmin lo reabre con `admin_reabrir_traer_animales`), y **solo los que prueba que son suyos**: documento del titular **y** microchip de uno de sus animales
   (misma respuesta si falla cualquiera de los dos), 10 intentos/hora por persona, 30 fallidos/hora por titular y tope de 3 documentos
   distintos por cuenta; al hato solo pasa lo que le sirve (nada de prefijo, puntaje ni datos internos de la asociación). El
   superadmin supervisa y puede revertir (`admin_revertir_importacion`) desde su propio espacio (`app/(admin)`, `/admin`: resumen global,
   fincas, importaciones), que **no exige tener una finca**: sin fincas, `obtenerContexto` lo manda a `/admin`, no al onboarding. Los volcados de datos reales no se versionan.

## Interfaz (móvil primero, referencias de Mobbin)

- Se diseña y se prueba a **360 y 320 px**: `scrollWidth == clientWidth` y ninguna caja con contenido más ancho que ella
  (`[...document.querySelectorAll('body *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')`).
  Rejillas de una columna con `grid-cols-1`; texto largo con `min-w-0` y `overflow-wrap:anywhere`.
- **Computador (desde `lg`, 1024 px):** menú lateral fijo (`NavLateral`; la barra inferior `BottomNav` se oculta con `lg:hidden`) y contenido
  hasta `max-w-5xl` (`2xl:max-w-6xl`) en `app/(app)/layout.tsx`. El celular no cambia nunca: todo lo de pantalla ancha va con prefijo `lg:`/`xl:`.
  Cada pantalla decide cómo usar el ancho: tarjetas en columnas (`lg:columns-2 lg:[&>*]:break-inside-avoid` si el orden del celular debe
  conservarse; `grid lg:grid-cols-2 lg:items-start` si no), listas en rejilla (`rejilla` de `ListaEscalable`), formularios y páginas de
  ajustes con ancho cómodo (`lg:max-w-xl`), nunca estirados a todo lo ancho. Lo que el menú lateral ya muestra (finca activa) no se repite
  en la pantalla en `lg`. Una pantalla nueva se prueba a 1440, 1024, 768, 360 y 320 px.
- **Menú agrupado (mismo orden en el computador y en «Más» del celular):** Hoy y Hato sin título; **Producción y manejo** (Leche, Reproducción, Carne, Sanidad, Corrales); **Dinero y análisis** (Costos, Reportes, Proyecciones); **Genealogía** (Endogamia, Premios); y, aparte y abajo, **Mi finca** (Datos de la finca, Ajustes de la finca, Equipo, Plan). Abajo del todo, fijos, la finca activa y la persona (`MenuUsuario`: Más opciones, Cambiar contraseña, Cerrar sesión). El menú se define **una sola vez en `lib/menu.ts`** (`menuPrincipal`, `menuFinca`, `visibilidadMenu`) y lo dibujan el menú del computador y la lista de «Más»: Hoy y Hato son pestañas de la barra de abajo y no se repiten en «Más», todo lo demás (incluido Leche) sale igual en los dos. Una entrada nueva se agrega solo en `lib/menu.ts`, en el grupo que le toca (`tests/menu.test.mjs` impide escribir entradas a mano en `NavLateral` o en «Más»); un grupo sin entradas para el rol no se muestra. El centro del menú es lo único que se desplaza; arriba (marca y «Al grano») y abajo no.
- **Todo lo que se crea desde la app se puede editar** (decisión del dueño del producto): una pantalla nueva de «crear X» no está terminada sin su
  «Editar X». El formulario de edición reutiliza el de creación con los datos precargados (`FormAnimal` con `animal`), deja vacío lo que la
  persona vacía (nunca conserva el valor anterior en silencio), se envía con `onSubmit` (no `action`) para no borrar lo escrito si hay un error,
  y al guardar vuelve a la ficha con el aviso «Cambios guardados» (`?guardado=1` + `AvisoGuardado`). Lo que no puede cambiar sin dañar datos
  (por ejemplo el sexo de un animal con crías o leche) se muestra bloqueado con la razón, y el servidor lo vuelve a comprobar.
- **Dónde vive cada cosa (decisión del dueño del producto):** lo que mira o hace sobre **todo el hato** (Leche, Endogamia, Simular cruza, Premios, Equipo, Datos de la finca…) es una
  entrada del **menú lateral** (en el celular, de «Más»), y cada entrada **lleva directo** a lo que dice, sin pasos intermedios ni atajos escondidos dentro de otra pantalla.
  Lo que es de **un solo animal** (registrar o corregir su premio, su foto, darlo de baja, su historia) vive **dentro de su ficha**, y al terminar se vuelve a ella. Una lista global
  que enlaza a un animal lo hace al punto exacto (`/hato/<id>#premios`). El menú marca la entrada más específica (`lib/nav.ts`) y se desplaza si la pantalla es baja.
- **Cada pantalla muestra solo lo que aplica al registro que se mira.** Un macho no tiene aptitud, lactancia, ordeño ni último parto: tiene un **uso** (`animales.uso_macho`: reproductor, carne o por definir; `vocacion` de un macho se
  guarda como «carne» solo por ser columna obligatoria y **no se usa**: para un reporte de machos, leer `uso_macho`); un animal que ya salió del hato (vendido, muerto…) no ofrece acciones ni tarjetas de uno activo, como «Ferias y premios» (solo su historial,
  si lo tiene). Antes de dar una pantalla por terminada se revisa con un animal de cada tipo: hembra, macho y dado de baja.
- **Los números se escriben a la colombiana:** coma decimal y punto de miles («3,6», «2.500» = dos mil quinientos). Todo campo numérico que llega del navegador se lee con `leerNumero` (`lib/numeros.ts`), nunca con `replace(",", ".")` (que convertía «25.000» en 25).
- **Todo desplazamiento lateral usa `FilaDesplazable`** (chips, pestañas, filtros): en el celular se desliza con el dedo y **en el computador también se arrastra con el mouse** (`lib/arrastrar-para-desplazar.ts`, ya incluido): solo con mouse, solo si de verdad desborda, un clic corto sigue siendo clic y un arrastre no activa el botón sobre el que se suelta. Un carrusel propio (con `scroll-snap`) llama directamente al gancho `useArrastrarParaDesplazar` y suspende el snap mientras `arrastrando`. Nunca un `overflow-x-auto` suelto.
- Objetivos táctiles ≥ 44 px, campos de 16 px (evita el zoom de iOS), respetar `env(safe-area-inset-*)`.
- Navegación: barra inferior de 4 pestañas + botón central **«Al grano»** (`BottomNav`; en el computador, el botón «Al grano» del menú lateral). Elegir/confirmar/capturar en
  **hojas inferiores** (`Sheet`). Números con el **teclado propio** (`Teclado`), un solo botón principal fijo abajo.
- Listas que pueden crecer: `ListaEscalable` (tramos de 20, paginación en servidor, «Mostrando X de N») y
  `CampoBusqueda`. Nunca un `.map()` sin límite sobre datos que crecen.
- **Listas donde se mezclan cabras, cabros, ovejas y carneros** (`SelectorAnimal`, `SelectorAnimales`): se agrupan con encabezado por tipo (`agruparPorTipo` de `lib/animal.ts` + `EncabezadoLista`), sin emojis. El encabezado solo aparece si hay más de un grupo.
- Mensajes: `Aviso` (info/éxito son una nota; atención/error llevan recuadro sutil), `EstadoVacio` para listas sin
  datos, `useToast()` para confirmaciones pasajeras. Errores técnicos siempre por `mensajeAmigable`. Nada técnico a
  los clientes. Sin emojis decorativos: iconos de trazo fino (lucide). Nunca `<select>`, `confirm`, `alert` ni `prompt`.
- **Opciones como tarjetas (decisión del dueño del producto):** una opción que es un **concepto** (filtro de categoría, pestaña de un módulo, tipo, motivo, uso, vía, resultado…) se muestra como `TarjetaOpcion` (`components/TarjetaOpcion.tsx`): escena con color y un icono que hace referencia al contenido, título, una línea de detalle y, si cabe, un dato (conteo). Una fila de tarjetas va en `FilaTarjetas` (se desplaza de lado en el celular, se acomoda en varias filas desde `lg`); las pestañas de un módulo, con `PestanasTarjetas` + `armarPestanas`; un campo de formulario con pocas opciones fijas (hasta ~10), con `SelectorTarjetas` (mismas props que `Selector` más la `escena` de cada opción). Las escenas viven en `lib/escenas*.ts` (`escena(icono, tono, extra)`; tonos variados dentro de un mismo grupo). Un concepto que se repite en varias pantallas (leche, sanidad, ventas, partos…) usa el vocabulario `ESC` de `lib/escenas.ts` para verse igual en todas; el que se repita por tercera vez entra ahí. **Se quedan como chip o `Selector`**: parámetros y atajos (periodos, Hoy/Ayer, color, grupos del selector de animales), listas largas o dinámicas (razas, municipios, productos, corrales, animales, lotes) y escalas numéricas (condición corporal, plazos, unidades). `TarjetaOpcion` no lleva `"use client"` para poder usarse desde páginas de servidor con `href`; el `onClick` solo desde componentes de cliente. El Hato usa `TarjetasHato` (reemplaza a los chips).
- **Ayuda de un módulo:** cada vista de trabajo del Hato (Ordeño, Ceba, Empadronamiento, Sanidad, Corrales) abre su explicación con «¿Cómo funciona?» (`AyudaModulo`, hoja corta de 4 o 5 ideas de una frase). Los textos viven en `lib/ayuda.ts` y sus números salen de las mismas constantes que usa la app (cupo, días de rotación, cuarentena, FAMACHA, podología); si cambia una regla, se cambia ahí. Nunca párrafos de explicación sueltos en la pantalla; el detalle de un campo va como ayuda bajo el campo.
- **Hojas (`Sheet`) con campos:** el efecto de la hoja depende solo de `abierta` (el `onCerrar` va en una referencia). Si dependiera de `onCerrar`, que casi siempre llega nuevo en cada render, cada letra escrita en un campo de la hoja le quitaría el foco. Una búsqueda dentro de una hoja se prueba escribiendo una palabra completa de corrido.
- Esperas: `Cargando` (isotipo animado), `Esqueleto*` y `loading.tsx` por segmento; un botón que trabaja usa
  `<Boton pendiente cargando="…">`.
- Identidad: lana, musgo y ocre (`globals.css`), Fraunces para títulos y Figtree para interfaz. Nada genérico. **Logo:** el escudo con la oveja, la cabra y el mapa de Colombia (`public/logo.webp`; `Isotipo`/`Marca` en `components/Marca.tsx` lo pintan junto al nombre, y también es el cargador). Los íconos (`app/icon.png`, `app/apple-icon.png`, `public/icon-*.png` del manifiesto) salen de la misma imagen.

## Reglas por módulo (leer antes de tocar el módulo)

El detalle de cada módulo vive en `docs/modulos/`. Léelo antes de cambiar su comportamiento y actualízalo en el mismo commit.

- [`docs/modulos/ajustes-finca.md`](docs/modulos/ajustes-finca.md) — Ajustes de la finca: Ajustes de la finca
- [`docs/modulos/importar-exportar.md`](docs/modulos/importar-exportar.md) — Cargue y exportación de datos: Cargue masivo de animales; Exportar los datos de la finca
- [`docs/modulos/vigencia-plan.md`](docs/modulos/vigencia-plan.md) — Vigencia del plan: Vigencia del plan
- [`docs/modulos/reproduccion.md`](docs/modulos/reproduccion.md) — Reproducción: Empadronamiento
- [`docs/modulos/sanidad-corrales.md`](docs/modulos/sanidad-corrales.md) — Sanidad y corrales: Sanidad; Corrales, instalaciones y rotación
- [`docs/modulos/contabilidad.md`](docs/modulos/contabilidad.md) — Compras, ventas, costos y nómina: Compras, ventas y costos
- [`docs/modulos/reportes.md`](docs/modulos/reportes.md) — Reportes: listados de toda la finca (inventario, reproducción, producción, sanidad), filtros como tarjetas y Excel
- [`docs/modulos/proyecciones.md`](docs/modulos/proyecciones.md) — Proyecciones: simulador mes a mes del hato, el alimento y el dinero (carne y leche), solo propietario y administrador, plan Profesional
- [`docs/modulos/semaforos.md`](docs/modulos/semaforos.md) — Semáforos: lo que pide atención en el hato en rojo, ámbar y verde, por rol; reglas puras en `lib/semaforos.ts`
- [`docs/modulos/referidos.md`](docs/modulos/referidos.md) — Referidos: Referidos
- [`docs/modulos/presentacion-planes.md`](docs/modulos/presentacion-planes.md) — Pantalla de entrada, legales y planes: Pantalla de entrada

## Escribir en varias tablas = una sola transacción

Una acción que debe dejar **varias tablas coherentes** (animal + lactancia, parto + crías + animales de las crías) no encadena llamadas desde el servidor: llama a **una función SQL** (`registrar_animal`, `registrar_parto`, `eliminar_parto`, `registrar_persona`, `agregar_semental_externo`, `quitar_semental`, `eliminar_empadronamiento`, `importar_animales_lote`, `mover_animales`…) que corre con los permisos de quien llama (RLS aplica), comprueba `private.puede_escribir`, es idempotente por `client_request_id` (se mira **antes** de insertar: el índice del arete se revisa primero y escondería el doble toque) y es todo o nada. Un efecto que siempre acompaña a un hecho (la baja cierra la lactancia) va en un **disparador**, no en un segundo paso de la app. Se prueba con una transacción que falla a la mitad y se verifica que no queda nada. **Aplicar migraciones:** la herramienta de Supabase retiene las sentencias que contienen `delete` o `drop` hasta que una persona las confirme y expira sin avisar; esas migraciones las ejecuta el propietario en el Editor SQL, y después se **verifica con una consulta aparte** (nunca dos juntas: solo se ve el resultado de la última) y se registra su versión en `supabase_migrations.schema_migrations`. **El código que usa una función nueva se fusiona solo después de que la función exista en producción.**

## Errores en producción

`instrumentation.ts` registra todo error no controlado del servidor (pantalla, acción o ruta) como **una línea JSON con la marca `[apriscol:error]`** en los registros de Vercel (Runtime Logs: buscar esa marca). `lib/registro-errores.ts` decide qué se escribe: el patrón de la ruta (`/invitacion/[token]`, nunca la dirección real), el tipo, el digest y el mensaje recortado y sin secretos; **nunca** cabeceras, cookies ni datos de formularios. Los errores de base de datos que `mensajeAmigable` traduce para la persona quedan además como `[apriscol]` en `console.warn`. Un error nuevo que haya que seguir de cerca se busca por esas marcas; no se agrega otro registro paralelo.

## Cabeceras de seguridad

`lib/cabeceras-seguridad.ts` define las cabeceras de **toda** respuesta y `next.config.ts` las aplica. Siempre activas: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` y `Permissions-Policy` (sin cámara, micrófono ni ubicación: la app no los usa). La **política de contenido (CSP)** va en modo **solo reportar** mientras `CSP_ENFORZAR = false`: no bloquea nada y cada violación llega a `/api/csp`, que la deja en los registros de Vercel como `[apriscol:csp]` (sin parámetros ni tramos largos de la ruta). Pasar a bloquear de verdad (`CSP_ENFORZAR = true`) solo después de varios días de uso real sin violaciones en esos registros. La política permite lo propio, Supabase (datos y fotos firmadas) y `data:`/`blob:` para la vista previa de una foto; `script-src` y `style-src` llevan `'unsafe-inline'` porque Next incrusta scripts en cada página (quitarlo exigiría nonces por petición). **Un recurso externo nuevo** (otra fuente, un mapa, un script de terceros) se agrega a la política en el mismo cambio. En desarrollo no se manda la política.

## Dependencias

Next, React y `eslint-config-next` van **fijados sin `^`** (suben a propósito, uno por PR, con `tsc`, `lint`, `npm test`, build y una prueba en Chromium de las páginas públicas). Las versiones mayores (TypeScript 7, ESLint 10, `@types/node` 26) no se suben sin un cambio propio. `npm audit` deja **dos hallazgos conocidos y aceptados**: `exceljs` → `uuid` (afecta solo a `uuid` v3/v5/v6 con búfer propio; `exceljs` usa v4, y la «corrección» que propone npm es bajar a `exceljs@3`, que rompe la exportación) y las herramientas de `eslint-config-next` (`micromatch`, `braces`; solo corren al revisar el código, no en producción). Se vuelven a mirar cuando `exceljs` o `eslint-config-next` publiquen una versión corregida.

## Un servidor no puede llamar a un archivo de cliente

Un archivo con `"use client"` solo puede exportar **componentes**: una función normal exportada desde él (por ejemplo, un armador de direcciones)
**revienta en producción** si un componente de servidor la llama («Attempted to call … from the server»), aunque `tsc`, `lint` y `build` pasen. Las
funciones compartidas viven en `lib/`. Los componentes de servidor con consultas (`Historial`, `Registrar`, `Resumen`, `ProgramaLeche`…) aceptan un
`cliente` opcional para ejecutarse en pruebas con una base de mentira en memoria: **una pantalla de servidor se da por buena solo si se ejecutó de
verdad por todas sus ramas** (con datos, vacía, con un animal, con otro periodo), no solo sus piezas de cliente con datos inventados.

## La ficha del animal (`app/(app)/hato/[id]`)

`page.tsx` arma la cabecera, el aviso de retiro, «Datos» y las notas; cada tarjeta restante es un componente de servidor en `fichas/` (`TarjetaLactancia`, `TarjetaReproduccion`, `TarjetaCalidadLeche`, `TarjetaCrecimiento`, `TarjetasGenealogia`, `TarjetaSanidad`, `TarjetaUbicacion`, `TarjetaCostos`, `TarjetaPremios`, `TarjetaSalida`) que **carga sus propios datos** y devuelve `null` si no aplica al rol, plan o estado del animal. Tarjeta nueva ⇒ archivo nuevo en `fichas/` que recibe `c: CtxFicha`, y una línea en `page.tsx`; nunca más consultas apiladas en la página.

## Una sola definición (no se copia lo que ya existe)

Antes de escribir un helper o una regla, buscar si ya existe. Lo que ya tiene casa única:
- **Leer muchas filas:** `lib/consultas.ts` (`leerTodo`, `traerTodo`, `paginar`, `enTramos`). PostgREST corta cada respuesta en 1000: un `.limit(2000)` suelto deja una lista «completa» truncada en silencio y **un conteo o una suma de dinero que sale corta**. Para conteos, sumas y todo lo que decide algo sobre el hato entero se usa `leerTodo` (con un `order` estable); `.limit(N)` solo en listas que se muestran recortadas a propósito. Una consulta de PostgREST **no se reutiliza** entre páginas (cada llamada la arma de nuevo). Nunca otro bucle de páginas.
- **Buscar texto sin tildes:** `lib/texto.ts` (`sinTildes`). **Descargar un Excel:** `lib/archivos.ts` (`respuestaExcel`, `cabecerasExcel`). **Armar un Excel** (título de la hoja, encabezados con color, fechas de Excel, nombre de archivo sin caracteres raros): `lib/excel-estilo.ts` (`escribirTitulo`, `escribirEncabezados`, `aFechaExcel`, `textoFecha`, `limpiarNombreArchivo`); los reportes del hato usan `lib/reportes/excel.ts` y los de costos `lib/reportes-excel.ts`, ambos sobre esos mismos ayudantes.
- **Reglas de seguimiento reproductivo** (parto próximo o atrasado, último tercio, por secar, por confirmar o repetir el diagnóstico, resultado de un servicio): `lib/reproduccion.ts`. **De sanidad** (revisión de pezuñas atrasada, FAMACHA por desparasitar): `lib/sanidad.ts` y `lib/famacha.ts`. El Resumen, la ficha, los programadores y los reportes **llaman** esas funciones; si la regla cambia, cambia ahí y los números nunca se contradicen. Tienen sus pruebas en `tests/compartido.test.mjs`.
- **Días entre fechas:** `diasHasta` / `diasDesde` de `lib/fechas.ts`.

## Verificación antes de dar algo por hecho

`npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run tipos:verificar` · `npm run build` (los cinco corren en el CI) · auditoría de celular de arriba · pruebas de RLS con usuarios
simulados (propietario / ordeñador / ajeno) cuando se toque una política.

## Tipos y espejos TypeScript ↔ SQL

- `lib/tipos.ts` se escribe a mano (más estricto que lo generado: enums y nulos). **`lib/database.types.ts` es lo que genera Supabase** (MCP `generate_typescript_types` o CLI) y `npm run tipos:verificar` compara los dos: falla si una tabla o vista de la app tiene columnas que la base no tiene (o al revés) o un tipo incompatible. Tras una migración que toca columnas: regenerar `database.types.ts`, correr el verificador y alinear `tipos.ts`. Las excepciones deliberadas están en `scripts/verificar-tipos.mjs` con su razón.
- Las reglas que existen en TypeScript **y** en SQL (`estado_plan`, `modulo_rango`, `grupo_rubro`, `sobre_umbral`) tienen su prueba en `tests/espejos-sql.test.mjs` contra `tests/fixtures/espejos-sql.json`, que sale de la base con `tests/fixtures/generar-espejos.sql`. **Si cambia una de esas funciones o su espejo, se regenera el fixture y `npm test` debe pasar.**
