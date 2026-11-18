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

## Plazos (Ajustes de la finca)

El plazo **es un ajuste de cada finca** (grupo «Esquila» de `/mas/ajustes`, solo en fincas con ovejas; solo el propietario lo cambia; «Volver a los valores sugeridos» lo restablece):
**cada cuántos meses se esquila una oveja de lana** (`finca_ajustes.esquila_cada_meses`, de fábrica **12**, entre 3 y 24) y **con cuántos días de anticipación se avisa** (`esquila_aviso_dias`, de fábrica **30**, entre 7 y 90). Los valores de fábrica viven solo en la base (defaults de columna). El plazo lo definió el equipo de producto, **no un especialista: se valida con un zootecnista** (el clima, la raza y el manejo lo cambian; en Colombia las de lana viven sobre todo en trópico alto).

`lib/esquila.ts` (reglas puras, con pruebas en `tests/esquila.test.mjs`): estados de una oveja de lana según su última esquila — **sin esquila** (nunca registrada: no se inventa una fecha), **al día**, **toca** (a `esquila_aviso_dias` o menos de la fecha) y **atrasada**. `sumarMeses` no se pasa del fin de mes. `/esquila`, la ficha de la oveja y el semáforo usan las mismas funciones, así que nunca se contradicen.

## Avisos: Semáforos, Hoy y Telegram

Área **Esquila** de los semáforos (`senalEsquila` en `lib/semaforos.ts`, datos en `lib/semaforos-servidor.ts`; la ven **propietario y administrador**, y solo si la finca tiene ovejas de lana activas): **rojo** una oveja de lana cuya fecha ya pasó; **ámbar** la que le toca pronto; y **un solo caso ámbar** («N ovejas de lana sin esquila registrada») que junta las que nunca tienen una esquila anotada, para que el aviso exista desde el primer día sin llenar la pantalla de casos. Las de pelo, las «por definir» y las cabras no entran. Sale en Hoy, en `/semaforos`, en `/esquila` («Qué atender hoy · Esquila»), por Telegram (`RUTA_AREA.esquila`) y en la herramienta `semaforos` de la conexión con IA. Si la oveja «sin esquila registrada» ya se esquiló antes, se **registra esa esquila con su fecha** (hasta tres años atrás): en el formulario, el atajo «Sin esquila registrada» elige a todas de una vez.

## En grupo

- **Definir lana o pelo de varias a la vez:** en `/esquila`, filtro «Por definir» (criollas, cruces, sin raza): se eligen y se marcan «Son de lana» o «Son de pelo» (`definir_cobertura`, todo o nada, solo ovejas activas de la finca; `definirCoberturaEnGrupo`).
- **Registrar la última esquila de muchas:** el formulario ofrece «Las que les toca», «Sin esquila registrada» y «Todas».

## Datos

- Tablas de la finca `esquilas` y `esquila_animales` (RLS por finca con `crear_politicas_finca(..., 'hato')`, sin permisos para `anon`, FK compuestas `(animal_id, finca_id)`), y la vista `v_esquila_animal` (`security_invoker`: última esquila y kilos de cada oveja, solo esquilas vigentes).
- La exportación de la finca incluye las hojas «Esquilas» y «Ovejas esquiladas» y la columna «Cobertura (lana o pelo)» de los animales.
- Tutorial 30 «Esquila de las ovejas» (`lib/tutoriales.ts`): ya está publicado en YouTube. El «¿Cómo funciona?» vive en dos sitios, cada uno con su hoja y su tarjeta «Míralo en video»: la pantalla `/esquila` (`ayudaEsquila`, lleva a Ajustes para cambiar los plazos) y la tarjeta «Esquila» de la ficha de cada oveja (`ayudaEsquilaOveja`, lleva a `/esquila`). El enlace final de una ayuda nunca apunta a la pantalla donde se abre (no haría nada): lo vigila `tests/tutoriales.test.mjs`.

## Pendiente (decisiones aparte)

- Validar con un zootecnista el plazo de fábrica (12 meses y aviso a 30 días) y si conviene un plazo distinto por raza.
- Cargue por Excel de la cobertura de cada oveja, y la lana como producto de venta y la esquila como costo (hoy se registra el costo en la propia esquila).
