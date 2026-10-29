# Inventario de bodega — medicamentos y vacunas (primera entrega)

`/inventario` (menú **Producción y manejo → Inventario**, desde el plan Intermedio). Lleva lo que queda de cada producto veterinario (`productos_veterinarios`), por lote y con su vencimiento.
La segunda entrega será el alimento (concentrado, forraje, sales) con salidas manuales y la autonomía en días (`stock_autonomia_dias`, hoy sin uso); la tercera, el consumo automático.

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

## Auditoría de celular (29 oct 2026)

Lista (300 productos, nombres largos sin espacios, vacía), ficha (con y sin conteo, con y sin permiso de mover, con el aviso de eliminar abierto), conteo de apertura (corrigiendo, nuevo y con un lote agregado) y ajuste: a 360, 320, 768, 1024 y 1440 px, `scrollWidth == clientWidth` en todos y ninguna caja desbordada salvo el margen negativo deliberado de la fila de tarjetas (`FilaTarjetas`, igual que en Novedades). Se recorrió con datos de ejemplo (`FichaInventario` solo dibuja, la página trae los datos) y se probó escribir una cantidad de corrido en el ajuste (el foco se mantiene y la vista previa cuadra). **Sin recorrer con una sesión real** (guardar necesita la base).

## Pendiente

- Validar con el veterinario la lógica de `dosis × animales × días` para tratamientos y desparasitaciones (la dosis se escribe por animal y, en tratamientos, por día).
- Avisar en el formulario de Compras que un producto veterinario necesita cantidad para sumar al inventario (hoy el aviso sale en la ficha del producto).
- Segunda entrega: alimento con salidas manuales y señal de autonomía. Tercera: consumo automático.
