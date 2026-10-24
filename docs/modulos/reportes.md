# Reportes

Entrada propia del menú principal (`/reportes`; en el celular, dentro de «Más»). Son **listados de toda la finca** pensados para decidir: quién está vacía, quién pare esta semana, qué reproductor rinde, qué hay pendiente de sanidad. Si cambia cómo funcionan, se actualiza aquí en el mismo commit.

## Cómo se ve (decisión del dueño del producto: tarjetas donde hay un concepto, filas donde hay datos)

- **`/reportes`**: tarjetas por área (Población, Reproducción, Producción, Sanidad y, para quien ve las cuentas, Dinero → lleva a `/costos`). Cada tarjeta lleva directo al reporte; algunas muestran un conteo (inventario, gestantes, por palpar, retiro) que **es el mismo que mostrará el reporte**: nunca se hace una cuenta aparte. `GruposReportes` solo dibuja.
- **`/reportes/[id]`** (`VistaReporte`): «¿Cómo funciona?» (`AyudaModulo`, los textos de `catalogo.ts`) → filtros como **tarjetas** (`FiltrosReporte`; la especie solo si la finca tiene las dos) → periodo (`FiltroPeriodo`, solo en los reportes que se miran por fechas) → cifras → botón de Excel → lista (`ListaReporte`: buscador desde 8 filas, tramos de 20, «Mostrando X de N»).
- **Cada fila** muestra el arete y el nombre (con enlace a la ficha), una insignia con la situación y **solo los datos que aplican a ese registro** (un aborto no tiene crías ni pesos; un valor vacío no se dibuja). El **Excel sí lleva todas las columnas**, también las que en pantalla van en el título.
- Los filtros viven en la dirección (`?categoria=…&especie=…&periodo=…`), se pueden compartir y recargar. Un valor que no sea una opción válida vuelve al de por defecto (la primera opción): nada de la dirección llega a una consulta.

## Los reportes

| Reporte | Módulo que hay que ver | Qué es |
|---|---|---|
| Inventario del hato | Hato | Animales activos con categoría por edad, raza, propósito, lote y —si la persona ve Reproducción y Corrales— estado reproductivo y corral. |
| Salidas del hato | Hato | Ventas, muertes, sacrificios y pérdidas del periodo. El valor y el cobro solo se ven con el módulo de cuentas. |
| Hembras vacías | Reproducción | Sin servicio vigente o sin datos, con días abiertos y si ya están listas para servicio. |
| Por palpar | Reproducción | Servidas sin diagnóstico (ventana de los Ajustes) y diagnósticos dudosos para repetir (14–21 días). |
| Gestantes y partos | Reproducción | Gestación confirmada: fecha prevista, plazo, etapa, fetos esperados, por secar. |
| Partos del periodo | Reproducción | Partos y abortos con crías, y los indicadores del periodo. |
| Rendimiento de sementales | Reproducción | Preñez, partos y crías por reproductor, y la tasa de preñez de monta, inseminación y transferencia. |
| Ordeño y secas | Leche | En ordeño o secas con la producción de los últimos 30 días. |
| Peso y condición corporal | **Carne** (los pesajes son de ese módulo: plan Profesional) | Último peso, ganancia diaria y alertas. |
| Animales en retiro | Sanidad | Leche o carne que aún no se pueden usar y el tratamiento que lo causa. |
| Sanidad pendiente | Sanidad | Dosis, FAMACHA, podología y pediluvio. |

**Quién ve qué**: `reportesVisibles(puedeVer)` filtra el catálogo por el módulo de cada reporte (el rol y el plan salen de `lib/permisos.ts`); la entrada del menú aparece si hay al menos uno (o si ve las cuentas). Un reporte al que la persona no llega por la dirección la devuelve a `/reportes`. **La autoridad real es la RLS**: los reportes se arman con la sesión de la persona y nunca con una llave de servicio.

## Definiciones (si una cambia, cambia aquí y en `catalogo.ts`/`calculos.ts`)

- **Categoría por edad** (`categoriaAnimal`): cría hasta `EDAD_DESTETE_MESES` (4); levante hasta la **edad mínima de servicio de los Ajustes** (`servicio_edad_min_meses`); adulta o adulto desde ahí. Sin fecha de nacimiento no se adivina: «Sin fecha de nacimiento», aparte.
- **Lista para servicio** (`aptitudServicio`): edad mínima de los Ajustes (una hembra que ya parió es adulta aunque no se sepa su fecha de nacimiento) y, si se pesó, la condición corporal mínima de los Ajustes (`servicio_cc_min`). Las crías de menos de 4 meses nunca se listan como vacías.
- **Ventana del diagnóstico**: de `dx_prenez_dia_desde` a `dx_prenez_dia_hasta` días desde el servicio (Ajustes). Antes = «aún no»; dentro = «toca»; después = «atrasado». Un diagnóstico dudoso se repite entre `DIAS_REPETIR_DX_DESDE` y `HASTA` días después.
- **Etapa de la gestación**: primer tercio, segundo tercio y último tercio; el último empieza el día `ultimo_tercio_dia` de los Ajustes. **Por secar**: en lactancia y a `secado_dias_antes_parto` días del parto o menos. **Crías esperadas**: los fetos de la ecografía que confirmó la gestación; sin ecografía se cuenta una (por eso es un mínimo).
- **Resultado de un servicio** (`resultadoServicio`): **el parto o aborto registrado manda sobre el diagnóstico** (si parió, quedó preñada aunque nadie la diagnosticara); sin parto, el último diagnóstico; dudoso o ninguno = **pendiente**. **Tasa de preñez** = preñados (parto, aborto o gestante) ÷ servicios con resultado; **los pendientes no cuentan** para no castigar al reproductor por falta de datos. Con menos de `MINIMO_CONFIABLE` (10) servicios con resultado el reporte avisa que la tasa no es confiable. Un reproductor de fuera se agrupa por su nombre sin importar mayúsculas ni espacios.
- **Partos**: prolificidad = crías nacidas ÷ partos (los abortos no cuentan como parto); mortalidad al nacer = muertas ÷ nacidas; tasa de abortos = abortos ÷ (partos + abortos); **intervalo entre partos** = días entre cada parto (no aborto) y el anterior de la misma hembra, con **todo** su historial, esté o no en el periodo.
- **Peso**: ganancia diaria entre los dos últimos pesajes; **no se calcula con menos de `DIAS_MINIMOS_GDP` (7) días** entre ellos, y solo se marca «crece poco» en crías y levante (contra `gdp_minima_g` de los Ajustes). Condición corporal: baja menos de `CC_BAJA` (2,5), alta más de `CC_ALTA` (3,5). «Sin pesar» a partir de `DIAS_SIN_PESAR` (90).
- **Producción** (ordeño): litros de los últimos `DIAS_PRODUCCION` (30) días; el promedio diario cuenta solo los días con ordeño. En ordeño = lactancia abierta; se listan las hembras de leche o doble propósito y las de carne que alguna vez ordeñaron.
- **Sanidad pendiente**: las dosis programadas solo se listan hasta `DIAS_ADELANTE_DOSIS` (30) días hacia adelante; FAMACHA ≥ 3 sin desparasitar desde la evaluación; podología y pediluvio según los días de los Ajustes (el pediluvio cambia en meses de lluvia).

## Excel

`/reportes/[id]/exportar?…` con **los mismos filtros y periodo de la pantalla** y el mismo cálculo (`prepararReporte`): archivo y lista siempre coinciden. Hoja de datos (fechas como fecha de verdad, números como números, filtros para ordenar) y hoja «Indicadores» con las cifras y las notas. **Va con el servicio `reportes` de los planes (Profesional)**, el mismo del Excel de costos; ver la lista en pantalla es de todos los planes. Cambiar esto es una línea en `app/(app)/reportes/[id]/page.tsx` y en el `route.ts`.

## Cómo está hecho

- `lib/reportes/catalogo.ts`: los reportes (módulo, filtros, ayuda, estado vacío). `calculos.ts` y `formato.ts`: lo puro. `base.ts`: `traerTodo` (PostgREST corta en 1000 filas: se pide por páginas hasta 20.000 y, si se llega al tope, el reporte avisa que quedó incompleto), `cargarAnimales`, columnas. `excel.ts`: el libro. `servidor.ts` (`server-only`): permisos, filtros y sesión.
- **Cada informe** (`lib/reportes/informes/<id>.ts`) tiene `informeX(contexto)` que **trae los datos** y `construirX(datos)` que los **arma, sin base de datos**: así se prueba con casos reales (`tests/reportes.test.mjs`, incluidos 800 animales y el Excel leído de vuelta). Todo mensaje ya está en lenguaje de persona.
- **Vista nueva** `v_peso_animal` (`security_invoker`): último pesaje, anterior y última condición corporal de cada animal activo (migración `…_vista_peso_animal`). El resto sale de las vistas y funciones que ya existían (`v_repro_hembras`, `v_lactancias_resumen`, `produccion_por_animal`, `animales_en_retiro`, `v_sanidad_pendiente`…).
- **Reporte nuevo ⇒** una entrada en `REPORTES`, su escena en `ESCENA_REPORTE` y las de sus opciones en `ESCENA_FILTRO`, su archivo en `informes/`, su línea en `generar.ts`, y pruebas. La primera opción de cada filtro es siempre el valor por defecto («todos»); el catálogo se prueba para que ninguna opción quede sin tarjeta.
- Celular: probado a 360, 320 y 1440 px con cientos de filas y texto largo sin espacios (`scrollWidth == clientWidth`, ninguna caja que sobresalga salvo las filas que se desplazan a propósito).
