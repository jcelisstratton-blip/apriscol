# Compras, ventas, costos y nómina

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia el proceso, se actualiza aquí en el mismo commit.

## Compras, ventas y costos (cuentas separadas, todo por selección)

Módulo `contabilidad` (propietario, administrador y **contador**; el contador no ve Sanidad ni Ceba, pero sí sus costos). **Lo que sale y lo que entra se registran
por separado, y el usuario elige de listas en vez de escribir** (decisión del dueño del producto): solo se escribe la cantidad.
- **Catálogos por finca** (`finca_productos`, `finca_terceros`; los lee cualquier miembro, los cambia quien registra compras, ventas, leche o carne; nada se borra, se oculta con
  `activo`). Cada finca nace con su lista sembrada (`private.productos_sembrar`, idempotente: un producto nuevo del catálogo se agrega ahí **y** con una migración que vuelva a
  sembrar). Un producto es de **compra** (con su `rubro` de gasto) o de **venta** (con su `linea`: leche, animales, carne, derivados, subproductos, otros), con su unidad y su
  `precio_habitual`, que se propone y se actualiza solo con el último precio usado (`recordar_precio_producto`, también para quien registra leche o carne). Los de venta
  `automatico` (leche cruda, animal en pie, animal sacrificado) no se ofrecen en el formulario de ventas: entran solos. Se ajustan en **Más → Productos y terceros** (`/mas/productos`).
  Un **tercero** (proveedor, comprador o ambos) se crea una vez desde el propio selector (`SelectorTercero`: escribir su nombre en el buscador → «Agregar»); `crearTercero` nunca duplica
  (compara sin mayúsculas) y, si ya existía para el otro uso, lo pasa a «ambos». El texto libre de antes (`gastos.proveedor`, `despachos_leche.comprador`, `bajas.comprador`) se convirtió en terceros
  elegibles y se conserva como texto (la acción guarda ahí el nombre del elegido, para lo que lo lee).
- **Compras** (`gastos`, Hato → «Compras», `/hato/gastos/nuevo`): grupo → producto de la lista (o «Otra compra», que sigue pidiendo rubro y descripción) → cantidad; el precio habitual viene puesto,
  el total es cantidad × precio, y el proveedor se elige. A quién se carga (finca, especie, corral, lote o animal), por pagar/pagado y factura en `soportes/<finca>/gastos/` siguen igual. El costo
  de cada tratamiento (`eventos_sanitarios.costo`), el del alimento de cada lote (`consumo_lote.costo`) y **la compra de cada animal comprado** (`animales.valor_compra` con `origen = 'comprado'`, en
  `fecha_compra` o, sin ella, el día en que se registró; rubro `compra_animales`, `destino_tipo = 'adquisicion'` para que no entre al costo por animal) se suman con su origen en `private.costos_base`.
  **Riesgo de doble conteo** (comprar concentrado y además cargar el consumo del lote con costo): el Resumen avisa (`costos_posible_doble_conteo`), no lo resuelve solo.
- **Ventas** (Hato → «Ventas», `/hato/ventas/nueva`, tabla `ventas`): producto de venta → cantidad × precio (propuesto) → comprador → «Ya me pagaron» / «Me lo deben» (+ cuándo se espera). La **leche despachada con precio**
  (`despachos_leche`) y los **animales vendidos o sacrificados con valor** (`bajas`) ya son ventas y **no se digitan otra vez**: `private.ventas_base` las suma con su origen (`venta`, `leche`, `animal`). Ambos
  tienen ahora `tercero_id`, `cobrado_en` y `cobro_vence`; **un despacho sin precio no es una venta** (no se cobra). `marcar_cobro_venta` registra el cobro de los tres orígenes sin exigir permiso sobre Leche ni Hato.
  Lo vencido por cobrar sale en Hoy.
- El menú **Costos** (`/costos`) es el resumen con filtros por **cualquier fecha** (`FiltroPeriodo`, incluye «Entre fechas») y pestañas **Resumen, Compras, Ventas, Por animal y Reportes**; no registra. El Resumen separa
  **Compras, Mano de obra, Ventas y Resultado** (ventas − todo lo que costó); `grupoDe`/`GRUPOS_COSTO` (`lib/costos.ts`, espejo de `private.grupo_rubro`) añaden los grupos «Mano de obra» y «Compra de animales» a los cinco de compra.
  La ficha del animal tiene la tarjeta «Costos» (`#costos`) y el valor de compra o reposición (`animales.valor_compra`).
- **Equipo, personal y nómina** (un solo menú **Equipo**, `/mas/miembros`, con pestañas **Equipo** y **Pagos**; `/personal` solo redirige). Lo ve quien gestiona (propietario, administrador) y quien lleva las cuentas (módulo `contabilidad`, incl. contador); los sueldos son sensibles. **Agregar a alguien** es un solo formulario (`FormInvitar`): primero el **perfil** (administrador, ordeñador, veterinario, contador o «Sin acceso a la app» para quien solo trabaja y cobra) y, ya elegido, su **contrato** (`CamposContrato`); `invitar` crea primero la persona (`personal.correo`, `personal.rol`) y luego la invitación, y deshace la persona si la invitación falla. Si el plan no incluye invitar, solo se ofrece «Sin acceso». Corregir a una persona: `/personal/[id]/editar`. `personal` (nombre, cargo, vinculación
  `laboral` | `servicios`, forma de pago `mensual` | `jornal` | `por_servicio`, valor base; **sin documento de identidad**) y `pagos_personal` (cantidad × valor base). Lo que recibe la persona es `valor_pago`; lo que le cuesta a la
  finca es `costo_total` = pago × `factor`, que el disparador `pagos_personal_validar` fija al registrar el pago: el `factor_prestacional` de `finca_ajustes` si es contrato de trabajo, **1** si es prestación de servicios (el navegador
  nunca lo elige y no cambia aunque después cambie el ajuste). A quien está por prestación de servicios **no se registra un pago como hecho sin su PILA** (`soporte_pila`, carpeta `nomina` del bucket `soportes`; lo exige la base y la
  pantalla). **No se inventan tarifas legales** (ni retención, ni horas extras): el único número de ley es el factor que define el propietario en Ajustes. `private.costos_base` suma cada pago como `mano_obra` (origen `nomina`, destino
  `finca`), y **«Mano de obra» ya no es una opción de Compras** (`crearGasto` la rechaza; las compras viejas con ese rubro siguen y `costos_posible_doble_conteo` avisa si coinciden con la nómina). La vinculación de una persona con
  pagos no cambia; si se retira se marca retirada (su historial se conserva).
- Todos los reportes salen de funciones `costos_*` y `ventas_*` (SECURITY DEFINER, validan `puede_ver(finca, 'contabilidad')`). Las funciones **conservan sus columnas** (`costos_indicadores` y `costos_por_mes` siguen
  devolviendo «ingresos de leche» y «de animales», este último = todo lo que no es leche) para no romper el código anterior durante el despliegue. **Excel:** `/costos/exportar?reporte=…&periodo=…` arma el `.xlsx` en el servidor con la sesión
  (`lib/reportes-excel.ts`, `exceljs`): título con finca, reporte, periodo y filtros dentro de la hoja, totales como fórmulas, y el archivo se llama `<finca> - <reporte> - <desde> a <hasta>.xlsx`. Un reporte nuevo se agrega en
  `lib/costos-reportes.ts` y en `construirLibro`.

## Datos de cada perfil del equipo

Al agregar a alguien en Equipo (`FormInvitar`), con el perfil elegido se abre su bloque de datos (`CamposPerfil`, reglas en `lib/perfil-personal.ts#perfilPorRol`, que lo exige la acción y solo guarda lo del perfil). Se guardan en `personal` (migración `20261024150504_personal_perfil_por_cargo`, solo agrega columnas y amplía `registrar_persona`). **Nunca se pide documento de identidad**; la tarjeta profesional es el registro del oficio.

| Perfil | Obligatorio al agregarlo | Opcional |
|---|---|---|
| **Veterinario** | Tarjeta profesional y teléfono (a quien se llama en una urgencia) | Especialidades (reproducción, sanidad, cirugía, nutrición, calidad de leche; varias), años de experiencia, acreditaciones (ICA u otras) |
| **Ordeñador** | Turno de ordeño (mañana, tarde, ambos) y tipo de ordeño (manual, mecánico, ambos) | Curso de manipulación de alimentos (lo tiene / no; con vencimiento), experiencia, teléfono |
| **Administrador** | — | Formación (empírica, técnica, tecnológica, profesional), experiencia, teléfono |
| **Contador** | Tipo (público o auxiliar); la tarjeta profesional si es público | Experiencia, teléfono |
| **Sin acceso a la app** | Labor principal (hato, potreros y cercas, alimentación, mantenimiento, otra) | Experiencia, teléfono |

Al **corregir** a alguien (`/personal/[id]/editar`) los datos del perfil se editan igual pero no se exigen (para no bloquear, por ejemplo, retirar a un veterinario antiguo); lo que se escriba sí se valida. En la lista del equipo se ve un resumen del perfil y el teléfono con «llamar» y WhatsApp. Los planes sin el módulo de personal (por debajo de Profesional) solo invitan: no guardan estos datos.
