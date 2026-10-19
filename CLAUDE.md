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
- Objetivos táctiles ≥ 44 px, campos de 16 px (evita el zoom de iOS), respetar `env(safe-area-inset-*)`.
- Navegación: barra inferior de 4 pestañas + botón central **«Al grano»** (`BottomNav`; en el computador, el botón «Al grano» del menú lateral). Elegir/confirmar/capturar en
  **hojas inferiores** (`Sheet`). Números con el **teclado propio** (`Teclado`), un solo botón principal fijo abajo.
- Listas que pueden crecer: `ListaEscalable` (tramos de 20, paginación en servidor, «Mostrando X de N») y
  `CampoBusqueda`. Nunca un `.map()` sin límite sobre datos que crecen.
- Mensajes: `Aviso` (info/éxito son una nota; atención/error llevan recuadro sutil), `EstadoVacio` para listas sin
  datos, `useToast()` para confirmaciones pasajeras. Errores técnicos siempre por `mensajeAmigable`. Nada técnico a
  los clientes. Sin emojis decorativos: iconos de trazo fino (lucide). Nunca `<select>`, `confirm`, `alert` ni `prompt`.
- **Opciones como tarjetas (decisión del dueño del producto):** una opción que es un **concepto** (filtro de categoría, pestaña de un módulo, tipo, motivo, uso, vía, resultado…) se muestra como `TarjetaOpcion` (`components/TarjetaOpcion.tsx`): escena con color y un icono que hace referencia al contenido, título, una línea de detalle y, si cabe, un dato (conteo). Una fila de tarjetas va en `FilaTarjetas` (se desplaza de lado en el celular, se acomoda en varias filas desde `lg`); las pestañas de un módulo, con `PestanasTarjetas` + `armarPestanas`; un campo de formulario con pocas opciones fijas (hasta ~10), con `SelectorTarjetas` (mismas props que `Selector` más la `escena` de cada opción). Las escenas viven en `lib/escenas*.ts` (`escena(icono, tono, extra)`; tonos variados dentro de un mismo grupo). **Se quedan como chip o `Selector`**: parámetros y atajos (periodos, Hoy/Ayer, color, grupos del selector de animales), listas largas o dinámicas (razas, municipios, productos, corrales, animales, lotes) y escalas numéricas (condición corporal, plazos, unidades). `TarjetaOpcion` no lleva `"use client"` para poder usarse desde páginas de servidor con `href`; el `onClick` solo desde componentes de cliente. El Hato usa `TarjetasHato` (reemplaza a los chips).
- **Ayuda de un módulo:** cada vista de trabajo del Hato (Ordeño, Ceba, Empadronamiento, Sanidad, Corrales) abre su explicación con «¿Cómo funciona?» (`AyudaModulo`, hoja corta de 4 o 5 ideas de una frase). Los textos viven en `lib/ayuda.ts` y sus números salen de las mismas constantes que usa la app (cupo, días de rotación, cuarentena, FAMACHA, podología); si cambia una regla, se cambia ahí. Nunca párrafos de explicación sueltos en la pantalla; el detalle de un campo va como ayuda bajo el campo.
- **Hojas (`Sheet`) con campos:** el efecto de la hoja depende solo de `abierta` (el `onCerrar` va en una referencia). Si dependiera de `onCerrar`, que casi siempre llega nuevo en cada render, cada letra escrita en un campo de la hoja le quitaría el foco. Una búsqueda dentro de una hoja se prueba escribiendo una palabra completa de corrido.
- Esperas: `Cargando` (isotipo animado), `Esqueleto*` y `loading.tsx` por segmento; un botón que trabaja usa
  `<Boton pendiente cargando="…">`.
- Identidad: lana, musgo y ocre (`globals.css`), Fraunces para títulos y Figtree para interfaz. Nada genérico. **Logo:** el escudo con la oveja, la cabra y el mapa de Colombia (`public/logo.webp`; `Isotipo`/`Marca` en `components/Marca.tsx` lo pintan junto al nombre, y también es el cargador). Los íconos (`app/icon.png`, `app/apple-icon.png`, `public/icon-*.png` del manifiesto) salen de la misma imagen.

## Ajustes de la finca (umbrales que define el propietario)

Los tiempos, límites y criterios zootécnicos **no son constantes del código**: son ajustes de cada finca, en `finca_ajustes` (una fila por finca) y
`finca_ajustes_especie` (una fila por finca y especie: gestación, peso de faena, rangos de grasa y proteína). **Todos los miembros los leen; solo el
propietario los cambia** (RLS propia, no `crear_politicas_finca`: no son un módulo). Se ven y editan en `/mas/ajustes` (`FormAjustes`, un formulario por
grupo con «Volver a los valores sugeridos»). Cada finca tiene **siempre** su fila: la crea un disparador al nacer la finca (`private.ajustes_crear`) y
`asegurar_ajustes_finca` es la red de seguridad. Los valores de fábrica viven **solo en la base** (defaults de columna y `parametros_especie`) y
«restablecer» es `restablecer_ajustes_finca`: nunca se repiten en TypeScript. El umbral de endogamia sigue en `fincas.umbral_endogamia` y las reglas de ceba en
`reglas_ceba`; la pantalla de ajustes solo los enlaza.
- **Ajuste nuevo ⇒** columna con default y `check` en `finca_ajustes` (o en la tabla por especie y su default en `parametros_especie`), la entrada en
  `GRUPOS_AJUSTES` de `lib/ajustes.ts` (de ahí salen el formulario, la validación y la lectura), la función en `restablecer_ajustes_finca` y los tipos en `lib/tipos.ts`.
  Para leerlos en el servidor, `obtenerAjustes()` (`lib/ajustes-servidor.ts`); un componente de cliente recibe lo que necesita por props.
- **No se muestra un ajuste que no hace nada sin decirlo:** los de módulos que aún no existen (alimentación e inventarios, nómina, avisos de vacunas) quedan
  guardados y su grupo lleva una nota («se usarán cuando llegue…»). Al construir el módulo, se quita la nota.
- **No son ajustables a propósito:** el bloqueo por periodo de retiro (es una salvaguarda sanitaria) y todo lo que fija la ley (recargos, retenciones, SMMLV): eso se
  define con su fuente oficial cuando se construya la nómina.
- Conectados hoy: gestación (vistas `v_servicios`, `v_repro_hembras`, `candidatos_ceba`), criterios de la monta, diagnóstico de preñez, último tercio y secado
  (Reproducción), ganancia mínima y peso de faena (Carne), límite de células somáticas y rangos de grasa y proteína (Leche), podología y pediluvio (Sanidad).

## Cargue masivo de animales (Excel)

**Hato → botón de Excel** (`/hato/importar`; también en el estado vacío del Hato y en «Al grano»): para fincas adicionales o hatos que no están en el libro genealógico. Lo puede hacer quien escribe en el Hato, **en todos los planes**. La plantilla (`/hato/importar/plantilla`, `lib/importar-animales-excel.ts`) lleva desplegables con las razas y especies de la finca, una hoja de instrucciones y una hoja «Listas»; **un animal por fila, hasta 500 por archivo, solo animales nuevos** (un arete que ya existe se rechaza: no actualiza). Los títulos de las columnas salen de `COLUMNAS` (`lib/importar-animales.ts`) y se leen sin importar el orden ni las tildes.
- **La validación vive en TypeScript** (`validarFilas`, espejo de `crearAnimal` y de `private.animales_validar`): tipos, listas, fechas, rangos, duplicados (en el archivo y en el hato) y **genealogía por arete** (padre y madre se buscan en el archivo y luego en el hato; sexo, especie, fecha de nacimiento y círculos se revisan). Pantalla en dos pasos: **revisar** (vista previa o lista de filas con error, nada se escribe) y **guardar** (`guardarImportacion` vuelve a leer y validar el archivo: no se confía en lo que revisó el navegador).
- **Guardar es todo o nada** y lo hace `importar_animales_lote(p_finca, p_filas)` (invoker: RLS aplica y exige `puede_escribir(finca, 'hato')`), que inserta **en orden, padres antes que crías** (el disparador exige que el padre ya exista) y abre la lactancia 1 si trae «Fecha del último parto». Un error de la base trae la fila del Excel y el arete.
- **Estado inicial de cada animal** (para que una finca adicional arranque operando): «Número de partos» (`animales.partos_previos`, solo hembras; con fecha de último parto y sin número se toma 1), **servicio y preñez** (`servicios` y, si está confirmada, un `diagnosticos_gestacion` «gestante» con la fecha de hoy; el estado y la fecha prevista salen de `v_repro_hembras`, nunca se guardan; el semental es un macho del archivo o del hato, o un nombre de fuera) y **corral o potrero** (por nombre, con `mover_animales` y motivo «ingreso»; el cupo se valida en TypeScript y lo vuelve a exigir la base). Esas columnas **solo se ofrecen si el rol y el plan lo permiten** (`opcionesImportar`, `lib/importar-animales-servidor.ts`: reproducción, y corrales con al menos una instalación creada); si el archivo las trae sin permiso se rechaza con un mensaje claro. En la base, servicios, diagnósticos y movimientos se registran **después** de crear todos los animales (el semental puede venir más abajo).
- **Desplegables de la plantilla** (hoja «Listas»): especie, sexo, sí/no, origen, aptitud, uso del macho, tipo de servicio y corrales salen de rangos de esa hoja; **«Raza» depende de la especie de su fila** (`INDIRECT` sobre los nombres definidos `Razas_Caprino` y `Razas_Ovino`; con una sola especie, su lista directa). Todo valor de cada lista debe ser aceptado por `validarFilas`: al tocar una lista o una etiqueta, se vuelve a probar la ida y vuelta.
- **Columna nueva en la plantilla ⇒** `COLUMNAS`, su lectura en `interpretarFila`, `FilaParaGuardar` y la función SQL (con migración retrocompatible). El libro genealógico sigue siendo un paso único al crear la cuenta; este cargue no lo toca.

## Exportar los datos de la finca (salida del usuario)

**Más → «Exportar los datos de la finca»** (`/mas/exportar`, también en «Al grano»): el propietario descarga **todo lo de su finca en un Excel** (`/mas/exportar/archivo`; solo `rol === "propietario"` porque incluye personal y pagos), **en todos los planes y aunque el plan esté vencido**: sus datos no se retienen. Se arma con su sesión (la base decide qué ve) y se **envía mientras se escribe** (`ExcelJS.stream`, `lib/exportar-finca-excel.ts`), sin tener el libro entero en memoria; páginas de 1000 porque PostgREST corta ahí.
- **Qué lleva**: `Resumen` (qué hojas y cuántos registros, quién y cuándo), **`Animales` en el formato exacto de la plantilla de cargue** (sirve para llevar el hato a otra finca; trae además estado, fecha de baja, lote y foto) y una hoja por tema (`HOJAS` en `lib/exportar-finca.ts`: corrales, reproducción, leche, sanidad, compras, ventas, personal y pagos, premios, ajustes). Cada id se cambia por lo que la persona entiende (arete, nombre del corral, proveedor…); las demás `*_id`, `created_by`, `updated_by` y `libro_id` no salen. Las fotos y documentos van como **enlaces firmados de 7 días** (`DIAS_ENLACE_ARCHIVO`). **Una hoja que falla no tumba el archivo**: queda en una hoja «Avisos» y en el Resumen.
- **No sale a propósito**: invitaciones (llevan token), solicitudes de plan y de reclamo, comisiones de referidos y quién es miembro (ids de usuario).
- **Tabla nueva con `finca_id` ⇒ agregarla a `HOJAS`** (y sus columnas con tildes a `ETIQUETAS`; una `*_id` nueva que deba verse, a `BUSQUEDA_POR_COLUMNA`; un archivo nuevo, a `ARCHIVO_POR_COLUMNA`). Si una pantalla guarda un dato nuevo del animal, también va en `escribirAnimales`.
- **Pendiente (ya acordado)**: cerrar la finca (solo lectura por un plazo, con esta exportación disponible) y borrarla a pedido con confirmación fuerte; el borrado quita sus filas y su carpeta en Storage.

## Empadronamiento (temporada de monta)

Se trabaja en **Hato → filtro «Empadronamiento»** (`/hato?vista=empadronamiento`: crear, agregar hembras, cerrar) y **Reproducción → Empadronamiento** (`/reproduccion?vista=empadronamiento`) es el resumen global con filtros de estado y fechas y con qué hembras se hizo cada temporada. Las hembras se eligen **ya al crear la temporada** (hoja con endogamia por pareja) o después con «Agregar hembras», y **solo entran hembras libres**: sin gestación, sin servicio esperando diagnóstico y fuera de otra temporada abierta (UI, acción y disparador lo exigen). El semental puede ser **del hato o de otro hato** (prestado: `sementales_externos` con chip, hato de origen, dueño, préstamo y sanidad; sin genealogía, así que no hay endogamia que calcular). **Cada semental tiene su número de hembras** (`empadronamiento_machos.num_hembras`, obligatorio): es un **tope exacto** y, al crear la temporada, las hembras elegidas deben ser justo ese número (UI, acción y disparador lo exigen). El máximo recomendado por especie y edad (`capacidadSemental`) solo avisa cuando el número lo supera. La endogamia de una pareja **se calcula y se bloquea antes de asignarla** (`empadronamiento_endogamia`, disparador `emp_hembras_validar`): «llega al umbral» = misma regla que el color «Alta» (`private.sobre_umbral`); solo entra como **excepción registrada**. Al cerrar, cada hembra queda **servida** (monta natural en la fecha base) y de ahí manda `v_repro_hembras`; nunca se guarda una fecha de parto aparte. Una temporada cerrada no se cambia.

## Sanidad (programar y aplicar)

Se **trabaja en Hato → filtro «Sanidad»** (`/hato?vista=sanidad`): programar vacunas, desparasitaciones, tratamientos o podología para los animales que aplican (`programas_sanitarios`), aplicarlos cuando llega el día (`/hato/sanidad/nuevo?programa=…`) y ver las próximas dosis. El menú **Sanidad** es el resumen con filtros de periodo (`FiltroPeriodo`) y de tipo; no registra. A nivel de animal, la ficha ofrece los botones por tipo de tratamiento, «Programar una aplicación» y, si aplica (animal activo de 3 meses o más), «Evaluación FAMACHA». **FAMACHA** (`evaluaciones_famacha`, puntaje 1 a 5, `/hato/sanidad/famacha/…`): 4 o 5 sin desparasitar desde la evaluación = «Desparasitar», 3 = «Vigilar»; el estado sale de `v_famacha_animal` y el Hato y el resumen ofrecen programar la desparasitación para esos animales. **Pediluvio** es un tipo de tratamiento propio (se registra y programa como los demás, también por corral: el selector de animales suma «los de este corral»). Un programa no guarda su estado: sale de `v_programas_sanitarios` (animales sin `evento_id` = pendientes). Las vistas de trabajo del Hato (Ordeño, Ceba, Empadronamiento, Sanidad, Corrales, Gastos) se listan una sola vez en `vistasHato` (`lib/hato.ts`) y se pintan con `TarjetasHato`.

## Corrales, instalaciones y rotación

Se **trabaja en Hato → filtro «Corrales»** (`/hato?vista=corrales`, `app/(app)/hato/Corrales.tsx`): crear corrales y potreros (`ubicaciones`), mover animales o un lote entero (`/hato/corrales/mover`, función `mover_animales`) y ver alertas. El menú **Corrales** (`/corrales`) es el resumen con filtros de periodo y de motivo, más la pestaña «Movimientos»; no registra. Cada instalación tiene su detalle (`/hato/corrales/<id>`, editable y archivable) y la ficha del animal tiene la tarjeta «Ubicación» (`#ubicacion`). Cada animal tiene **una sola fila abierta** en `movimientos_animales` (`hasta is null`); nada derivado se guarda: ocupación, hacinamiento, estado de rotación y cuarentena salen de `v_ubicaciones` y `v_cuarentena_alerta`. **El hacinamiento se bloquea**: una instalación con capacidad no admite más animales de los que caben (lo exigen `mover_animales`, un disparador sobre `movimientos_animales` y la propia pantalla, que desactiva el botón con el número que falta; la capacidad no puede bajar de los animales que hay hoy). Un potrero sin capacidad no tiene tope. Un potrero se avisa si está en descanso o debe salir (por defecto 5 días de ocupación máx. y 35 de descanso mín., configurables por potrero); cuarentena: 21 días mínimo, 30 recomendados. Un movimiento se **corrige** con «Corregir» (`editar_movimiento`: instalación, fecha de entrada, motivo y nota; no deja fechas cruzadas ni dos filas seguidas en la misma instalación; el cupo solo cuenta si el movimiento sigue abierto). Un animal dado de baja cierra su fila (disparador).

## Compras, ventas y costos (cuentas separadas, todo por selección)

Módulo `contabilidad` (propietario, administrador y **contador**; el contador no ve Sanidad ni Ceba, pero sí sus costos). **Lo que sale y lo que entra se registran
por separado, y el usuario elige de listas en vez de escribir** (decisión del dueño del producto): solo se escribe la cantidad.
- **Catálogos por finca** (`finca_productos`, `finca_terceros`; los lee cualquier miembro, los cambia quien registra compras, ventas, leche o carne; nada se borra, se oculta con
  `activo`). Cada finca nace con su lista sembrada (`private.productos_sembrar`, idempotente: un producto nuevo del catálogo se agrega ahí **y** con una migración que vuelva a
  sembrar). Un producto es de **compra** (con su `rubro` de gasto) o de **venta** (con su `linea`: leche, animales, carne, derivados, subproductos, otros), con su unidad y su
  `precio_habitual`, que se propone y se actualiza solo con el último precio usado (`recordar_precio_producto`, también para quien registra leche o carne). Los de venta
  `automatico` (leche cruda, animal en pie, animal sacrificado) no se ofrecen en el formulario de ventas: entran solos. Se ajustan en **Más → Productos y terceros** (`/mas/productos`).
  Un **tercero** (proveedor, comprador o ambos) se crea una vez desde el propio selector (`SelectorTercero`: escribir su nombre en el buscador → «Agregar»); `crearTercero` nunca duplica
  (compara sin mayúsculas) y, si ya existía para el otro uso, lo pasa a «ambos». El texto libre de antes (`gastos.proveedor`, `despachos_leche.comprador`, `bajas.comprador`) se convirtió en terceros
  elegibles y se conserva como texto (la acción guarda ahí el nombre del elegido, para lo que lo lee).
- **Compras** (`gastos`, Hato → «Compras», `/hato/gastos/nuevo`): grupo → producto de la lista (o «Otra compra», que sigue pidiendo rubro y descripción) → cantidad; el precio habitual viene puesto,
  el total es cantidad × precio, y el proveedor se elige. A quién se carga (finca, especie, corral, lote o animal), por pagar/pagado y factura en `soportes/<finca>/gastos/` siguen igual. El costo
  de cada tratamiento (`eventos_sanitarios.costo`), el del alimento de cada lote (`consumo_lote.costo`) y **la compra de cada animal comprado** (`animales.valor_compra` con `origen = 'comprado'`, en
  `fecha_compra` o, sin ella, el día en que se registró; rubro `compra_animales`, `destino_tipo = 'adquisicion'` para que no entre al costo por animal) se suman con su origen en `private.costos_base`.
  **Riesgo de doble conteo** (comprar concentrado y además cargar el consumo del lote con costo): el Resumen avisa (`costos_posible_doble_conteo`), no lo resuelve solo.
- **Ventas** (Hato → «Ventas», `/hato/ventas/nueva`, tabla `ventas`): producto de venta → cantidad × precio (propuesto) → comprador → «Ya me pagaron» / «Me lo deben» (+ cuándo se espera). La **leche despachada con precio**
  (`despachos_leche`) y los **animales vendidos o sacrificados con valor** (`bajas`) ya son ventas y **no se digitan otra vez**: `private.ventas_base` las suma con su origen (`venta`, `leche`, `animal`). Ambos
  tienen ahora `tercero_id`, `cobrado_en` y `cobro_vence`; **un despacho sin precio no es una venta** (no se cobra). `marcar_cobro_venta` registra el cobro de los tres orígenes sin exigir permiso sobre Leche ni Hato.
  Lo vencido por cobrar sale en Hoy.
- El menú **Costos** (`/costos`) es el resumen con filtros por **cualquier fecha** (`FiltroPeriodo`, incluye «Entre fechas») y pestañas **Resumen, Compras, Ventas, Por animal y Reportes**; no registra. El Resumen separa
  **Compras, Mano de obra, Ventas y Resultado** (ventas − todo lo que costó); `grupoDe`/`GRUPOS_COSTO` (`lib/costos.ts`, espejo de `private.grupo_rubro`) añaden los grupos «Mano de obra» y «Compra de animales» a los cinco de compra.
  La ficha del animal tiene la tarjeta «Costos» (`#costos`) y el valor de compra o reposición (`animales.valor_compra`).
- **Equipo, personal y nómina** (un solo menú **Equipo**, `/mas/miembros`, con pestañas **Equipo** y **Pagos**; `/personal` solo redirige). Lo ve quien gestiona (propietario, administrador) y quien lleva las cuentas (módulo `contabilidad`, incl. contador); los sueldos son sensibles. **Agregar a alguien** es un solo formulario (`FormInvitar`): primero el **perfil** (administrador, ordeñador, veterinario, contador o «Sin acceso a la app» para quien solo trabaja y cobra) y, ya elegido, su **contrato** (`CamposContrato`); `invitar` crea primero la persona (`personal.correo`, `personal.rol`) y luego la invitación, y deshace la persona si la invitación falla. Si el plan no incluye invitar, solo se ofrece «Sin acceso». Corregir a una persona: `/personal/[id]/editar`. `personal` (nombre, cargo, vinculación
  `laboral` | `servicios`, forma de pago `mensual` | `jornal` | `por_servicio`, valor base; **sin documento de identidad**) y `pagos_personal` (cantidad × valor base). Lo que recibe la persona es `valor_pago`; lo que le cuesta a la
  finca es `costo_total` = pago × `factor`, que el disparador `pagos_personal_validar` fija al registrar el pago: el `factor_prestacional` de `finca_ajustes` si es contrato de trabajo, **1** si es prestación de servicios (el navegador
  nunca lo elige y no cambia aunque después cambie el ajuste). A quien está por prestación de servicios **no se registra un pago como hecho sin su PILA** (`soporte_pila`, carpeta `nomina` del bucket `soportes`; lo exige la base y la
  pantalla). **No se inventan tarifas legales** (ni retención, ni horas extras): el único número de ley es el factor que define el propietario en Ajustes. `private.costos_base` suma cada pago como `mano_obra` (origen `nomina`, destino
  `finca`), y **«Mano de obra» ya no es una opción de Compras** (`crearGasto` la rechaza; las compras viejas con ese rubro siguen y `costos_posible_doble_conteo` avisa si coinciden con la nómina). La vinculación de una persona con
  pagos no cambia; si se retira se marca retirada (su historial se conserva).
- Todos los reportes salen de funciones `costos_*` y `ventas_*` (SECURITY DEFINER, validan `puede_ver(finca, 'contabilidad')`). Las funciones **conservan sus columnas** (`costos_indicadores` y `costos_por_mes` siguen
  devolviendo «ingresos de leche» y «de animales», este último = todo lo que no es leche) para no romper el código anterior durante el despliegue. **Excel:** `/costos/exportar?reporte=…&periodo=…` arma el `.xlsx` en el servidor con la sesión
  (`lib/reportes-excel.ts`, `exceljs`): título con finca, reporte, periodo y filtros dentro de la hoja, totales como fórmulas, y el archivo se llama `<finca> - <reporte> - <desde> a <hasta>.xlsx`. Un reporte nuevo se agrega en
  `lib/costos-reportes.ts` y en `construirLibro`.

## Referidos

Cada persona tiene un código (`perfiles.codigo_referido`, 8 caracteres) y un enlace `/registro?ref=CODIGO` (**Más → Referidos**, `/mas/referidos`). El registro guarda el código en los datos del usuario (`ref`) y `private.handle_new_user` lo
convierte en `perfiles.referido_por`; un código que no existe no cuenta, y ni el código ni el referidor se pueden cambiar desde el navegador (disparador `perfiles_proteger_referidos`). **Términos: el 5 % del valor del plan
de la persona referida cada mes durante 6 meses**, contados desde que adquiere un plan: `lib/referidos.ts` es la fuente en la app (`PORCENTAJE_REFERIDO`, `MESES_REFERIDO`, `TEXTO_PROGRAMA`) y `admin_asignar_plan_finca` guarda 5 y 6 en cada
`comisiones_referido` al crearla (una por persona referida, con el plan de la primera activación). El referidor ve solo el primer nombre y el plan (`mis_referidos`); el superadmin ve las comisiones en `/admin/planes`
(`admin_listar_comisiones`). La comisión corre solo sobre el plan de la **primera finca** (la más antigua) de la persona referida. **Si cambian los términos, se cambia en los dos sitios, en `/terminos` y en la pantalla.** La comisión nace solo con la compra de un plan (`admin_asignar_plan_finca`); registrarse o compartir el enlace no paga nada (`TEXTO_SOLO_CON_PLAN`). Pagar la comisión es manual hasta que haya pasarela.

## Un servidor no puede llamar a un archivo de cliente

Un archivo con `"use client"` solo puede exportar **componentes**: una función normal exportada desde él (por ejemplo, un armador de direcciones)
**revienta en producción** si un componente de servidor la llama («Attempted to call … from the server»), aunque `tsc`, `lint` y `build` pasen. Las
funciones compartidas viven en `lib/`. Los componentes de servidor con consultas (`Historial`, `Registrar`, `Resumen`, `ProgramaLeche`…) aceptan un
`cliente` opcional para ejecutarse en pruebas con una base de mentira en memoria: **una pantalla de servidor se da por buena solo si se ejecutó de
verdad por todas sus ramas** (con datos, vacía, con un animal, con otro periodo), no solo sus piezas de cliente con datos inventados.

## Verificación antes de dar algo por hecho

`npx tsc --noEmit` · `npm run lint` · `npm run build` · auditoría de celular de arriba · pruebas de RLS con usuarios
simulados (propietario / ordeñador / ajeno) cuando se toque una política.

## Pantalla de entrada

`/login` y `/registro` renderizan `components/presentacion/Presentacion.tsx` (presentación completa con el formulario en la portada). Su contenido describe solo lo que la app hace de verdad y las cifras salen de constantes (`RUBROS`, `REPORTES`); sin precios, planes ni testimonios inventados. Módulo nuevo ⇒ actualizar sus tarjetas ahí.

**Documentos legales:** `/terminos` y `/privacidad` (públicas, en `PUBLICAS` de `lib/supabase/proxy.ts`) usan `components/legal/PaginaLegal.tsx`; su pie (`PieLegal`) lleva los enlaces y, al final y centrada, «Design by © Stratt-On Agency». Los textos describen cómo se protege la información en Supabase (RLS por finca, roles, buckets privados con URL firmada, hash de documentos con Vault): **si cambia una de esas medidas, se actualiza la política y la fecha en `lib/legal.ts`**. El correo de contacto sale de `NEXT_PUBLIC_CORREO_PRIVACIDAD`.

**Planes y precios:** `lib/planes.ts` es la única fuente (4 planes: Cría, Hato, Profesional, Hacienda, con precios en **US$** mientras se define la pasarela; sin plan gratuito; **se cobra por servicios, nunca por número de animales**). **Cada finca tiene su propio plan** (sin tope de fincas): una finca nueva empieza en Cría, desde la segunda finca del propietario el plan tiene 10 % menos (`precioMes(plan, anual, numeroFinca)`, siempre en dólares enteros) y el superadmin activa el plan **de una finca** con `admin_asignar_plan_finca`. Carne y Contabilidad (compras, ventas, personal, costos) son de **Profesional**; `moduloEnPlan` y `private.modulo_rango` deben decir lo mismo. `fincas.plan` manda: `private.puede_ver/puede_escribir` exigen que el plan incluya el módulo (`private.modulo_rango`), y los servicios dentro de un módulo se cierran con `servicioEnPlan` + `<RequierePlan>`. Las funciones de permisos reciben el plan: `puedeVer(rol, "modulo", finca.plan)`. Un módulo o servicio nuevo se asigna a un plan en `lib/planes.ts` **y** en `private.modulo_rango`. «Mejorar mi plan» (`/mas/plan`) solo va hacia adelante; la activación la hace el superadmin (`/admin/planes`, `admin_asignar_plan_finca`) hasta que exista pasarela de pago. Detalle: `docs/PLANES-Y-PRECIOS.md`.

**«Al grano»** (`components/HojaAlGrano.tsx`, antes «Registrar»): una hoja con buscador y filtros (Todo / Registrar / Abrir) que lleva en un toque a todo lo que se puede hacer o abrir en la app. El catálogo está en `lib/atajos.ts` y se filtra por rol y por plan (`atajosPara`). **Pantalla nueva con menú, pestaña o botón de «crear» ⇒ se agrega su atajo ahí** (con su módulo, y su servicio si es de un plan superior); lo que es de un animal sin elegirlo manda al Hato para escoger el animal.

**Portada de entrada:** «Qué cubre» es un carrusel de tarjetas (`components/presentacion/CarruselCubre.tsx`): dedo en el celular; flechas, teclado y arrastre con mouse en el computador.
