# Esquila de ovejas

La esquila es el corte de la lana de las ovejas. Solo se esquilan las **ovejas de lana**; las **ovejas de pelo no**; y las cabras tampoco. En Colombia hay de las dos clases (y muchas criollas y cruces que pueden ser de cualquiera), así que la app no supone nada: lo decide la raza y, si hace falta, la persona.

## Cobertura: lana, pelo o por definir

- **Cada raza ovina trae su cobertura de referencia** (`razas.cobertura`, catálogo global de solo lectura): **lana** (Merino, Corriedale, Romney Marsh, Cheviot, Hampshire, Dorset, Suffolk, Île de France), **pelo** (Pelibuey, Blackbelly, Katahdin, Santa Inés, Dorper, White Dorper, Abisinia, Etíope, Sudán) o **variable** (Criollo colombiano y Cruce: pueden ser de lana o de pelo). Las razas de cabras no llevan.
- **Cada oveja puede llevar la suya** (`animales.cobertura`: «lana» o «pelo», solo ovinos; vacía = la de su raza) y **manda sobre la de la raza**: una Pelibuey que de verdad es de lana, o una Merino que es de pelo.
- **La cobertura efectiva no se guarda, se calcula** (`coberturaEfectiva` en `lib/esquila.ts`, y la misma regla dentro de `registrar_esquila`): la de la oveja → la de su raza → **«por definir»** (raza variable o sin raza). Una oveja «por definir» no se puede esquilar hasta que se defina en su ficha; la pantalla y el servidor lo dicen así.
- Se elige en el formulario del animal (solo si es ovino): «¿Es de lana o de pelo?» con «Según su raza», «De lana» y «De pelo». La tarjeta «Esquila» de la ficha lo muestra y lleva al formulario (`/hato/<id>/editar#cobertura`). Registrar un animal lo guarda (`registrar_animal`, migración `registrar_animal_con_cobertura`).

## Registrar y corregir una esquila

- **`/esquila`** (menú «Producción y manejo», **solo si la finca tiene ovejas**; visibilidad `esquila` en `lib/menu.ts`, atajos «Esquila» y «Registrar esquila» en `lib/atajos.ts`): resumen (de lana, por esquilar, de pelo, por definir), las ovejas con su estado (filtros «Por esquilar», «Al día», «De pelo», «Por definir»; los de plazo van ordenados por urgencia) y las esquilas hechas. Lo ve quien ve el Hato; registra quien escribe en el Hato.
- **`/esquila/nueva`**: fecha, quién esquiló, costo, notas y las ovejas **de lana activas** (nunca las de pelo, las por definir ni las cabras), con los **kilos de vellón** de cada una (opcional). Atajos para elegir «las que les toca» o todas; `?animal=<id>` la deja elegida (desde la ficha).
- **`/esquila/<id>`**: quien escribe corrige fecha, quién esquiló, costo, notas y los kilos de cada oveja. **Las ovejas de una esquila no se cambian** (se muestra la razón): si hubo un error de ovejas, se **anula** y se registra otra.
- **Anular** no borra: la esquila queda guardada (`esquilas.anulada_en`) pero deja de contar para los plazos y los kilos. Las esquilas anuladas salen en la exportación. Un animal que se da de baja se marca, no se borra, así que su historial de esquila se conserva.
- Todo pasa por funciones de la base que comprueban quién llama y que son **todo o nada** (`registrar_esquila`, `actualizar_esquila`, `anular_esquila`; permiso de escritura del módulo `hato`). `registrar_esquila` es **idempotente** por `client_request_id` y rechaza: fecha futura o de hace más de tres años, una oveja de otra finca o dada de baja, una cabra, una oveja de pelo, una «por definir», una fecha anterior al nacimiento, una oveja ya esquilada ese mismo día, pesos fuera de 0,05–25 kg y listas de más de 1000 ovejas.

## Plazos

`lib/esquila.ts` (reglas puras, con pruebas en `tests/esquila.test.mjs`): una oveja de lana se esquila **cada 12 meses** (`ESQUILA_CADA_MESES`) y se avisa **30 días antes** (`ESQUILA_AVISO_DIAS`). Estados: **sin esquila** (nunca registrada: no se inventa una fecha), **al día**, **toca** (a 30 días o menos de la fecha) y **atrasada**. `sumarMeses` no se pasa del fin de mes. La ficha de la oveja y `/esquila` usan las mismas funciones, así que nunca se contradicen.

## Datos

- Tablas de la finca `esquilas` y `esquila_animales` (RLS por finca con `crear_politicas_finca(..., 'hato')`, sin permisos para `anon`, FK compuestas `(animal_id, finca_id)`), y la vista `v_esquila_animal` (`security_invoker`: última esquila y kilos de cada oveja, solo esquilas vigentes).
- La exportación de la finca incluye las hojas «Esquilas» y «Ovejas esquiladas» y la columna «Cobertura (lana o pelo)» de los animales.
- Tutorial 30 «Esquila de las ovejas» (`lib/tutoriales.ts`): aparece como «Próximamente» hasta que se grabe y se le ponga su `youtube`; la ayuda «¿Cómo funciona?» de la pantalla (`AYUDA_ESQUILA`) ya apunta a él.

## Pendiente (decisiones aparte)

- Aviso de «toca esquilar» en Semáforos, Hoy y Telegram (hoy se ve en `/esquila` y en la ficha).
- Plazo propio por finca en «Ajustes de la finca» (hoy es 12 meses para todas).
- Cargue por Excel de la cobertura de cada oveja, y la lana como producto de venta y la esquila como costo (hoy se registra el costo en la propia esquila).
