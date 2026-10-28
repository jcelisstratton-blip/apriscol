# Semáforos

Pantalla `/semaforos` (entrada **Semáforos** al principio de «Producción y manejo»). Reúne en un solo lugar lo que la app ya sabe calcular y lo muestra en tres colores con el mismo significado en toda la app: **rojo = actúa hoy**, **ámbar = programa una acción**, **verde = en orden**. Al tocar una tarjeta se abre una hoja con qué significa, cuándo se pone en cada color (con enlace a Ajustes de la finca), los animales o elementos afectados (de 20 en 20, «Mostrando X de N») y la acción sugerida. El color nunca va solo: cada tarjeta y cada fila llevan su rótulo («Rojo · actúa hoy», «Ámbar · programa»).

## Quién ve qué (`lib/semaforos.ts#areasSemaforo`)

Solo lo suyo, además de lo que permita su plan: **veterinario** → Reproducción y Sanidad; **ordeñador** → Leche; **propietario y administrador** → todo; **contador** → nada (la entrada no aparece y la ruta redirige a Hoy). Si luego se le abren más áreas a un rol, se cambia solo `AREAS_DEL_ROL`.

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
| Sanidad | Dosis y programas | vence hoy o en 7 días | ya venció |
| Sanidad | Animales en retiro | mientras dure (nunca rojo: es una restricción, no una falla) | — |
| Leche | Cadena de frío (7 días) | hasta 2 °C fuera de 4–6 °C | más de 2 °C fuera |
| Leche | Calidad del tanque (último análisis de 60 días) | células al 80 % del límite, crioscopia fría, grasa o proteína fuera de rango | residuos positivos, células sobre el límite, posible agua |
| Leche | Producción que baja | baja notable (`produccion_tendencia`) | baja fuerte |
| Corrales | Cupo y rotación | — | cupo pasado o potrero que debe desocuparse |

Cada regla tiene su función pura en `lib/semaforos.ts` (con prueba en `tests/semaforos.test.mjs`) y reutiliza las que ya existían (`lib/reproduccion.ts`, `lib/famacha.ts`, `lib/sanidad.ts`, `lib/leche-calidad.ts`, `lib/produccion.ts`, `lib/corrales.ts`): si una regla cambia allí, el semáforo cambia con ella. `lib/semaforos-servidor.ts` solo consulta, con las mismas vistas y funciones que usan Hoy, Reproducción, Sanidad y Leche, y solo trae las áreas del rol.

Los plazos que ya eran ajustables (ventana de diagnóstico, secado, último tercio, límite de células somáticas, rango de grasa y proteína) se leen de Ajustes de la finca. Los de partos (30 y 14 días) y los de hembras vacías sin servicio (60 y 120 días) también son ajustes de la finca (grupo Reproducción). Los de abortos (2 y 3 en 30 días) y mortalidad de crías (10 % y 20 %, mínimo 8 crías) son constantes en `lib/semaforos.ts`.

## Pendiente (que no se olvide)

- **Validar los plazos con un veterinario.** Los valores iniciales los puso el equipo de producto, no un especialista (por eso los números de partos y de caída de producción son punto de partida, no norma).
- Señales aprobadas pero fuera de la primera versión: pruebas (CAE, brucelosis, CMT), cuarentena, pezuñas y pediluvio, vacunas anuales, mantenimiento de la sala, ceba (pesaje atrasado y ganancia baja), alimento y dinero.
- Un resumen en Hoy y avisos al entrar al escalón de 10 días.
