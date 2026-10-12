# Apriscol — contexto del proyecto, por temas

> Cada tema (`## N.`) es **autónomo**: se puede copiar solo esa sección al abrir una sesión nueva sobre ese asunto.
> Las reglas duras del repo están en `CLAUDE.md`; aquí va el contexto, el estado y las decisiones.
> Última actualización: 11 oct 2026 · rama `main` · último commit al escribir esto: `b2b47f5`.
> **Nunca** poner aquí llaves, contraseñas ni datos personales del volcado de ANCO.

---

## 0. Qué es Apriscol y quién lo usa

- **Producto:** gestión integral de un aprisco (cabras y ovejas): hato, genealogía y endogamia, leche, sanidad con periodos de retiro, reproducción, ferias y premios.
- **Modelo:** SaaS **multi-finca** (la finca es el tenant). Un usuario puede tener varias fincas. Pensado **primero para el celular** (patrones de Mobbin).
- **Roles dentro de una finca:** propietario, administrador, ordeñador, veterinario, contador (`private.puede_ver/puede_escribir` por módulo).
- **Superadmin de plataforma:** una persona (hoy `ramces46@gmail.com`) con vista global; no pertenece a ninguna finca. No confundir con el propietario: **el propietario es dueño y administrador de su finca y no le pide permiso a nadie**.
- **Dueño del producto:** Johnny Celis. Trabajar en español neutro (no usar acento paisa), directo y técnico.
- Cuenta del propietario de prueba/real: `ramicelis@gmail.com`, finca **La yulianca** (El Rosal, Cundinamarca), 99 animales activos.

---

## 1. Infraestructura, despliegue y operación

| Pieza | Dato |
|---|---|
| Repo | GitHub `jcelisstratton-blip/apriscol` (privado), rama `main` |
| Hosting | Vercel, proyecto `apriscol` (`prj_2Z7aAs42GSgEVpJkwxDnnnnNcb4w`, equipo `team_8HK13SgNPTknKAXzIxIgEtJR`), región iad1, Node 22 |
| Dominio | `apriscol.shop` (+ `www`), comprado en GoDaddy; DNS A → 216.198.79.1 y 64.29.17.1; certificado emitido |
| Base de datos | Supabase, proyecto `apriscol`, ref `iswkorshpobqhtpekgwl`, región `ca-central-1`, URL `https://iswkorshpobqhtpekgwl.supabase.co` |
| Stack | Next.js 16 (App Router, `proxy.ts` en vez de middleware, **sin** Cache Components), React 19, Tailwind 4, `@supabase/ssr`, zod 4, lucide-react |

**Flujo normal:** cambio en código → `npx tsc --noEmit` · `npm run lint` · `npm run build` → commit y push a `main` → Vercel despliega solo. Verificar el despliegue (estado `READY`) y, ante un error en pantalla, leer los **runtime logs** de Vercel antes de adivinar.

**Migraciones:** siempre archivo en `supabase/migrations/<timestamp>_<descripcion>.sql`, aplicadas a Supabase y con **el mismo timestamp que registra Supabase** (se renombra el archivo después de aplicar). Retrocompatibles: la base cambia antes de que Vercel termine de desplegar.

**Limitaciones del entorno de trabajo de Claude (importante):**
- El sandbox **no llega a `supabase.co`**: nada se prueba contra la base desde el navegador del sandbox; las pruebas de datos se hacen por SQL (MCP de Supabase) simulando usuarios con `request.jwt.claims` y deshaciendo todo con un `raise exception` final.
- El MCP de Supabase **pide confirmación para `DROP`/`DELETE`** y se vence a los 60 s: esos pasos los pega el usuario en el SQL Editor (o se hace con `UPDATE` cuando se puede).
- Desde el sandbox no se puede iniciar sesión en la app: las pantallas autenticadas se auditan con páginas de prueba temporales (se borran) y Playwright a 360 y 320 px.

**Pendientes de configuración (por confirmar con el usuario):**
- Supabase → Authentication → URL Configuration: *Site URL* `https://apriscol.shop` y Redirect URLs (`https://apriscol.shop/**`, `http://localhost:3000/**`).
- Supabase → Auth → Password security: activar *leaked password protection* (aviso del advisor).
- Se pegó una llave `service_role` legacy en el chat: **deshabilitar las llaves legacy** (API Keys → Legacy) y usar solo `sb_secret_…`. Confirmar que se hizo.
- SMTP propio para correos de recuperación/invitación (los límites del SMTP por defecto de Supabase son bajos).

---

## 2. Modelo de datos y seguridad

- **Tenant:** toda tabla de datos lleva `finca_id` y las FK entre tablas de finca son **compuestas** `(x_id, finca_id)`. Permisos desde `finca_miembros` + helpers `private.puede_ver/puede_escribir/puede_gestionar/es_miembro/rol_en`.
- **RLS siempre** (`private.crear_politicas_finca('<tabla>', '<modulo>')`), `grant` solo a `authenticated`. Lo derivado no se guarda (vistas `security_invoker`, columnas generadas, funciones).
- **Funciones `SECURITY DEFINER`:** solo si es imprescindible, `search_path = ''`, validar quién llama y `revoke execute … from public, anon`. Ejemplos vigentes: `coef_endogamia`, `simular_endogamia`, `completitud_pedigri`, `animales_endogamia`, `explicar_endogamia`, `explicar_cruza`, `traer_animales_libro`, `admin_*`.
- **Fechas:** `date`/`timestamptz` y día calendario de Colombia (`lib/fechas.ts#hoyBogota`).
- **Storage:** un bucket por tipo (`fotos-animales`, `soportes`, `premios`) y dentro `<finca_id>/<uuid>.<ext>`; el servidor arma la ruta y firma la subida; buckets privados con URLs firmadas cortas.
- **Tablas principales:** `perfiles`, `fincas`, `finca_miembros`, `invitaciones`, `razas`, `razas_alias`, `animales`, `lactancias`, `ordenos`, `partos`, sanidad y reproducción (esquema fase 1), `ferias`, `participaciones_feria`, y las del libro (`libro_genealogico`, `libro_titulares`, `solicitudes_reclamo`, `intentos_reclamo`, `plataforma_admins`).
- **Qué se muestra según el animal:** un **macho** no tiene aptitud, lactancia ni último parto: el formulario le pregunta **«¿Para qué es este macho?»** (Reproductor · Carne · Por definir, columna `animales.uso_macho`, migración `20261012030315`, solo para machos por restricción de la base) y la ficha muestra ese uso (o «Uso por definir»). `vocacion` de un macho se guarda como «carne» solo porque la columna es obligatoria: **no se usa**; para reportes de machos, leer `uso_macho`. Los machos que ya estaban guardados quedan en «por definir» hasta que se editen. Un animal **dado de baja** no muestra «Ferias y premios» salvo que ya tenga participaciones (queda solo como historial). Los machos que ya estaban guardados con aptitud «leche» no se tocan hasta que se editen.
- **Carne y salida del hato:** la tarjeta «Salida del hato» muestra **«Carne: para consumo»** cuando el animal salió por sacrificio o por venta a consumo (la base rechaza ambos si está en retiro de carne) y **«Carne: no apta para consumo»** cuando murió. Una venta sin consumo o una pérdida no muestran ese renglón.
- **Editar finca (`/mas/finca`):** enlace «Editar datos de la finca» en «Más» (propietario y administrador). Reutiliza `FormFinca` con los datos precargados; la acción `editarFinca` cambia nombre, departamento, municipio, propósito y especies de la finca activa. Una especie con animales registrados (activos o dados de baja) no se puede quitar: el botón sale bloqueado y el servidor lo vuelve a comprobar. Probado en la base: la propietaria actualiza, alguien ajeno no (RLS). El umbral de endogamia se edita aparte, en `/hato/endogamia`.
- **Editar animal (`/hato/[id]/editar`):** botón «Editar» en la ficha (propietario y administrador). Reutiliza `FormAnimal` con los datos precargados; la acción `editarAnimal` guarda todo lo editable (arete, microchip, nombre, raza, color, marcas, rasgos, nacimiento, origen, peso al nacer, aptitud, padre y madre —incluidos los que ya salieron del hato—, padres externos y notas) y lo vacío queda vacío. **Sexo y especie** solo cambian si el animal no tiene crías, lactancias, ordeños ni partos (`lib/animal-historia.ts`; al tener reproducción con interfaz hay que sumar servicios, celos y diagnósticos). La acción impide ciclos genealógicos (un animal no puede quedar como padre o madre de alguno de sus ancestros), porque la base no los impide. El arete y el microchip repetidos los rechaza la base con mensaje claro. Un animal que viene del libro avisa que su pedigrí oficial no cambia al corregir padre o madre aquí. Regla del producto: **todo lo que se crea se puede editar** (ver `CLAUDE.md`).
- **Formulario «Animal nuevo» (`FormAnimal`):** en secciones (Identificación, Cómo es, Nacimiento y origen, Producción, Genealogía, Notas) y en dos columnas desde `lg`. Además de lo básico pide **microchip** (único por finca), **color** (texto libre con atajos de los colores más frecuentes del libro: blanco, chamoisée, negro, crema…), **marcas** (chapeta, muesca, collar: así las usa el libro), **rasgos** (señas particulares), **peso al nacer** (0,1–15 kg; solo si nació en la finca) y **notas**. Datos del libro revisados: color 98 %, marcas 72 %, rasgos 12 %; el peso al nacer y el tipo de parto **no** vienen en el libro. La «concepción» del libro (MD/IA/TE/MDG) sigue sin pasar al hato: `animales` no tiene columna para ella.
- **Bajas de animales (ya con interfaz):** la tabla `bajas` (venta, sacrificio, muerte o pérdida, con fecha, motivo, comprador, valor, destino de consumo y notas) aplica sola el estado y `fecha_baja` del animal (`private.baja_aplicar`), rechaza sacar para consumo a un animal en retiro de carne y una segunda baja del mismo animal; borrar la baja la deshace. Pantalla: ficha del animal → tarjeta «Salida del hato» → «Dar de baja» (`/hato/[id]/baja`, `FormBaja`); acciones `darDeBaja` y `deshacerBaja` en `app/(app)/hato/actions.ts`. Si es una hembra en ordeño, `darDeBaja` cierra su lactancia con la fecha de la baja. «Deshacer la baja» (solo propietario o administrador) devuelve el animal al hato, pero **no reabre la lactancia**: se agrega de nuevo desde Leche. La lista del hato tiene el filtro «Dados de baja». Sin migraciones nuevas.
- **Migraciones aplicadas (en orden):** nucleo_multitenant · hato_y_genealogia · sanidad · reproduccion · leche · permisos_y_storage · indices_y_vistas · modulo_ferias · ferias_y_premios · libro_genealogico · libro_funciones · propietario_autonomo · (cerrar_libro_y_retirar_aprobacion, aplicada a mano) · endogamia_finca · verificacion_titular · traer_animales_una_vez · panel_superadmin · explicar_endogamia.

---

## 3. Cuentas, acceso y roles

- **Archivos:** `app/login`, `app/registro`, `app/recuperar`, `app/cambiar-clave`, `app/auth/confirm`, `app/invitacion/[token]`, `app/onboarding`, `proxy.ts`, `lib/supabase/*`, `lib/contexto.ts`, `lib/permisos.ts`.
- **Flujos:** registro con confirmación por correo · recuperar y cambiar contraseña (misma respuesta exista o no la cuenta) · invitaciones por token con rol · selector de finca activa (`perfiles.finca_activa_id`).
- **Sin finca:** `obtenerContexto()` manda a `/onboarding` (crear finca); **si es superadmin, a `/admin`**.
- **Superadmin:** fila en `plataforma_admins`. Hoy: `ramces46@gmail.com`. `ramicelis@gmail.com` es un propietario normal (se corrigió un correo mal escrito del inicio: el usuario original pasó a `ramicelis`, y `ramces46` se registró aparte y heredó el rol de superadmin con un `UPDATE`).
- **Cambiar correo de un usuario por SQL:** hay que actualizar `auth.users.email`, `raw_user_meta_data.email` y `auth.identities.identity_data.email`.

---

## 4. Libro genealógico (datos de ANCO) e importación

- **Fuente:** volcado MariaDB `anco_registro` (6.634 filas, ~3 MB, charset latin1 con caracteres dañados). **Contiene cédulas/NIT reales: jamás se versiona** (`.gitignore` excluye `*.sql` fuera de migraciones y `anco_registro*`).
- **Por qué existe una tabla global:** los pedigríes cruzan criaderos (el padre suele ser de otro dueño), así que la genealogía vive en `libro_genealogico` (sin `finca_id`). **Ninguna finca la lee**: solo el superadmin (política RLS) y las funciones `security definer`.
- **Documentos:** nunca en claro. `libro_titulares` guarda HMAC-SHA256 (`private.hash_documento`, pepper en Vault `apriscol_pepper_documentos`) + últimos 4 dígitos. NIT se prueba con y sin dígito de verificación.
- **Importador:** `scripts/importar-libro/` (`limpieza.mjs` parsea y limpia; `importar.mjs` simula o envía). Se corre **en el computador del usuario** con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (llave solo en la terminal). Simulación por defecto; `--enviar` manda lotes de 200 a `importar_libro_lote` y llama `resolver_padres_libro`.
  - PowerShell: `$env:SUPABASE_URL="…"` y `$env:SUPABASE_SERVICE_ROLE_KEY="…"`; requiere `npm install` antes (usa `@supabase/supabase-js`).
- **Resultado cargado:** 6.632 animales (4.143 caprinos · 2.489 ovinos; 6.284 vivos · 348 baja), 368 titulares, 1.682 padres y 1.733 madres enlazados, 0 ciclos, 2 rechazados (registros 6914 y 6982: sexo inválido sin pistas), 1 sin raza (ETIOPE caprino).
- **Lección:** `resolver_padres_libro` se cortó por *statement timeout* en la última etapa; los pasos de enlace se corrieron por SQL aparte. Si hay que repetir, hacerlo por etapas.
- **Razas:** 13 razas nuevas + 26 alias (`razas_alias`) para normalizar nombres.
- **Qué NO pasa al hato del propietario:** prefijo, puntaje de fundadores, libro (FUNDADORES/PURO DE ORIGEN…), composición, concepción. Sí pasan: nombre, microchip (queda como `numero_arete`), raza, sexo, nacimiento, color, rasgos, marcas, padre/madre, estado, observaciones.

---

## 5. «Traer mis animales» (paso único) y verificación de propiedad

- **Regla de producto:** el propietario trae sus animales **una sola vez, al crear la cuenta**; después los nuevos los registra él a mano. No hay aprobación del superadmin.
- **Flujo:** crear finca → `/onboarding/animales` (traer u omitir) → se cierra con `perfiles.libro_resuelto_en`. Cuentas existentes quedaron cerradas. Fallback: el botón del hato vacío aparece solo mientras el paso siga pendiente. El servidor rechaza traer si ya está cerrado.
- **Garantía de que solo recibe lo suyo** (`traer_animales_libro(p_finca, p_documento, p_chip)`): hace falta el **documento del titular y el microchip de uno de sus animales**; misma respuesta si falla cualquiera. Límites: 10 intentos/hora por persona, 30 fallidos/hora por titular, máximo 3 documentos distintos por cuenta. Queda constancia en `solicitudes_reclamo` (estado `aprobada`).
- **Reversión:** el superadmin puede revertir una importación (`admin_revertir_importacion`: marca los animales como eliminados y deja la solicitud en `cancelada`).
- **Reabrir el paso:** `select public.admin_reabrir_traer_animales('correo');` (solo superadmin, desde el SQL Editor).
- **Archivos:** `app/(app)/libro/actions.ts` (`traerAnimales`, `finalizarTraerAnimales`), `app/onboarding/animales/page.tsx`, `components/FormTraerAnimales.tsx`, `app/onboarding/actions.ts`.
- **Historia:** primero se diseñó con reclamos + aprobación del superadmin; el usuario lo descartó (el propietario no pide permiso). Las funciones `solicitar_reclamo`, `aprobar_reclamo` y `rechazar_reclamo` ya no existen.

---

## 6. Endogamia y genealogía

- **Cálculo (Wright, método tabular):** `coef_endogamia(animal)` usa el pedigrí completo (hasta **10 generaciones** en el hato, **12** en el libro). Si el animal viene del libro, se usa el grafo del libro aunque los padres estén en otra finca. Sin ambos padres no hay medida (la UI dice "sin datos", no "0 %").
- **Completitud del pedigrí** (`completitud_pedigri`): sobre 4 generaciones, para saber cuánto confiar en F. Un F bajo con pedigrí corto significa "mínimo", no "nulo".
- **Escala (relativa al umbral de la finca, `fincas.umbral_endogamia`, por defecto 6,25 %):** baja < ½ umbral · a vigilar < umbral · alta < 2× · muy alta. El umbral se edita desde `/hato/endogamia` (Estricto 3,13 % · Estándar 6,25 % · Flexible 12,5 %).
- **Pantallas:**
  - Ficha del animal: F + nivel + pedigrí conocido, fila "Parentesco de sus padres" y tarjeta "¿Por qué hay endogamia?".
  - `/hato/endogamia`: resumen y lista de mayor a menor F; cada animal se despliega con su origen.
  - `/hato/cruza`: simulador macho × hembra (misma finca y especie) con recomendación y explicación.
- **Explicación por rutas** (`explicar_endogamia`, `explicar_cruza`; `private.explicar_pares`): F = Σ (½)^(n1+n2+1)·(1+F_ancestro) sobre pares de rutas disjuntas padre→ancestro y madre→ancestro. **Los aportes suman exactamente F** (verificado en los 5 animales con endogamia de La yulianca). Las rutas se muestran con **identificador original (microchip) + nombre** de cada animal.
- **Parentesco entre padres** (`describirParentesco` en `lib/endogamia.ts`): medios hermanos, hermanos completos, padre e hija, tío y sobrina, primos hermanos, etc., deducido de las rutas al ancestro principal.
- **Ejemplo real:** CAROLINA `605*564*832` (12,50 %): sus padres TORBELLINO y MARIPOSA son medios hermanos por TROYANO.
- **Archivos:** `lib/endogamia.ts`, `components/{NivelEndogamia,RutasEndogamia,OrigenEndogamia,ListaEndogamia,UmbralEndogamia,FormCruza}.tsx`, `app/(app)/hato/{[id],endogamia,cruza}`.
- **Código sobrante:** `ancestros_comunes(...)` (SQL) ya no se usa en la UI; se puede eliminar en una migración de limpieza.

---

## 7. Leche (lactancias y ordeño)

- **Modelo:** `lactancias` (una abierta por animal; `fecha_parto`, `fecha_secado`, número) y `ordenos` (por animal, fecha y jornada mañana/tarde/noche; litros ≤ 15; descarte). La leche de un animal **en retiro** se marca sola como descartada. Un parto de hembra lechera cierra y abre lactancia (trigger).
- **Problema encontrado:** solo aparecen en el ordeño las hembras con lactancia abierta, y las importadas no tenían ninguna.
- **Solución (`AgregarAlOrdeno`):** botón en `/leche` (y "Poner en ordeño" en la ficha) para elegir hembras en leche y la **fecha aproximada del último parto**; abre sus lactancias (`ponerEnOrdeno`). "Ya no está en ordeño" (`sacarDelOrdeno`) cierra la lactancia.
- **Captura:** `CapturaLeche` — hoja con teclado numérico por animal, salto al siguiente, jornada y día (hoy/ayer).
- **Vigilancia de la producción (baja inesperada):** funciones de solo lectura `produccion_tendencia(p_finca, p_hoy)` y `produccion_habitual(p_finca, p_hoy)` (migración `20261012025223`, `security invoker`, respetan RLS; nada se guarda). Por cada hembra en lactancia compara el promedio diario de los **últimos 3 días completos** con el de los **7 días anteriores**: baja ≥ 20 % → «Baja producción» (alerta), ≥ 35 % → «Revisar ya» (crítico). Solo cuentan días **completos** (con las jornadas que ese animal suele ordeñarse; hoy no cuenta), así un ordeño sin registrar no parece una caída; exige 4 días de base, 2 recientes y ≥ 0,3 L/día. Una caída natural de la lactancia (≈10 %) no alerta. Con menos historia devuelve `sin_datos` (hacen falta unos 6 días de ordeño). `produccion_habitual` da lo que cada animal produce por jornada (7 días, mínimo 3 registros). **Dónde se ve:** tarjeta «hembras con la producción bajando» en **Hoy** (hasta 5) y en **Leche** (todas); marca «Baja producción»/«Revisar ya» en cada fila del ordeño; al registrar litros, el aviso «Es bastante menos de lo habitual en esta jornada» si lo escrito es ≤ 70 % de lo habitual, y la nota de tendencia; en la **ficha** de la hembra, el aviso con el consejo (salud, alimentación y agua, celo o estrés) y un gráfico de los últimos 14 días con el promedio de referencia. Archivos: `lib/produccion.ts`, `components/{AlertasProduccion,GraficoProduccion}.tsx`. Probado en la base con casos construidos (baja 40 %, 25 %, estable, 10 %, pocos días, día incompleto) y permisos (propietaria sí, ajeno no, anon no); todo revertido. Umbrales fijos en la función (20 %/35 %); si hace falta, volverlos configurables por finca.
- **Archivos:** `app/(app)/leche/{page,actions}`, `components/{CapturaLeche,AgregarAlOrdeno}.tsx`.
- **Lista de ordeño:** `CapturaLeche` tiene buscador (`CampoBusqueda`, desde 8 hembras) y dibuja por tramos de 20 con `ListaPorTramos` (hermana de `ListaEscalable` para listas ya completas en el cliente: el progreso y los totales necesitan todos los animales). «Guardar y siguiente» se queda dentro de lo que la búsqueda muestra.
- **Fecha de parto por animal:** `AgregarAlOrdeno` usa una fecha general y deja cambiarla en la fila de cada hembra elegida; `ponerEnOrdeno` recibe `{ animales: [{ animalId, fechaParto? }], fechaParto? }`.
- **Por hacer:** registrar partos desde la UI.

---

## 8. Ferias y premios

- Módulo `ferias`: ferias (`nivel` local→internacional) y participaciones por animal (resultado, puesto, puntaje, premio, **foto del premio** en el bucket `premios`), vista `v_palmares_animal`, palmarés en la ficha.
- **Editar y eliminar una feria (`/ferias/[id]/editar`):** botón «Editar» en el detalle de la feria (propietario y administrador). Reutiliza `FormFeria` con los datos precargados (`editarFeria`; lo vacío queda vacío; el mismo nombre con la misma fecha de inicio lo rechaza la base con mensaje claro). Al pie, «Eliminar esta feria» pide confirmar y dice cuántas participaciones se pierden: `eliminarFeria` borra la feria, sus participaciones en cascada y las fotos de sus premios en Storage (si el borrado de fotos falla, solo queda un archivo suelto). Probado en la base: la propietaria edita y elimina (cascada); una persona ajena no ve, ni edita, ni elimina. - **Editar y eliminar un premio (`/ferias/participacion/[id]/editar`):** «Editar» en cada premio, tanto en la feria como en la ficha del animal (propietario y administrador). Reutiliza `FormParticipacion` con los datos precargados y la foto actual (`FotoPremio` con `inicial`; se puede cambiar o **quitar**). `editarParticipacion` permite cambiar feria, animal, categoría, resultado, premio y foto (nada se limpia en silencio); la categoría repetida en la misma feria la rechaza la base. Si la foto cambia o se quita, el archivo viejo se borra de Storage; `eliminarParticipacion` pide confirmar y borra también la foto. Probado en la base: edición, categoría repetida y ruta de foto de otra carpeta rechazadas, política de borrado (propietario/administrador).
- **Departamento y municipio dependientes:** `components/CamposUbicacion.tsx` (usado en `FormFeria` y `FormFinca`). El municipio solo ofrece los del departamento elegido (`lib/municipios.ts`: 1.121 municipios y áreas no municipalizadas de los 32 departamentos y Bogotá, contrastados con la DIVIPOLA del DANE), se vacía si el departamento cambia y queda deshabilitado hasta elegir departamento; un municipio escrito a mano antes se conserva como opción. `Selector` agrega un buscador (sin distinguir tildes) cuando hay más de 12 opciones. La finca suma «Vereda» opcional. Probado en el navegador a 1440, 360 y 320 px.
- **Ferias y premios viven en el animal (decisión del dueño del producto):** no hay entrada «Ferias y premios» en el menú lateral, la barra inferior, el botón «Registrar» ni «Más»; `/ferias` redirige a `/hato` y se quitó la pantalla «Feria nueva». Todo parte de la **ficha del animal** (tarjeta «Ferias y premios», solo si está activo o ya tiene historial): «Registrar premio» → `/ferias/participacion/nueva?animal=…` (sin animal, vuelve al hato; el animal viene fijo, no se elige). Al guardar, editar o eliminar un premio se vuelve a la ficha. Tocar un premio en la ficha abre el detalle de su feria (`/ferias/[id]`, con «Editar» la feria y «Eliminar»), cuyos animales enlazan de vuelta a su ficha.
- **Lo que importa es el premio:** el formulario del premio (`FormParticipacion`) empieza por la **foto del premio** (siempre visible), luego resultado, premio recibido y en dinero, categoría, puesto/puntaje y feria. Si la feria no está en la lista, «Registrar una feria nueva» pide en el mismo formulario nombre, alcance, departamento, municipio y fecha (`CamposFeria`); `crearParticipacion` crea la feria o reutiliza la del mismo nombre y fecha. De la feria ya no se piden «Hasta» ni «Organizador» (las columnas siguen en la base y lo ya guardado se muestra, pero ningún formulario los toca). Sin ferias registradas, el premio ya abre en «feria nueva».
- **Foto del animal:** `FotoAnimal` (sección «Foto» al inicio de «Animal nuevo» y de «Editar animal», opcional) sube a `fotos-animales` con el mismo mecanismo que el premio (`SubirFoto`; `prepararSubidaFotoAnimal` arma la ruta `<finca>/<uuid>.<ext>` y exige el módulo `hato`). Se muestra en la cabecera de la ficha (toque para ampliar). Al cambiarla o quitarla se borra el archivo viejo. Migración `20261012034902_fotos_animales_politicas` (ver, subir y borrar acotados a la carpeta de la finca; probado con propietario, persona ajena y `anon`).
- **Archivos:** `app/(app)/ferias/*`, `components/{FormFeria,CamposFeria,SubirFoto,FotoAnimal,FormParticipacion,FotoPremio,FilaParticipacion,VisorFoto}.tsx`, `lib/ferias.ts`, `lib/fotos.ts`.
- **Sin verificar con sesión real:** la subida de fotos desde el navegador (premio y animal) y la limpieza de fotos huérfanas; guardar un premio con feria nueva. Lo probado: políticas de Storage en la base y el comportamiento de los formularios en el navegador.

---

## 9. Panel del superadmin

- **Espacio propio** `app/(admin)` (layout con navegación Resumen · Fincas · Importaciones, "Mi finca" si además tiene una; cerrar sesión). Guardia: quien no es superadmin vuelve a `/`.
- **Resumen** (`admin_resumen`): usuarios (y nuevos 30 días), sin finca, fincas, animales activos, litros 7 días, libro total vs. en fincas, importaciones.
- **Fincas** (`admin_listar_fincas`): propietario, correo, animales activos, personas; buscador.
- **Importaciones:** quién trajo qué (documento terminado en últimos 4 dígitos), filtros Recientes/Revertidas, botón revertir.
- **Más** muestra "Panel superadmin" solo a superadmins con fincas.
- **Error ya corregido:** una página de servidor pasaba un botón con `onClick` a un componente de cliente (los filtros de Importaciones); ahora son enlaces.

---

## 10. Interfaz y convenciones (resumen; el detalle está en `CLAUDE.md`)

- **Móvil primero:** se prueba a **360 y 320 px** (`scrollWidth == clientWidth` y sin cajas desbordadas); rejillas de una columna con `grid-cols-1`; texto largo con `min-w-0` y `[overflow-wrap:anywhere]`; objetivos táctiles ≥ 44 px; campos de 16 px; `env(safe-area-inset-*)`.
- **Componentes:** `Sheet` (hojas inferiores), `Selector` (nunca `<select>`), `Segmentado`, `Teclado`, `Aviso` (info/éxito = nota; atención/error = recuadro), `EstadoVacio`, `useToast`, `Cargando`/`Esqueleto*`, `Boton pendiente`, `ListaEscalable` + `CampoBusqueda` para listas que crecen, `FilaDesplazable` (filas horizontales; las que desbordan a propósito son válidas).
- **Textos:** nada técnico al cliente; errores por `mensajeAmigable`; sin emojis decorativos (iconos lucide de trazo fino); nunca `confirm/alert/prompt`.
- **Computador:** desde 1024 px hay menú lateral fijo (`NavLateral`: Hoy, Hato, Leche, Ferias, Equipo según el rol; botón «Registrar»; finca activa; cuenta) en lugar de la barra inferior, y el contenido ocupa hasta `max-w-5xl`/`6xl`. Hoy y la ficha del animal van en 2 columnas, el hato en 2–3, Leche en dos paneles (controles y resumen a la izquierda, lista a la derecha), y los formularios con ancho cómodo. En celular y tablet vertical no cambia nada. La hoja «¿Qué vas a registrar?» es compartida (`HojaRegistrar`).
- **Identidad:** lana, musgo y ocre; Fraunces para títulos, Figtree para interfaz.
- **Trampas conocidas:** (1) un componente de servidor no puede pasar funciones (`onClick`) a uno de cliente; (2) `setState` síncrono dentro de `useEffect` rompe el lint (usar estado derivado o actualizar tras un `await`); (3) tras borrar rutas hay que limpiar `.next` antes de `tsc`; (4) no usar `pkill -f` (mata el propio shell).
- **Verificación antes de dar algo por hecho:** `npx tsc --noEmit` · `npm run lint` · `npm run build` · auditoría de celular · pruebas de RLS con usuarios simulados cuando se toque una política.

---

## 11. Estado de los datos hoy

- Usuarios: 2 (`ramicelis@gmail.com` propietario · `ramces46@gmail.com` superadmin).
- Fincas: 1 (La yulianca) con 99 animales activos (98 del libro + 1 de prueba "123 · primer animal").
- Libro: 6.632 animales cargados; 98 reclamados.
- Endogamia en La yulianca: 42 animales medibles, 5 con F > 0, máximo 12,5 %.
- Ordeño: ya se están registrando litros.

---

## 12. Pendientes y backlog

**Ya acordado o en el aire**
- Confirmar configuración de Auth (URLs, protección de contraseñas filtradas, SMTP) y deshabilitar llaves legacy (ver tema 1).
- Eliminar `ancestros_comunes` (SQL) si ya no se usa.

**Módulos sin interfaz todavía**
- **Sanidad** (tratamientos, vacunas, periodos de retiro: el esquema y la regla "un animal en retiro no entra al tanque ni sale para consumo" ya existen en la base).
- **Reproducción / partos** (servicios, gestación, parto con cría y apertura automática de lactancia).
- **Pesos / GDP**, nutrición, ambiente (ITH) y contabilidad (módulos previstos en `modulo_app`).
- **Modo sin conexión** para el ordeño en el campo.
- Verificar con sesión real: subida de fotos, limpieza de fotos huérfanas.

**Ideas surgidas en la conversación (no pedidas aún)**
- Mostrar en cada fila de la lista de endogamia, sin desplegar, el ancestro principal ("por TROYANO").
- Botón del superadmin para reabrir "traer mis animales" (hoy es una función SQL).
- Segundo dato de verificación más fuerte para reclamar animales si el riesgo de suplantación crece.
