# Pantalla de entrada, legales y planes

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia el proceso, se actualiza aquí en el mismo commit.

## Pantalla de entrada

`/login` y `/registro` renderizan `components/presentacion/Presentacion.tsx` (presentación completa con el formulario en la portada). Su contenido describe solo lo que la app hace de verdad y las cifras salen de constantes (`RUBROS`, `REPORTES`); sin precios, planes ni testimonios inventados. Módulo nuevo ⇒ actualizar sus tarjetas ahí.

**Documentos legales:** `/terminos` y `/privacidad` (públicas, en `PUBLICAS` de `lib/supabase/proxy.ts`) usan `components/legal/PaginaLegal.tsx`; su pie (`PieLegal`) lleva los enlaces y, al final y centrada, «Design by © Stratt-On Agency». Los textos describen cómo se protege la información en Supabase (RLS por finca, roles, buckets privados con URL firmada, hash de documentos con Vault): **si cambia una de esas medidas, se actualiza la política y la fecha en `lib/legal.ts`**. El correo de contacto sale de `NEXT_PUBLIC_CORREO_PRIVACIDAD`.

**Planes y precios:** `lib/planes.ts` es la única fuente (4 planes: Cría, Hato, Profesional, Hacienda, con precios en **US$** mientras se define la pasarela; sin plan gratuito; **se cobra por servicios, nunca por número de animales**). **Cada finca tiene su propio plan** (sin tope de fincas): una finca nueva empieza en Cría, desde la segunda finca del propietario el plan tiene 10 % menos (`precioMes(plan, anual, numeroFinca)`, siempre en dólares enteros) y el superadmin activa el plan **de una finca** con `admin_asignar_plan_finca`. Carne y Contabilidad (compras, ventas, personal, costos) son de **Profesional**; `moduloEnPlan` y `private.modulo_rango` deben decir lo mismo. `fincas.plan` manda: `private.puede_ver/puede_escribir` exigen que el plan incluya el módulo (`private.modulo_rango`), y los servicios dentro de un módulo se cierran con `servicioEnPlan` + `<RequierePlan>`. Las funciones de permisos reciben el plan: `puedeVer(rol, "modulo", finca.plan)`. Un módulo o servicio nuevo se asigna a un plan en `lib/planes.ts` **y** en `private.modulo_rango`. «Mejorar mi plan» (`/mas/plan`) solo va hacia adelante; la activación la hace el superadmin (`/admin/planes`, `admin_asignar_plan_finca`) hasta que exista pasarela de pago. Detalle: `docs/PLANES-Y-PRECIOS.md`.

**«Al grano»** (`components/HojaAlGrano.tsx`, antes «Registrar»): una hoja con buscador y filtros (Todo / Registrar / Abrir) que lleva en un toque a todo lo que se puede hacer o abrir en la app. El catálogo está en `lib/atajos.ts` y se filtra por rol y por plan (`atajosPara`). **Pantalla nueva con menú, pestaña o botón de «crear» ⇒ se agrega su atajo ahí** (con su módulo, y su servicio si es de un plan superior); lo que es de un animal sin elegirlo manda al Hato para escoger el animal.

**Portada de entrada:** «Qué cubre» es un carrusel de tarjetas (`components/presentacion/CarruselCubre.tsx`): dedo en el celular; flechas, teclado y arrastre con mouse en el computador.

**Movimiento de la entrada (decisión del dueño del producto, 24 nov 2026):** natural y sutil, nunca coreografiado.
- **Portada y formulario:** cada pieza (escudo, rótulo, titular, texto, lista, sello y la tarjeta de acceso) aparece con **un solo movimiento**: sube 10 px y se aclara en 0,7 s, escalonadas con `--retraso` (`anim-asentar` en `globals.css`, `asentar(ms)` en `Presentacion.tsx`). Es CSS puro: sin JavaScript todo se ve igual. Nada gira ni se dibuja.
- **Formulario (`FormAuth`):** al pasar el mouse, el campo se entibia y su etiqueta toma el musgo (también al enfocar); los enlaces se subrayan de izquierda a derecha (`enlace-suave`); el botón principal se eleva 1 px, su flecha avanza y recibe un brillo leve **una sola vez** al terminar la entrada (`boton-acceso`). El error aparece con un empujón corto (`anim-aviso`) y se esconde mientras se reintenta, para que reaparezca si vuelve a fallar. En el celular no hay efectos de mouse (`hover` solo con mouse).
- **Carruseles («Cubre todo esto» y «Qué puedes anotar sin señal»):** se deslizan solos, **despacio y sin parar** (26 px/s, `lib/desplazamiento-continuo.ts`). Llevan las tarjetas dos veces (la copia con `aria-hidden` e `inert`) y al llegar a la copia vuelven al inicio sin que se note; mueven `scrollLeft`, así que el dedo, el arrastre, la rueda y las flechas siguen funcionando. Se detienen con el mouse encima, al tocar o arrastrar (y 2,5 s después), con el foco del teclado dentro, fuera de pantalla o con la pestaña oculta, y tienen **botón de pausa** (`BotonPausaMovimiento`, obligatorio para lo que se mueve solo). Mientras se mueven no hay ajuste por tarjeta (`snap`); en pausa vuelve.
- **«Reducir movimiento»:** la portada solo aparece, sin desplazarse; los carruseles quedan quietos, sin copia, sin botón de pausa y con su `snap` normal.

**El formulario, a la vista en el celular (24 nov 2026):** en el celular la tarjeta de acceso va **justo después del titular y su texto**, antes de la lista de puntos y el sello (antes había que bajar por toda la lista para llegar a ella), y el escudo es más pequeño (`size-16`). Desde `lg` nada cambia: la lista vuelve a la columna izquierda, debajo del titular, y la tarjeta ocupa la derecha (`lg:col-start-*` / `lg:row-span-2`). El orden del HTML es el del celular, que es también el que leen los lectores de pantalla.

**Mayúsculas activadas (`CampoClave`):** mientras se escribe la contraseña con Bloq Mayús encendido aparece «Mayúsculas activadas» bajo el campo (en ámbar, anunciado con `aria-live`). Sale de la propia tecla (`getModifierState("CapsLock")`), se oculta al salir del campo y en los teclados que no informan Bloq Mayús (la mayoría de los celulares) no aparece. Vale para entrar, crear la cuenta y cambiar la contraseña.

## «Qué resuelve»: sigue el orden del menú

La sección «Qué resuelve» de la pantalla de entrada se arma desde `lib/menu.ts` (mismos grupos y mismo orden: cada día, Producción y manejo,
Dinero y análisis, Genealogía, Mi finca) y los textos de cada opción viven en `lib/presentacion.ts` (`CONTENIDO`). Una opción nueva del menú
sin su texto hace fallar `tests/presentacion.test.mjs`; las que no se describen aparte (`OMITIDAS`) llevan su razón. «Conexión con IA» («Pregúntale a Claude por tu finca») y «Telegram» («Lo que toca hoy, en tu Telegram») **ya se presentan**, para todos los planes; ambas están también en las funciones de Cría. «Productos y terceros» va
como tarjeta propia dentro de «Dinero y análisis». La etiqueta «Desde <plan>» sale de `lib/planes.ts`, y la cifra de reportes suma los listados
del hato (`lib/reportes/catalogo.ts`) y los de costos (`lib/costos-reportes.ts`). Proyecciones se presenta siempre como un cálculo con
supuestos ajustables, nunca como un resultado prometido.

**Opciones que dependen de la especie** (Esquila, solo ovejas): la presentación se arma con `visibilidadMenu("propietario", "hacienda", ["caprino", "ovino"])` — si se armara sin especies, Esquila no aparecería en la entrada. Esquila ya se presenta («Las ovejas de lana, esquiladas a tiempo», Tutorial 30) y está en las funciones del plan Cría.

**Qué más de la entrada sigue al menú (revisado el 3 nov 2026):** la cifra de «secciones en el menú» se cuenta desde `gruposDeFunciones()` (no se escribe a mano); el carrusel «Cubre todo esto» incluye Semáforos e Inventario de bodega; los puntos de la portada, «Quién ve qué» y las preguntas frecuentes mencionan semáforos, medicamentos y alimento. Un módulo nuevo se agrega en esos cuatro sitios, no solo en `CONTENIDO`.


**Precio en dólares y en pesos (18 nov 2026):** los planes de la entrada (login y registro) muestran cada precio en US$ con su equivalente aproximado en pesos colombianos («≈ $ 33.095 COP / mes»), calculado con la TRM del día que lee `pesosPorDolar()` (`lib/pago-manual.ts`, datos.gov.co, caché de 6 horas, respaldo `PESOS_POR_DOLAR`). Si no hay TRM ni respaldo, se ven solo en dólares. Es el mismo cálculo de la pantalla de pago.

## Sin señal en la pantalla de entrada (21 nov 2026)

- **El formulario** (`components/FormAuth.tsx`, entrar y crear cuenta) se envía con `onSubmit`: una contraseña equivocada o un corte de señal ya no
  borran el correo escrito. Sin señal no se puede entrar: lo dice (`SIN_SENAL_ENTRAR` de `lib/campo.ts`) en vez de romper la pantalla.
- **Debajo del formulario de entrada** (`components/SinSenalAcceso.tsx`): si el celular ya quedó listo (tiene la copia de la finca: se entró con señal y no
  se cerró la sesión), un botón «Registrar sin señal · <finca>»; si no, una línea que dice cómo dejarlo listo y lleva a la sección «Sin señal». Si hay
  registros guardados sin enviar, avisa que se envían solos al entrar con la cuenta. Sin conexión, avisa que para entrar hace falta señal.
- **Sección «Sin señal»** (`#sin-senal`, también en la barra de arriba, en la portada y en las preguntas frecuentes): qué se puede anotar (la lista única
  `REGISTROS_SIN_SENAL` de `lib/campo.ts`, una entrada por opción de «Registrar sin señal»: la prueba lo exige), qué necesita señal y cómo se llega en tres
  pasos (dejar listo el celular, abrir Apriscol y tocar «Registrar sin señal» —o «Al grano», o el ícono de la app instalada—, y se envía solo).
- El atajo del ícono de la app (`app/manifest.ts`) y la página «Sin señal» (`public/offline.html`) ya no dicen solo «ordeño y pesos».
- **«Registrar sin señal» en el menú** (primer bloque, después de Hato; en el celular, dentro de «Más»): `lib/menu.ts` (`sinSenal`: quien escribe en ordeño,
  pesos, reproducción, hato, sanidad, corrales o cuentas). En «Al grano» está en la pestaña «Registrar» para esas mismas personas (`menu: "sinSenal"`).
  El paso 2 de la sección dice exactamente eso. También tiene su tarjeta en «Qué resuelve» (`/campo` en `lib/presentacion.ts`).
- **Qué puedes anotar** se muestra como **tarjetas**, con las mismas escenas de «Registrar sin señal» (`ESCENA_OPCION_CAMPO`, `lib/escenas-campo.ts`) y
  un detalle corto (`REGISTROS_SIN_SENAL`), en una fila que se desplaza de lado **en el celular y en el computador** (`FilaTarjetasDeLado`: se desliza
  con el dedo o se arrastra con el mouse). Las tarjetas solo muestran (`TarjetaOpcion` con `estatica`).
- **Plan Cría** (`lib/planes.ts`) dice «Registra sin señal en el corral: animal, ordeño, partos, sanidad y más; se envía solo al volver la señal»: sin señal
  se registra lo de los módulos de cada plan (Cría: animal, ordeño, monta, diagnóstico, parto, sanidad y dar de baja; Hato suma corrales; Profesional,
  pesos, compras y ventas). No se cobra aparte.
