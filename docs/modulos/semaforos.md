# Semáforos

Pantalla `/semaforos` (entrada **Semáforos** al principio de «Producción y manejo»). Reúne en un solo lugar lo que la app ya sabe calcular y lo muestra en tres colores con el mismo significado en toda la app: **rojo = actúa hoy**, **ámbar = programa una acción**, **verde = en orden**. Al tocar una tarjeta se abre una hoja con qué significa, cuándo se pone en cada color (con enlace a Ajustes de la finca), los animales o elementos afectados (de 20 en 20, «Mostrando X de N») y la acción sugerida. El color nunca va solo: cada tarjeta y cada fila llevan su rótulo («Rojo · actúa hoy», «Ámbar · programa»).

## Quién ve qué (`lib/semaforos.ts#areasSemaforo`)

Solo lo suyo, además de lo que permita su plan (Ceba pide el módulo Carne; Dinero, Contabilidad): **veterinario** → Reproducción y Sanidad; **ordeñador** → Leche; **propietario y administrador** → todo; **contador** → Dinero. Si luego se le abren más áreas a un rol, se cambia solo `AREAS_DEL_ROL`.

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
| Leche | Mantenimiento de la sala de ordeño | toca en los próximos 7 días | atrasado |
| Leche | Producción que baja | baja notable (`produccion_tendencia`) | baja fuerte |
| Ceba | Pesaje atrasado | pasó el plazo de las reglas de ceba | el doble del plazo o nunca pesado |
| Ceba | Ganancia de peso baja | menos del mínimo de Ajustes → Ceba | menos de la mitad |
| Dinero | Compras por pagar | vence en los próximos 7 días | ya venció |
| Dinero | Ventas por cobrar | se espera cobrar en los próximos 7 días | el cobro esperado ya pasó |
| Corrales | Cupo y rotación | — | cupo pasado o potrero que debe desocuparse |

Cada regla tiene su función pura en `lib/semaforos.ts` (con prueba en `tests/semaforos.test.mjs`) y reutiliza las que ya existían (`lib/reproduccion.ts`, `lib/famacha.ts`, `lib/sanidad.ts`, `lib/leche-calidad.ts`, `lib/produccion.ts`, `lib/corrales.ts`): si una regla cambia allí, el semáforo cambia con ella. `lib/semaforos-servidor.ts` solo consulta, con las mismas vistas y funciones que usan Hoy, Reproducción, Sanidad y Leche, y solo trae las áreas del rol.

Los plazos que ya eran ajustables (ventana de diagnóstico, secado, último tercio, límite de células somáticas, rango de grasa y proteína) se leen de Ajustes de la finca. Los de partos (30 y 14 días) y los de hembras vacías sin servicio (60 y 120 días) también son ajustes de la finca (grupo Reproducción). Los de abortos (2 y 3 en 30 días) y mortalidad de crías (10 % y 20 %, mínimo 8 crías) son constantes en `lib/semaforos.ts`.

## En Hoy

`components/ResumenSemaforos.tsx`: tarjeta «Semáforos» con los conteos y las 4 señales más urgentes (rojo primero), con enlace a la pantalla completa. Se calcula con el mismo `cargarSemaforos` y, si falla, no tumba la pantalla de inicio.

## Pendiente (que no se olvide)

- **Validar los plazos con un veterinario.** Los valores iniciales los puso el equipo de producto, no un especialista (partos 30 y 14 días, vacías 60 y 120, abortos 2 y 3 en 30 días, mortalidad de crías 10 % y 20 %, caída de producción).
- **Alimento (autonomía del stock):** `stock_autonomia_dias` existe en Ajustes, pero la app todavía no lleva un inventario de alimento, así que no hay de qué calcular la señal. Se construye cuando exista el stock.
- Las vacunas se reconocen por el nombre del producto; si algún día el catálogo guarda a qué enfermedad protege cada vacuna, se cambia ahí.
- Aviso al entrar al escalón de 10 días: hoy lo cubre la tarjeta de Hoy (la señal de partos pasa a «vigílala a diario»); un aviso aparte (notificación) no existe.

## «Qué hacer» en cada caso

Un caso de la lista puede traer `queHacer` (una frase con el paso siguiente) y se muestra bajo el detalle. Hoy lo llevan los partos
atrasados y los que ya pasaron su fecha. La ficha de la hembra muestra solo los botones que aplican a su estado: gestante → Parto
(«Registrar parto o aborto» si está atrasada; «Repetir diagnóstico» solo si está en observación); servida → Diagnóstico, Nuevo servicio, Parto;
vacía o sin datos → Servicio.
