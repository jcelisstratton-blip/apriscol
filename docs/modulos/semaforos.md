# Semáforos

Pantalla `/semaforos` (entrada **Semáforos** al principio de «Producción y manejo»). Reúne en un solo lugar lo que la app ya sabe calcular y lo muestra en tres colores con el mismo significado en toda la app: **rojo = actúa hoy**, **ámbar = programa una acción**, **verde = en orden**. Al tocar una tarjeta se abre una hoja con qué significa, cuándo se pone en cada color (con enlace a Ajustes de la finca), los animales o elementos afectados (de 20 en 20, «Mostrando X de N») y la acción sugerida. El color nunca va solo: cada tarjeta y cada fila llevan su rótulo («Rojo · actúa hoy», «Ámbar · programa»).

## Quién ve qué (`lib/semaforos.ts#areasSemaforo`)

Solo lo suyo, además de lo que permita su plan (Ceba pide el módulo Carne; Dinero, Contabilidad): **veterinario** → Reproducción, Sanidad e Inventario (de medicamentos); **ordeñador** → Leche y Alimento; **propietario y administrador** → todo; **contador** → Dinero. Si luego se le abren más áreas a un rol, se cambia solo `AREAS_DEL_ROL`.

## Las señales

| Área | Señal | Ámbar | Rojo |
|---|---|---|---|
| Reproducción | Partos que se acercan | faltan `parto_preparar_dias` (30) o menos (a `parto_vigilar_dias`, 14, vigilar a diario) o pasó hasta 7 días | pasaron más de 7 días de su fecha |
| Reproducción | Servicios sin diagnóstico | dentro de la ventana de diagnóstico de Ajustes | ya la pasó |
| Reproducción | Diagnósticos por repetir | entre 14 y 21 días después del dudoso | más de 21 días |
| Reproducción | Secado y último tercio | faltan los días de secado de Ajustes o menos (o lleva los del último tercio) | faltan 7 días o menos y sigue en ordeño |
| Reproducción | Vacías sin servicio | pasaron `vacia_aviso_dias` (60) desde el último parto, sin servicio y fuera de una temporada de monta abierta | pasaron `vacia_urgente_dias` (120) |
| Reproducción | Abortos agrupados | 2 abortos en 30 días (o uno de causa infecciosa) | 3 o más en 30 días |
| Reproducción | Mortalidad de crías | más de 10 % de las nacidas en 90 días (nacidas muertas + muertas después); con menos de 8 crías no se evalúa | más de 20 % |
| Sanidad | FAMACHA | puntaje 3 sin desparasitar | puntaje 4 o 5 sin desparasitar |
| Sanidad | Cargas de parásitos altas (coprológico) | — | último coprológico desde 1.000 HPG sin desparasitar (ámbar); desde 3.000 HPG (rojo). Trae «Qué hacer» |
| Sanidad | Dosis y programas | vence hoy o en 7 días | ya venció |
| Sanidad | Animales en retiro | mientras dure (nunca rojo: es una restricción, no una falla) | — |
| Sanidad | Pruebas de laboratorio | sospechosa reciente, positivo de CMT o cultivo de los últimos 60 días, o sin resultado | positivo de CAE, brucelosis o paratuberculosis; sospechoso sin repetir en 30 días |
| Sanidad | Cuarentena de animales nuevos | en cuarentena sin cumplir los 21 días | entró y no pasó por cuarentena |
| Sanidad | Pezuñas y pediluvio | pasó el plazo de Ajustes (solo animales de 3 meses o más) | más de 14 días de atraso o sin registro |
| Sanidad | Vacunas anuales | faltan 30 días o menos para repetir la campaña de rabia o de clostridiosis | vencida o sin ninguna campaña; se reconoce por el nombre del producto y solo se evalúa si la finca definió el plazo en Ajustes → Sanidad |
| Leche | Cadena de frío (7 días) | hasta 2 °C fuera de 4–6 °C | más de 2 °C fuera |
| Leche | Calidad del tanque (último análisis de 60 días) | células al 80 % del límite, crioscopia fría, grasa o proteína fuera de rango | residuos positivos, células sobre el límite, posible agua |
| Leche | Mantenimiento de la sala de ordeño | toca en los próximos 7 días | atrasado | Cada caso abre «Registrar» con el tipo, el equipo y el responsable de la vez anterior y la próxima fecha con el mismo intervalo (`/leche/equipo/nuevo?de=<id>`).
| Leche | Producción que baja | baja notable (`produccion_tendencia`) | baja fuerte |
| Ceba | Pesaje atrasado | pasó el plazo de las reglas de ceba | el doble del plazo o nunca pesado |
| Ceba | Ganancia de peso baja | menos del mínimo de Ajustes → Ceba | menos de la mitad |
| Dinero | Compras por pagar | vence en los próximos 7 días | ya venció |
| Dinero | Ventas por cobrar | se espera cobrar en los próximos 7 días | el cobro esperado ya pasó |
| Corrales | Cupo y rotación | — | cupo pasado o potrero que debe desocuparse |

Cada regla tiene su función pura en `lib/semaforos.ts` (con prueba en `tests/semaforos.test.mjs`) y reutiliza las que ya existían (`lib/reproduccion.ts`, `lib/famacha.ts`, `lib/sanidad.ts`, `lib/leche-calidad.ts`, `lib/produccion.ts`, `lib/corrales.ts`): si una regla cambia allí, el semáforo cambia con ella. `lib/semaforos-servidor.ts` solo consulta, con las mismas vistas y funciones que usan Hoy, Reproducción, Sanidad y Leche, y solo trae las áreas del rol.

Los plazos que ya eran ajustables (ventana de diagnóstico, secado, último tercio, límite de células somáticas, rango de grasa y proteína) se leen de Ajustes de la finca. Los de partos (30 y 14 días) y los de hembras vacías sin servicio (60 y 120 días) también son ajustes de la finca (grupo Reproducción). Los de abortos (2 y 3 en 30 días) y mortalidad de crías (10 % y 20 %, mínimo 8 crías) son constantes en `lib/semaforos.ts`.

## Inventario de medicamentos

Área **Inventario** (propietario, administrador y veterinario; desde el plan Intermedio): `senalInventario` en `lib/semaforos.ts`, con los datos de `inventario_productos`. **Rojo:** lote vencido, producto agotado o aplicado de más (descuadrado). **Ámbar:** stock en el mínimo o por debajo, o un lote que vence en 30 días o menos (`DIAS_AVISO_VENCIMIENTO`). Un producto «por contar» (sin conteo de apertura) no avisa. Detalle en `inventario.md`.

## Alimento

Área **Alimento** (propietario, administrador y ordeñador; desde el plan Intermedio): `senalAlimento`, con los datos de `inventario_alimento` y el plazo `stock_autonomia_dias` de Ajustes de la finca. **Rojo:** agotado, descuadrado o que alcanza para menos de la mitad del plazo. **Ámbar:** alcanza para menos del plazo. Sin al menos 3 días con salidas en las últimas dos semanas no se calcula nada. Detalle en `inventario.md`.

## En Hoy

`components/ResumenSemaforos.tsx`: tarjeta «Semáforos» con los conteos y las 4 señales más urgentes (rojo primero), con enlace a la pantalla completa. Se calcula con el mismo `cargarSemaforos` y, si falla, no tumba la pantalla de inicio.

## Pendiente (que no se olvide)

- **Validar los plazos con un veterinario.** Los valores iniciales los puso el equipo de producto, no un especialista (partos 30 y 14 días, vacías 60 y 120, abortos 2 y 3 en 30 días, mortalidad de crías 10 % y 20 %, caída de producción).
- **Alimento (autonomía del stock):** `stock_autonomia_dias` existe en Ajustes, pero la app todavía no lleva un inventario de alimento (solo el de medicamentos y vacunas, ver `inventario.md`), así que no había de qué calcular esa señal; ya existe (ver «Alimento» arriba).
- Las vacunas se reconocen por el nombre del producto; si algún día el catálogo guarda a qué enfermedad protege cada vacuna, se cambia ahí.
- Aviso al entrar al escalón de 10 días: hoy lo cubre la tarjeta de Hoy (la señal de partos pasa a «vigílala a diario»); un aviso aparte (notificación) no existe.

## «Qué hacer» en cada caso

Un caso de la lista puede traer `queHacer` (una frase con el paso siguiente) y se muestra bajo el detalle. Hoy lo llevan los partos
atrasados y los que ya pasaron su fecha. La ficha de la hembra muestra solo los botones que aplican a su estado: gestante → Parto
(«Registrar parto o aborto» si está atrasada; «Repetir diagnóstico» solo si está en observación); servida → Diagnóstico, Nuevo servicio, Parto;
vacía o sin datos → Servicio.

## Qué hacer en cada tarea

**Toda señal dice qué hacer** (`queHacer` en `Senal`; `armarSenal` lanza un error si falta, y el tipo la exige: una señal nueva no compila sin ella). Es una o dos frases en lenguaje de finca, con el verbo primero («Aplica cada dosis pendiente…», «Pasa animales a otra instalación…», «Llama a tu veterinario hoy…»). Se ve en tres sitios: arriba de la hoja de cada tarea en Semáforos (en un recuadro, antes de los casos), en cada tarea del detalle de un área del bot de Telegram (`➜ Qué hacer: …`) y, cuando la tarea es de un solo caso con su propia instrucción más concreta, esa va en lugar de la general (el bot no repite las dos). Además, algunos casos traen la suya (`ItemSenal.queHacer`: partos, FAMACHA, corrales con su sugerencia de a dónde, inventario y alimento).

**La explicación se pliega.** «Qué significa» y «Cuándo se pone en cada color» (con el enlace a Ajustes) van dentro de «¿Cómo funciona esta señal?», cerrado por defecto: lo primero que se ve es qué hacer y los casos concretos.

**Criterio con lo clínico.** Las instrucciones solo dicen lo que ya dicen las reglas de la app (por ejemplo, desparasitar FAMACHA 4 o 5, los 21 días mínimos de cuarentena, no mandar al tanque la leche en retiro) y, donde hay decisión del veterinario, lo remiten a él. **Pendientes de revisión por el veterinario antes de darlas por definitivas:** abortos agrupados, mortalidad de crías, coprológico, pruebas de laboratorio, calidad de la leche, cadena de frío y ganancia de peso baja.

## Recorrer los casos de una señal
Al abrir un caso de una señal que tiene **varios** (cuatro animales sin pesar, tres vacunas…), la lista queda guardada en la pestaña (`lib/cola-semaforo.ts`, `sessionStorage`) y `ColaSemaforo` (en el layout de la app) muestra arriba, en cualquier pantalla a la que se llegue, «Caso N de M», **Anterior / Siguiente** y «Volver a la lista» (reabre la señal con la lista al día). Se quita con la «x» y no aparece en `/semaforos`. Una señal con un solo caso no la usa. El caso se ubica por la ruta; en una pantalla intermedia (el formulario de registrar) se queda en el último.

## Si ya lo hiciste y sigue aquí
Una señal que depende de una tendencia, de un resultado nuevo o del paso del tiempo (ganancia de peso baja, producción que baja, abortos, mortalidad, frío, calidad, pruebas, cuarentena, retiro) **no se quita al registrar** lo que se hizo. Esas señales llevan `sigueAqui` (se ve en la hoja como «¿Ya lo hiciste y sigue aquí?») con por qué sigue y qué la saca. Una señal nueva de este tipo debe escribirlo. Además, un caso con `atendido` (`ItemSenal.atendido`) **no cuenta** como pendiente (ni en el nivel, ni en el resumen, ni en el bot) y se ve aparte en «Ya atendidos»: en la ganancia de peso baja, el animal pesado hace ≤ 3 días (`DIAS_PESADO_RECIENTE`) pasa ahí con «Pesado hoy» y la fecha de su próximo pesaje; si luego sigue ganando poco, vuelve a la lista. (El registro de un segundo peso el mismo día se rechaza.)
