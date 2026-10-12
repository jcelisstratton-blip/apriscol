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
- Navegación: barra inferior de 4 pestañas + botón central de acción (`BottomNav`). Elegir/confirmar/capturar en
  **hojas inferiores** (`Sheet`). Números con el **teclado propio** (`Teclado`), un solo botón principal fijo abajo.
- Listas que pueden crecer: `ListaEscalable` (tramos de 20, paginación en servidor, «Mostrando X de N») y
  `CampoBusqueda`. Nunca un `.map()` sin límite sobre datos que crecen.
- Mensajes: `Aviso` (info/éxito son una nota; atención/error llevan recuadro sutil), `EstadoVacio` para listas sin
  datos, `useToast()` para confirmaciones pasajeras. Errores técnicos siempre por `mensajeAmigable`. Nada técnico a
  los clientes. Sin emojis decorativos: iconos de trazo fino (lucide). Nunca `<select>`, `confirm`, `alert` ni `prompt`.
- Esperas: `Cargando` (isotipo animado), `Esqueleto*` y `loading.tsx` por segmento; un botón que trabaja usa
  `<Boton pendiente cargando="…">`.
- Identidad: lana, musgo y ocre (`globals.css`), Fraunces para títulos y Figtree para interfaz. Nada genérico.

## Empadronamiento (temporada de monta)

Se trabaja en **Hato → filtro «Empadronamiento»** (`/hato?vista=empadronamiento`: crear, agregar hembras, cerrar) y **Reproducción → Empadronamiento** (`/reproduccion?vista=empadronamiento`) es el resumen global con filtros de estado y fechas y con qué hembras se hizo cada temporada. Las hembras se eligen **ya al crear la temporada** (hoja con endogamia por pareja) o después con «Agregar hembras», y **solo entran hembras libres**: sin gestación, sin servicio esperando diagnóstico y fuera de otra temporada abierta (UI, acción y disparador lo exigen). El semental puede ser **del hato o de otro hato** (prestado: `sementales_externos` con chip, hato de origen, dueño, préstamo y sanidad; sin genealogía, así que no hay endogamia que calcular). **Cada semental tiene su número de hembras** (`empadronamiento_machos.num_hembras`, obligatorio): es un **tope exacto** y, al crear la temporada, las hembras elegidas deben ser justo ese número (UI, acción y disparador lo exigen). El máximo recomendado por especie y edad (`capacidadSemental`) solo avisa cuando el número lo supera. La endogamia de una pareja **se calcula y se bloquea antes de asignarla** (`empadronamiento_endogamia`, disparador `emp_hembras_validar`): «llega al umbral» = misma regla que el color «Alta» (`private.sobre_umbral`); solo entra como **excepción registrada**. Al cerrar, cada hembra queda **servida** (monta natural en la fecha base) y de ahí manda `v_repro_hembras`; nunca se guarda una fecha de parto aparte. Una temporada cerrada no se cambia.

## Sanidad (programar y aplicar)

Se **trabaja en Hato → filtro «Sanidad»** (`/hato?vista=sanidad`): programar vacunas, desparasitaciones, tratamientos o podología para los animales que aplican (`programas_sanitarios`), aplicarlos cuando llega el día (`/hato/sanidad/nuevo?programa=…`) y ver las próximas dosis. El menú **Sanidad** es el resumen con filtros de periodo (`FiltroPeriodo`) y de tipo; no registra. A nivel de animal, la ficha ofrece los botones por tipo de tratamiento y «Programar una aplicación». Un programa no guarda su estado: sale de `v_programas_sanitarios` (animales sin `evento_id` = pendientes). Las vistas de trabajo del Hato (Ordeño, Ceba, Empadronamiento, Sanidad, Corrales) se listan una sola vez en `vistasHato` (`lib/hato.ts`) y se pintan con `ChipsHato`.

## Corrales, instalaciones y rotación

Se **trabaja en Hato → filtro «Corrales»** (`/hato?vista=corrales`, `app/(app)/hato/Corrales.tsx`): crear corrales y potreros (`ubicaciones`), mover animales o un lote entero (`/hato/corrales/mover`, función `mover_animales`) y ver alertas. El menú **Corrales** (`/corrales`) es el resumen con filtros de periodo y de motivo, más la pestaña «Movimientos»; no registra. Cada instalación tiene su detalle (`/hato/corrales/<id>`, editable y archivable) y la ficha del animal tiene la tarjeta «Ubicación» (`#ubicacion`). Cada animal tiene **una sola fila abierta** en `movimientos_animales` (`hasta is null`); nada derivado se guarda: ocupación, hacinamiento, estado de rotación y cuarentena salen de `v_ubicaciones` y `v_cuarentena_alerta`. **El hacinamiento avisa, no bloquea** (se puede seguir); un potrero se avisa si está en descanso o debe salir (por defecto 5 días de ocupación máx. y 35 de descanso mín., configurables por potrero); cuarentena: 21 días mínimo, 30 recomendados. Un movimiento no se edita ni se deshace: se registra uno nuevo. Un animal dado de baja cierra su fila (disparador).

## Un servidor no puede llamar a un archivo de cliente

Un archivo con `"use client"` solo puede exportar **componentes**: una función normal exportada desde él (por ejemplo, un armador de direcciones)
**revienta en producción** si un componente de servidor la llama («Attempted to call … from the server»), aunque `tsc`, `lint` y `build` pasen. Las
funciones compartidas viven en `lib/`. Los componentes de servidor con consultas (`Historial`, `Registrar`, `Resumen`, `ProgramaLeche`…) aceptan un
`cliente` opcional para ejecutarse en pruebas con una base de mentira en memoria: **una pantalla de servidor se da por buena solo si se ejecutó de
verdad por todas sus ramas** (con datos, vacía, con un animal, con otro periodo), no solo sus piezas de cliente con datos inventados.

## Verificación antes de dar algo por hecho

`npx tsc --noEmit` · `npm run lint` · `npm run build` · auditoría de celular de arriba · pruebas de RLS con usuarios
simulados (propietario / ordeñador / ajeno) cuando se toque una política.
