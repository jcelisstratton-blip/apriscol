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
11. **Libro genealógico = única tabla global** (`libro_genealogico`, sin `finca_id`): solo lectura para quien tenga alguna finca, sin
   políticas de escritura. Se llena con `importar_libro_lote` (service_role). Los documentos de titulares nunca se guardan en claro
   (`private.hash_documento`, pepper en Vault) y `libro_titulares` solo la ve el administrador de plataforma. Un animal entra al hato
   únicamente vía `aprobar_reclamo`. Los volcados de datos reales no se versionan.

## Interfaz (móvil primero, referencias de Mobbin)

- Se diseña y se prueba a **360 y 320 px**: `scrollWidth == clientWidth` y ninguna caja con contenido más ancho que ella
  (`[...document.querySelectorAll('body *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')`).
  Rejillas de una columna con `grid-cols-1`; texto largo con `min-w-0` y `overflow-wrap:anywhere`.
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

## Verificación antes de dar algo por hecho

`npx tsc --noEmit` · `npm run lint` · `npm run build` · auditoría de celular de arriba · pruebas de RLS con usuarios
simulados (propietario / ordeñador / ajeno) cuando se toque una política.
