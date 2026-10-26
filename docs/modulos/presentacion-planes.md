# Pantalla de entrada, legales y planes

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia el proceso, se actualiza aquí en el mismo commit.

## Pantalla de entrada

`/login` y `/registro` renderizan `components/presentacion/Presentacion.tsx` (presentación completa con el formulario en la portada). Su contenido describe solo lo que la app hace de verdad y las cifras salen de constantes (`RUBROS`, `REPORTES`); sin precios, planes ni testimonios inventados. Módulo nuevo ⇒ actualizar sus tarjetas ahí.

**Documentos legales:** `/terminos` y `/privacidad` (públicas, en `PUBLICAS` de `lib/supabase/proxy.ts`) usan `components/legal/PaginaLegal.tsx`; su pie (`PieLegal`) lleva los enlaces y, al final y centrada, «Design by © Stratt-On Agency». Los textos describen cómo se protege la información en Supabase (RLS por finca, roles, buckets privados con URL firmada, hash de documentos con Vault): **si cambia una de esas medidas, se actualiza la política y la fecha en `lib/legal.ts`**. El correo de contacto sale de `NEXT_PUBLIC_CORREO_PRIVACIDAD`.

**Planes y precios:** `lib/planes.ts` es la única fuente (4 planes: Cría, Hato, Profesional, Hacienda, con precios en **US$** mientras se define la pasarela; sin plan gratuito; **se cobra por servicios, nunca por número de animales**). **Cada finca tiene su propio plan** (sin tope de fincas): una finca nueva empieza en Cría, desde la segunda finca del propietario el plan tiene 10 % menos (`precioMes(plan, anual, numeroFinca)`, siempre en dólares enteros) y el superadmin activa el plan **de una finca** con `admin_asignar_plan_finca`. Carne y Contabilidad (compras, ventas, personal, costos) son de **Profesional**; `moduloEnPlan` y `private.modulo_rango` deben decir lo mismo. `fincas.plan` manda: `private.puede_ver/puede_escribir` exigen que el plan incluya el módulo (`private.modulo_rango`), y los servicios dentro de un módulo se cierran con `servicioEnPlan` + `<RequierePlan>`. Las funciones de permisos reciben el plan: `puedeVer(rol, "modulo", finca.plan)`. Un módulo o servicio nuevo se asigna a un plan en `lib/planes.ts` **y** en `private.modulo_rango`. «Mejorar mi plan» (`/mas/plan`) solo va hacia adelante; la activación la hace el superadmin (`/admin/planes`, `admin_asignar_plan_finca`) hasta que exista pasarela de pago. Detalle: `docs/PLANES-Y-PRECIOS.md`.

**«Al grano»** (`components/HojaAlGrano.tsx`, antes «Registrar»): una hoja con buscador y filtros (Todo / Registrar / Abrir) que lleva en un toque a todo lo que se puede hacer o abrir en la app. El catálogo está en `lib/atajos.ts` y se filtra por rol y por plan (`atajosPara`). **Pantalla nueva con menú, pestaña o botón de «crear» ⇒ se agrega su atajo ahí** (con su módulo, y su servicio si es de un plan superior); lo que es de un animal sin elegirlo manda al Hato para escoger el animal.

**Portada de entrada:** «Qué cubre» es un carrusel de tarjetas (`components/presentacion/CarruselCubre.tsx`): dedo en el celular; flechas, teclado y arrastre con mouse en el computador.

## «Qué resuelve»: sigue el orden del menú

La sección «Qué resuelve» de la pantalla de entrada se arma desde `lib/menu.ts` (mismos grupos y mismo orden: cada día, Producción y manejo,
Dinero y análisis, Genealogía, Mi finca) y los textos de cada opción viven en `lib/presentacion.ts` (`CONTENIDO`). Una opción nueva del menú
sin su texto hace fallar `tests/presentacion.test.mjs`; las que no se describen aparte (`OMITIDAS`) llevan su razón. «Productos y terceros» va
como tarjeta propia dentro de «Dinero y análisis». La etiqueta «Desde <plan>» sale de `lib/planes.ts`, y la cifra de reportes suma los listados
del hato (`lib/reportes/catalogo.ts`) y los de costos (`lib/costos-reportes.ts`). Proyecciones se presenta siempre como un cálculo con
supuestos ajustables, nunca como un resultado prometido.
