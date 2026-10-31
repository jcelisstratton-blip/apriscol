# Inventario de bodega — medicamentos y vacunas (1.ª entrega) y alimento (2.ª entrega)

`/inventario` (menú **Producción y manejo → Inventario**, desde el plan Intermedio). Lleva lo que queda de cada producto veterinario (`productos_veterinarios`), por lote y con su vencimiento.
La segunda entrega es el alimento (más abajo); la tercera será el consumo automático (que el alimento de un lote de ceba o de un corral descuente solo).

`/inventario` tiene dos pestañas, **Medicamentos** (módulo `inventario`: propietario, administrador y veterinario) y **Alimento** (módulo `nutricion`: propietario, administrador y ordeñador); cada perfil ve solo las que le tocan y el menú dice «Inventario» para los dos.

## Decisiones (del dueño del producto)

- **Se cuenta en la unidad de la dosis** del producto (ml, dosis, tableta…). La **presentación** (`presentacion`, `contenido_presentacion`: «frasco» = 100 ml) solo traduce: la persona cuenta y escribe en frascos si el producto tiene una; el servidor lo pasa a ml con el factor del producto (`unidadDeConteo`, `aUnidades`). El factor nunca viene del navegador.
- **El stock baja solo y sin bloquear.** Cada aplicación (`eventos_sanitarios` con producto y dosis) resta `dosis × animales × días del tratamiento`. Si el stock no alcanza, la aplicación se guarda igual y el producto queda **«Descuadrado»** (stock negativo, rojo en semáforos): no se frena un tratamiento por un descuadre de inventario.
- **Arranca con un conteo de apertura**, no con el historial: solo cuentan las compras y aplicaciones **desde la fecha de apertura de ese producto** (las cantidades de compras antiguas son texto libre y darían cifras irreales). Un producto sin apertura está **«Por contar»** y no avisa.
- **Permisos:** propietario y administrador mueven el inventario (`puedeEscribir(rol, "inventario")`); el veterinario lo **ve** (lo necesita para aplicar) y sus aplicaciones descuentan solas; ordeñador y contador no lo ven. La eliminación de un conteo (`inventario_movimientos_delete`) es de propietario y administrador.

## Qué se guarda y qué se calcula (lo derivado no se guarda)

- **Se guarda** (`inventario_movimientos`, módulo `inventario`, RLS con `crear_politicas_finca`): solo los conteos de la persona. `apertura` (lo que había al empezar; `cantidad ≥ 0`, una por producto y lote) y `ajuste` (cambio con signo, con `motivo`: conteo físico, vencido, pérdida, dañado u otro). Más tres columnas en `productos_veterinarios`: `presentacion`, `contenido_presentacion`, `stock_minimo` (en la unidad de la dosis).
- **Se calcula** (`private.inventario_calculo`, expuesta por `inventario_productos(p_finca)` e `inventario_lotes(p_finca, p_producto)`): `stock = conteos + compras − aplicaciones`, por producto y lote. Las **compras** son los `gastos` con `producto_vet_id` (`cantidad × contenido_presentacion`, lote y vencimiento de la compra) con fecha ≥ apertura; las **aplicaciones**, por el `lote_producto` del evento. Editar o eliminar una compra o una aplicación corrige el stock solo.
- Las dos funciones son `security definer` (con `search_path = ''` y validando `puede_ver(…, 'inventario')`) porque el veterinario debe ver el stock **sin ver las compras** (precios, proveedores). `private.inventario_calculo` no es ejecutable por nadie desde fuera.
- **Lo que no se puede sumar se avisa, no se esconde:** compras desde la apertura sin cantidad o de un producto sin presentación definida (`compras_sin_calcular`), y aplicaciones sin dosis (`aplicaciones_sin_dosis`, no descuentan).
- Una aplicación sin lote resta del «Sin lote» (puede quedar negativo); el **total del producto** es el que cuenta.

## Reglas puras (`lib/inventario.ts`, con pruebas en `tests/compartido.test.mjs`)

`estadoStock` (por contar, descuadrado, agotado, bajo —en el mínimo ya cuenta—, al día), `estadoVencimiento` (vencido, o pronto: 30 días o menos), `pideAtencion`, `textoStock` («3,5 frascos · 350 ml»), `faltaParaMinimo`, `cambioDeAjuste` (con «conteo físico» el cambio es lo contado menos lo que decía la app; con los demás motivos siempre resta). La lista, la ficha del producto y el semáforo (`senalInventario`) usan estas mismas funciones.

## Pantallas

- **Lista** (`ListaInventario`): búsqueda y tarjetas Todos / Piden atención / Por contar / Al día. Los datos vienen de la base ya calculados; la lista solo busca y filtra.
- **Ficha del producto** (`/inventario/[id]`): existencias y estado, lotes con vencimiento, presentación y mínimo (`FormPresentacion`) y el registro de conteos con su botón para eliminarlos.
- **Conteo de apertura** (`/inventario/[id]/apertura`, `FormApertura`): uno o varios lotes (número, vencimiento y cantidad); con la apertura hecha se vuelve a abrir para corregirla. **Ajustar** (`/inventario/[id]/ajustar`, `FormAjuste`): motivo, lote, cantidad y una vista previa de cuánto sube o baja.
- **Un ajuste no se edita**, se elimina y se registra de nuevo (es un hecho con fecha y motivo; editarlo cambiaría la historia del stock). Las filas de la apertura sí se corrigen desde el conteo de apertura.
- Semáforos (ver `semaforos.md`): rojo por lote vencido, agotado o descuadrado; ámbar por mínimo o por vencer.

## «Qué hacer» en la ficha del producto

La ficha abre con la tarjeta **Qué hacer** (`pasosInventario`, en `lib/inventario.ts`): por cada problema (lote vencido con existencias, descuadrado, agotado, en el mínimo, lote por vencer) dice el paso a paso con los nombres reales de las pantallas («Ajustar existencias», motivo «Vencido» o «Conteo físico») y dónde se corrige una fecha mal escrita (Hato → Compras o el conteo de apertura). Un producto sin problemas no la muestra. El lote vencido trae el botón **Dar de baja este lote** (y el caso rojo del semáforo lleva ahí directo): `/inventario/<id>/ajustar?motivo=vencido[&lote=…]` abre el formulario con el motivo «Vencido», el lote y **toda su cantidad** ya puestos (`ajusteInicial`, `rutaBajaLote`); la persona solo revisa y guarda, no se le vuelve a preguntar el lote. Los dos botones llevan una línea que dice cuándo usar cada uno (ajustar vs. corregir el conteo de apertura). Los conteos y ajustes nunca van en rojo: son hechos del historial, no alertas; solo el stock negativo de un lote lo está. «Sin lote» en negativo son aplicaciones sin lote: el total es el que cuenta. `plural` no cambia las unidades que terminan en «s» («dosis»).

**Descuadrado:** la tarjeta explica la causa (entró menos de lo que se aplicó: falta una compra, o se dio de baja algo que sí se usó) y ofrece los tres caminos: registrar la compra, eliminar el ajuste equivocado en «Conteos y ajustes», o **contar todo el producto** (`/inventario/<id>/ajustar?motivo=conteo&lote=total`). En ese conteo la persona escribe cuántas hay hoy en la bodega sumando todos los lotes (`LOTE_TOTAL`, opción «Todo el producto (total)» con varios lotes) y la diferencia con el total que decía la app queda como ajuste en «Sin lote» (`guardarAjuste`); si ya no queda nada, 0. El caso rojo del semáforo lleva ahí.

**Para que no se descuadre:** al registrar una aplicación con un producto del inventario, el lote **ya viene elegido** (`loteSugerido`: el vigente que vence primero) y los lotes vencidos **no se ofrecen** (`lotesVigentes`): «vencido es vencido». Así casi ninguna aplicación queda «sin lote» y un lote vencido no tapa un faltante.

## Auditoría de celular (29 oct 2026)

Lista (300 productos, nombres largos sin espacios, vacía), ficha (con y sin conteo, con y sin permiso de mover, con el aviso de eliminar abierto), conteo de apertura (corrigiendo, nuevo y con un lote agregado) y ajuste: a 360, 320, 768, 1024 y 1440 px, `scrollWidth == clientWidth` en todos y ninguna caja desbordada salvo el margen negativo deliberado de la fila de tarjetas (`FilaTarjetas`, igual que en Novedades). Se recorrió con datos de ejemplo (`FichaInventario` solo dibuja, la página trae los datos) y se probó escribir una cantidad de corrido en el ajuste (el foco se mantiene y la vista previa cuadra). **Sin recorrer con una sesión real** (guardar necesita la base).

Alimento (misma auditoría, 29 oct 2026): lista (300 alimentos, vacía), ficha (completa, vista del ordeñador, sin conteo y con unidad en kg), conteo de apertura, ajuste y anotar salida (con el alimento fijo y eligiéndolo) a 360, 320, 768, 1024 y 1440 px: la página nunca se desplaza; lo único marcado es el margen negativo deliberado de `FilaDesplazable` (las fichas «En kg / En bultos») y de la fila de tarjetas. Se probó elegir un alimento, cambiar a bultos y escribir la cantidad de corrida.

## Alimento (segunda entrega)

Concentrado, forraje, sales y suplementos, y leche maternizada: los productos del **catálogo de compras** (`finca_productos`, `tipo = 'compra'`) de esos rubros (`RUBROS_ALIMENTO`). `/inventario?vista=alimento`, ficha en `/inventario/alimento/[id]`.

- **Decisiones (del dueño del producto):** todo se cuenta en **kg**; lo que se compra en bultos o pacas se pasa a kg con el **peso de cada unidad** (`finca_productos.kg_por_unidad`; si la unidad ya es kg no hace falta). Quien da el alimento anota **salidas** (alimento, cuánto, fecha; destino opcional: un corral o un lote de ceba, solo si la persona ve Corrales o Carne). **Propietario, administrador y ordeñador** anotan salidas; solo propietario y administrador cuentan, ajustan y fijan el peso. La autonomía se mide con los **últimos 14 días**.
- **Qué se guarda** (`inventario_alimento_movimientos`, RLS propia): `apertura`, `ajuste` (con signo) y `salida` (lo que se dio de comer). **Qué se calcula** (`inventario_alimento(p_finca, p_hoy)`): `stock_kg = conteos + compras × kg por unidad − salidas`, desde la apertura de cada producto. Una compra en una unidad sin peso definido no se puede sumar: se cuenta en `compras_sin_calcular` y la ficha lo dice.
- **Permisos finos en la tabla** (el módulo `nutricion` ahora lo ve y escribe el ordeñador, así que las políticas limitan qué): insertar, el ordeñador solo `salida` y siempre a su nombre (`created_by = auth.uid()`); corregir o eliminar, propietario y administrador cualquiera y quien anotó una salida, la suya. El ordeñador ve las existencias (la función es `security definer`) sin ver compras ni precios.
- **Autonomía** (`lib/inventario-alimento.ts`): `consumoDiarioKg` = lo dado en los últimos 14 días ÷ esos días (o los que lleva contando, si son menos); `autonomiaDias` = existencias ÷ consumo diario. **Con menos de 3 días con salidas (`MIN_DIAS_CON_SALIDA`) no se calcula** («Sin consumo registrado»: no se inventa una cifra). `estadoAlimento` compara con el plazo de **Ajustes de la finca → `stock_autonomia_dias`**: menos de la mitad del plazo, «se acaba pronto» (rojo); menos del plazo, «alcanza poco» (ámbar); agotado y descuadrado (se dio de más) en rojo. Lo «por contar» no avisa.
- **Pantallas:** lista (`ListaAlimento`), ficha (`FichaAlimento`: existencias, días que alcanza, peso de cada unidad, movimientos), **Anotar lo que se dio** (`FormSalidaAlimento`; desde la ficha el alimento va fijo, desde la lista o «Al grano» se elige y «Guardar y anotar otro» deja el formulario listo; un identificador por salida evita duplicarla con un doble toque) y **Contar o ajustar** (`FormConteoAlimento`: la primera vez es la apertura; después, conteo físico, pérdida, daño u otro, con vista previa del cambio).
- Semáforos: área **Alimento** (propietario, administrador y ordeñador), `senalAlimento`. Atajos «Anotar lo que se dio de comer» e «Inventario de alimento» en «Al grano».
- Exportación: hojas «Inventario de medicamentos» e «Inventario de alimento (kg)» (en esta última no sale el lote de ceba).

## Reportes

Los reportes del inventario viven en **Reportes → Inventario** (`/reportes`, ver `reportes.md`) y solo los abren el propietario y el administrador: existencias de medicamentos, lotes y vencimientos, movimiento de medicamentos, existencias de alimento y movimiento de alimento. Los tres de «movimiento» y los lotes salen de funciones de lectura que validan `puede_gestionar` (`inventario_movimientos_med`, `inventario_movimientos_alimento`, `inventario_lotes_finca`).

## Datos base del piloto (29 oct 2026)

Para ver el movimiento, la finca piloto «Aprisco Piloto El Mirador» tiene conteos sembrados a partir de sus datos reales (todos llevan «Datos base del piloto» en las observaciones, para poder distinguirlos o limpiarlos):
- **Medicamentos:** presentación y mínimo de los 10 productos; conteo de apertura al 1 de agosto por lote (los lotes salen de las compras y aplicaciones reales); dos ajustes (un frasco roto y un conteo físico). Quedan a la vista un producto **descuadrado** (ivermectina: se aplicó sin compra registrada), uno **por debajo del mínimo** (antibiótico intramamario), un **lote vencido** (albendazol: la compra del 28 de octubre se anotó con vencimiento del 1 de octubre) y uno **por vencer** (vacuna clostridial, 18 de noviembre).
- **Alimento:** peso por unidad (concentrados de 40 kg, paca de 16 kg), conteo de apertura al 1 de octubre y lo que se dio de comer cada día (ración diaria de lactancia, crías, heno, sal y melaza; leche maternizada hasta el 24; el concentrado de engorde sale del consumo del lote de ceba). Quedan **sal** que se acaba (1 día), **concentrado de lactancia** que alcanza poco (4 días), **leche maternizada** agotada, **engorde** sin consumo suficiente para calcular, y **ensilaje** por contar. El bloque nutricional es el conteo de prueba que hizo el propietario.

## Ajustes finos (29 oct 2026, 3.ª entrega: lo que ya es automático)

Migración `inventario_ajustes_finos`. Todo lo que antes había que anotar a mano y ahora se descuenta solo:
- **Consumo de un lote de ceba** (`consumo_lote.producto_id`, FK compuesta a `finca_productos`): «Alimento del lote» ofrece los alimentos del catálogo; si se elige uno, el consumo **es** la salida del inventario (no se anota dos veces). `inventario_alimento` y `inventario_mov_alimento` suman `consumo_lote` con producto a las salidas, desde la apertura de cada alimento; el destino del movimiento es el lote. Los consumos anteriores se enlazaron por nombre al catálogo. Un consumo sin producto («otro alimento», texto libre) no descuenta. Se quitaron las 4 salidas que se habían copiado a mano en los datos base (ya contaban doble).
- **Pediluvio**: la cantidad de producto es lo gastado **en todo el baño** (una vez, no por animal): `inventario_calculo` y el movimiento de medicamentos multiplican por animales todo tipo menos `pediluvio`. Antes el servidor descartaba esa cantidad en silencio; ahora `limpiar.via` descarta solo la vía y la «dosis» del pediluvio se guarda (`REGLAS.pediluvio.cantidadBano`).
- **Repetir un día** (`/inventario/alimento/repetir`, `repetirSalidas`): anota hoy las mismas raciones de un día de los últimos 14. Las raciones las lee el servidor (el navegador solo dice el día), solo de alimentos con conteo de apertura (`planearRepeticion`), con un identificador estable por ración (doble toque seguro). Cada ración repetida lleva «Repetido del <día>» en las observaciones (`marcaRepeticion`): la acción rechaza repetir el mismo día dos veces el mismo día y la pantalla deja de ofrecerlo.
- **Avisos** en los formularios: «Registrar una aplicación» recuerda anotar la dosis si el producto está en el inventario (y la deja abierta) y «Registrar una compra» dice cuándo no va a sumar (`avisoCompraInventario`: alimento sin lista o sin peso por unidad, medicamento sin producto veterinario o sin presentación).
- **Novedad «Comprar»**: «Registrar la compra» lleva `?novedad=<id>`; al guardar la compra la novedad queda atendida (si la persona no puede cambiarla, la compra se guarda igual).
- Eliminar un producto veterinario avisa que se borran sus conteos del inventario (`on delete cascade`).
- Índices: `consumo_lote_producto_idx`, `gastos_producto_vet_fecha_idx`.

## Pendiente

- Validar con el veterinario la lógica de `dosis × animales × días` para tratamientos y desparasitaciones (la dosis se escribe por animal y, en tratamientos, por día).
- Validar con un veterinario o zootecnista que 14 días y 3 días con salidas sean buenos valores para la autonomía.
- Las unidades de la dosis de una aplicación y las del producto no se convierten (una aplicación en «ml» sobre un producto contado en «dosis» resta el número tal cual). Hoy se confía en que la aplicación use la misma unidad con que se contó el producto.
