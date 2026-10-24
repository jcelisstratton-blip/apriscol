# Proyecciones

Entrada propia del menú principal (`/proyecciones`; en el celular, dentro de «Más»). Simula **mes a mes, a 12, 24 o 36 meses**, el hato, el alimento y el dinero, partiendo de los animales de hoy y de los números de la propia finca. **Solo propietario y administrador** (`puedeGestionar`); el módulo `proyecciones` entra desde el plan **Profesional** (`private.modulo_rango` = `moduloEnPlan` = 3). Una finca con un plan menor ve «Proyecciones está en el plan Profesional» (`RequierePlan`) si entra por la dirección; el menú no la ofrece.

## Qué se ve

- **Escenarios** (`BarraEscenarios`): hasta 10 por finca, uno elegido a la vez (`Selector`); «Nuevo con lo de pantalla», duplicar, cambiar nombre y eliminar. Cambiar de escenario con cambios sin guardar se bloquea con un aviso. Lo guardado es el nombre, el horizonte y solo los ajustes.
- Pestañas (tarjetas, cambian sin recargar): **Resumen** (avisos + una tarjeta por año + barras de lo que queda cada mes), **Hato**, **Alimento**, **Dinero** (mes a mes: tabla desde `lg`, una tarjeta por mes en el celular), **Comparar**, **Riesgos** y **Supuestos** (todos los números editables).
- **Comparar** (`Comparar.tsx`, filas en `lib/proyeccion/comparacion.ts`): hasta 3 escenarios —los guardados y, si hay cambios sin guardar, «Lo que ves en pantalla»— con el mismo hato y el mismo horizonte; el mejor de cada fila va marcado (✓).
- **Riesgos** (`Riesgos.tsx`, cálculo en `lib/proyeccion/analisis.ts`): (1) **precio de equilibrio** del kilo vivo y del litro: como los ingresos son lineales en el precio se calcula con dos corridas, dejando el otro precio fijo; (2) **sensibilidad**: cada uno de 12 números ±10 % (uno por vez, dentro de su rango) y cuánto cambia lo que queda en total; (3) **si sale mal / como está / si sale bien**: pesimista (precios −15 %, alimento +20 %, muertes de crías +50 %, crías por parto −10 %, leche −10 %) y optimista (precios +10 %, alimento −5 %, muertes −30 %, crías +5 %, leche +5 %). Los choques están en `CHOQUES` y se explican en pantalla.
- **Época seca**: los meses que no están en `meses_lluvia` de los Ajustes (si hay alguno definido) son «secos»: el alimento cuesta `seca_costo_alimento_pct` más y la leche baja `seca_litros_pct`. Sin meses de lluvia no hay efecto y el panel de Alimento lo dice. Las toneladas no cambian, solo el precio.
- **Enfoque** (tarjetas): **Todo · Carne · Leche**. Carne y leche se consultan por separado; en el Resumen de esas dos vistas un aviso dice cuánto de costos compartidos **no** se resta (`costosSinRestar`) y cuál es el resultado completo de la finca. Las cifras se llaman «Ingresos menos el alimento de crías y levante» / «…extra de lactancia», nunca «lo que queda». Como el alimento base de las reproductoras, la sanidad y el personal sirven a las dos líneas, **no se reparten**: la línea de carne se compara con el alimento de crías y levante, y la de leche con el alimento *extra* que pide la lactancia («Queda sobre ese alimento»). El resultado completo, con todos los costos, es «Todo».
- Horizonte 12/24/36 meses (`Segmentado`), «Descargar en Excel» (`/proyecciones/exportar?h=&a=`: el horizonte y los ajustes de la pantalla; hojas *Resumen por año*, *Mes a mes*, *Supuestos* con su origen, *Escenarios* con todos los guardados y *Riesgos*).

## Los supuestos y de dónde sale cada uno

`lib/proyeccion/supuestos.ts` define cada supuesto (rango, decimales, referencia). El valor que se muestra es, en este orden: **Tu ajuste** (lo que la persona cambió) → **De tu finca** (promedio de sus registros, con la muestra: «29 partos en 12 meses») → **Referencia** (valor típico mientras la finca no tiene datos suficientes). `lib/proyeccion/base.ts#armarBase` decide qué dato de la finca es lo bastante sólido:

| Supuesto | De la finca cuando… |
|---|---|
| Partos por hembra al año | ≥ 5 reproductoras y ≥ 8 partos en 12 meses (los abortos no cuentan) |
| Crías vivas por parto | ≥ 8 partos con número de crías |
| Mortalidad y descarte de reproductoras | ≥ 15 reproductoras y ≥ 3 muertes / ≥ 3 salidas por venta o sacrificio en 12 meses |
| Edad, peso y precio por kilo de venta | ≥ 5 ventas de animales menores de 18 meses con peso y valor |
| Peso de descarte, edad de entrada al hato reproductor | Ajustes de la finca (peso adulto de la hembra, edad mínima de servicio) |
| Duración de la lactancia | ≥ 5 lactancias cerradas |
| Litros por hembra, precio del litro | ≥ 30 registros de ordeño en 90 días; ≥ 100 litros vendidos en 12 meses |
| Costo por kilo de alimento, sanidad y reproducción por animal, costos fijos | ≥ 3 meses con costos en los últimos 12 (`costos_por_rubro`, `costos_por_mes`); la compra de animales no es costo fijo |
| Capacidad | suma de la capacidad de las instalaciones activas |

Se redondean y **nunca salen de su rango** (`dentro`). Los valores de referencia los dejó así el dueño del producto: no hay zootecnista en el equipo, así que no están validados por un especialista; por eso se rotulan «Referencia» y se pueden cambiar.

## El simulador (`lib/proyeccion/motor.ts`)

Función pura `simular(inicio, supuestos, horizonte, gestacionDias)`; corre igual en el servidor, el navegador y las pruebas. **Regla que no se rompe:** animales al final = animales al inicio + nacimientos − muertes − ventas (incluido el descarte), mes a mes (`descuadreBalance`, probada en `tests/proyeccion.test.mjs`). Pasar una hembra de reemplazo al hato reproductor es un traslado, no cambia el total.

- **Partos:** los primeros `ceil(gestación / 30,4)` meses salen de las **fechas previstas de parto registradas** (gestantes + servidas × % de preñez); después rige la tasa de la finca (reproductoras × partos por año / 12). Si las preñeces registradas cubren menos de la cuarta parte de lo esperado, se usa la tasa desde el mes 1 y se avisa.
- **Crías → ceba:** cada nacimiento es una cohorte (machos, hembras para vender, hembras de reemplazo según el % de retención). Mortalidad de lactancia hasta el destete y de levante hasta la venta, repartidas por mes. Se venden a la edad y el peso de venta; las de reemplazo entran al hato reproductor a la edad de entrada **solo si hay espacio** según el objetivo (`crecimiento_hato_pct`); las que sobran se venden.
- **Machos sin uso definido:** los machos adultos (12 meses o más, o sin fecha de nacimiento) con `uso_macho` = reproductor son sementales; los de uso «carne» entran como animales de carne; los **sin uso definido** se reparten con `hembras_por_semental` (referencia 25): se cuentan como sementales solo los que hacen falta (`repartirMachos`, `ceil(reproductoras / relación)` menos los ya marcados) y el resto se toma como carne y sale a la venta en el primer mes. La pantalla lo dice en un aviso con las cifras y pide marcar el uso en la ficha de cada macho. Antes de este cambio todos contaban como sementales y alimentarlos inflaba el costo.
- **Hato reproductor:** muertes y descarte mensuales; el descarte se vende por peso × precio con el descuento configurado.
- **Leche:** hembras en lactancia = partos de los últimos `lactancia_meses` + las que hoy lactan y se van secando; litros = lactantes × % que se ordeña × litros/día × 30,4.
- **Alimento:** kilos de materia seca por día según categoría (reproductora seca, lactando, semental, cría, levante) × costo por kilo de materia seca.
- **Dinero:** ingresos (carne + leche) − alimento − sanidad y reproducción (por animal) − costos fijos. Todo en **pesos de hoy** (sin inflación).
- **Avisos:** capacidad (primer mes en que no caben), reemplazo insuficiente (las reproductoras bajan del objetivo), meses con caja negativa y poca información de preñeces.

Se simplifica a propósito: una sola especie de referencia para la gestación (`caprino`), sin compras de animales ni inflación (todo en pesos de hoy). Posibles mejoras futuras: gestación y parámetros por especie, compra de reproductores, inflación.

## Datos y permisos

- Tabla `proyecciones` (`finca_id`, `nombre`, `horizonte_meses` 6–36, `ajustes jsonb`): guarda **solo lo que la persona cambió** frente a los valores de su finca; lo demás se recalcula con datos al día. RLS con `crear_politicas_finca('proyecciones','proyecciones')` (el borrado, solo quien gestiona). Una fila por escenario (hasta 10 por finca, nombre único sin importar mayúsculas); `guardarEscenario`, `renombrarEscenario` y `eliminarEscenario` en `actions.ts`.
- Las acciones de servidor exigen `permisoPara("proyecciones")` y `puedeGestionar`, limpia las claves y los rangos (`limpiarAjustes`) y no confía en lo que llega del navegador.
- Espejos del módulo: `private.modulo_rango`, `lib/planes.ts#moduloEnPlan`, `ModuloApp` en `lib/tipos.ts`, `tests/fixtures/espejos-sql.json`.
- Migraciones: `20261024193026_modulo_proyecciones_enum` (el valor del enum, en su propia migración) y `20261024210000_proyecciones` (rango por plan + tabla + políticas; contiene `on delete`, así que la ejecuta el propietario en el Editor SQL).

## Si cambias algo

Un supuesto nuevo: `DEFINICIONES` (rango y referencia), su origen en `armarBase` con su muestra mínima, el motor y una prueba. Una cifra nueva en pantalla: `lib/proyeccion/vista.ts` (la usan la pantalla y el Excel; así nunca se contradicen).
