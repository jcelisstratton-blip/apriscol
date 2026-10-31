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
- **Lote en compras de sanidad:** al comprar una vacuna, un desparasitante o un medicamento (rubros `vacunas_desparasitantes` y `tratamientos`; también `podologia`, opcional) el formulario pide **de qué producto veterinario es, su lote y su vencimiento**; el veterinario lo elige después al aplicarlo (ver `sanidad-corrales.md`). Cada compra es un lote; una compra nueva del mismo producto agrega otro lote a la lista.
- **Ventas** (Hato → «Ventas», `/hato/ventas/nueva`, tabla `ventas`): producto de venta → cantidad × precio (propuesto) → comprador → «Ya me pagaron» / «Me lo deben» (+ cuándo se espera). La **leche despachada con precio**
  (`despachos_leche`) y los **animales vendidos o sacrificados con valor** (`bajas`) ya son ventas y **no se digitan otra vez**: `private.ventas_base` las suma con su origen (`venta`, `leche`, `animal`). Ambos
  tienen ahora `tercero_id`, `cobrado_en` y `cobro_vence`; **un despacho sin precio no es una venta** (no se cobra). `marcar_cobro_venta` registra el cobro de los tres orígenes sin exigir permiso sobre Leche ni Hato.
  Lo vencido por cobrar sale en Hoy.
- El menú **Costos** (`/costos`) es el resumen con filtros por **cualquier fecha** (`FiltroPeriodo`, incluye «Entre fechas») y pestañas **Resumen, Compras, Ventas, Por animal y Reportes**; no registra. El Resumen separa
  **Compras, Mano de obra, Ventas y Resultado** (ventas − todo lo que costó); `grupoDe`/`GRUPOS_COSTO` (`lib/costos.ts`, espejo de `private.grupo_rubro`) añaden los grupos «Mano de obra» y «Compra de animales» a los cinco de compra.
  La ficha del animal tiene la tarjeta «Costos» (`#costos`) y el valor de compra o reposición (`animales.valor_compra`).
- **Equipo, personal y nómina** (un solo menú **Equipo**, `/mas/miembros`, con pestañas **Equipo** y **Pagos**; `/personal` solo redirige). Lo ve quien gestiona (propietario, administrador) y quien lleva las cuentas (módulo `contabilidad`, incl. contador); los sueldos son sensibles. **Agregar a alguien** es un solo formulario (`FormInvitar`): primero el **perfil** (administrador, ordeñador, veterinario, contador o «Sin acceso a la app» para quien solo trabaja y cobra) y, ya elegido, su **contrato** (`CamposContrato`); `invitar` crea primero la persona (`personal.correo`, `personal.rol`) y luego la invitación, y deshace la persona si la invitación falla. Si el plan no incluye invitar, solo se ofrece «Sin acceso». Corregir a una persona: `/personal/[id]/editar`, que además trae la tarjeta **Acceso a la app** (`AccesoPersona`, solo propietario y administrador): ya tiene acceso / invitación pendiente con su enlace para copiar o enviar y «Cancelar para usar otro correo» / invitación vencida con «Renovar» / sin invitación, con correo y perfil para crearla (`invitar_persona`, que renueva una pendiente del mismo correo en vez de chocar con el índice único y rechaza a quien ya es miembro). **Invitaciones pendientes** (Equipo): se listan también las vencidas (antes desaparecían pero seguían ocupando su correo) y cada una se puede copiar, enviar, renovar por 7 días (`renovar_invitacion`) o cancelar. Migración `20261028014741` (dos funciones `security definer` que validan propietario o administrador: `invitaciones` no tiene política de UPDATE). `personal` (nombre, cargo, vinculación
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

**El cargo no se pregunta: sale del perfil** (`cargoDelPerfil`): «Veterinario», «Ordeñador», «Administrador», «Contador público» o «Auxiliar contable»; para quien trabaja sin acceso, su labor principal (o la que escriba si elige «Otra labor»). Al **corregir** a alguien (`/personal/[id]/editar`) los datos del perfil se editan igual pero no se exigen (para no bloquear, por ejemplo, retirar a un veterinario antiguo); lo que se escriba sí se valida. En la lista del equipo se ve un resumen del perfil y el teléfono con «llamar» y WhatsApp. Los planes sin el módulo de personal (por debajo de Profesional) solo invitan: no guardan estos datos.

**Veterinario sin correo:** al agregar a alguien con el perfil «Veterinario» el correo es **opcional**: con correo se le invita a la app; sin correo queda en el equipo (sin acceso) y se ofrece igual como veterinario de la finca en los procedimientos (`personal.es_veterinario`, migración `20261024154239_asistencia_veterinario_y_asistido_por`). También se puede agregar uno desde el formulario de un procedimiento (`agregar_veterinario`: nombre, tarjeta profesional y teléfono; queda como prestación de servicios con valor 0, que se completa en Equipo). El perfil de una persona sin acceso con `es_veterinario` se edita con los datos del veterinario (`perfilDePersona`).

## Unidades de medida de lo que se compra y se vende

**Cada producto del catálogo lleva su unidad y se pregunta «Cuántos <unidad>» y «Precio de cada <unidad>»** (`FormVenta`, `FormGasto`, el catálogo de «Más → Productos»). Reglas del catálogo con el que nace cada finca (`private.productos_sembrar`; las revisa `tests/unidades.test.mjs` leyendo la última migración que la redefine):
- **Lo líquido, en litros:** la leche cruda, **yogur, kumis y otras bebidas lácteas** (antes estaba en kg: error corregido en `20261031150528_unidades_ventas_lacteos.sql`) y el desinfectante. La **leche maternizada** es polvo: va en kg.
- **Lo sólido, en kg:** carne en canal y en cortes, queso, lana y los derivados sólidos (cuajada, mantequilla…, producto nuevo y aparte del yogur).
- **Contados:** animales (por animal), pieles y otras ventas (unidades), abono (bultos), concentrados (bultos), pacas, dosis, pajillas, aretes, visitas, viajes, meses (arriendo, agua y energía) y combustible en galones.
- Toda unidad del catálogo debe estar en `UNIDADES_GASTO` (la prueba lo exige).
- La migración **no toca lo que cada finca ya cambió**: solo corrige el producto que todavía tiene el nombre y la unidad con que nació, y las ventas ya registradas conservan su propia unidad (`ventas.unidad`). Se puede cambiar la unidad de un producto en «Más → Productos».
- **El singular** («Precio de cada litro», «Por galón», «Por animal», «Por mes», «dosis») sale de `lib/unidades.ts` (`singular`, `precioDeCada`, `textoPorUnidad`): una sola definición. Antes se le quitaba la «s» a ciegas y salía «animale», «dosi», «galone» o «mese».
- **Por revisar con quien compra:** la **melaza** está en kg (es líquida y a veces se compra por galón o litro); se puede cambiar en «Más → Productos».

**Qué no se registra en «Registrar una venta»:** la **leche** (entra sola desde Leche → Despachos) y los **animales** vendidos o sacrificados (desde su salida del hato). La pantalla lo dice arriba, con el enlace a Despachos.

**Los avisos de dinero del semáforo llevan a SU registro**, no a la lista general: una venta registrada abre su edición (`/hato/ventas/<id>/editar`), un despacho de leche abre ese despacho (`/leche/despachos/<id>`), la venta de un animal abre su ficha en «Salida del hato» (`/hato/<id>#salida`) y una compra por pagar abre su edición (`/hato/gastos/<id>/editar`). Cada caso dice qué hacer («Cobra a <comprador> y registra el cobro en la venta», «Paga y marca la compra como pagada»). Las vacunas anuales y las pezuñas llevan a «Programar» (`/hato/sanidad/programar`).
