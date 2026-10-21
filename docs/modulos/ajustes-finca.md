# Ajustes de la finca

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia el proceso, se actualiza aquí en el mismo commit.

## Ajustes de la finca (umbrales que define el propietario)

Los tiempos, límites y criterios zootécnicos **no son constantes del código**: son ajustes de cada finca, en `finca_ajustes` (una fila por finca) y
`finca_ajustes_especie` (una fila por finca y especie: gestación, peso de faena, rangos de grasa y proteína). **Todos los miembros los leen; solo el
propietario los cambia** (RLS propia, no `crear_politicas_finca`: no son un módulo). Se ven y editan en `/mas/ajustes` (`FormAjustes`, un formulario por
grupo con «Volver a los valores sugeridos»). Cada finca tiene **siempre** su fila: la crea un disparador al nacer la finca (`private.ajustes_crear`) y
`asegurar_ajustes_finca` es la red de seguridad. Los valores de fábrica viven **solo en la base** (defaults de columna y `parametros_especie`) y
«restablecer» es `restablecer_ajustes_finca`: nunca se repiten en TypeScript. El umbral de endogamia sigue en `fincas.umbral_endogamia` y las reglas de ceba en
`reglas_ceba`; la pantalla de ajustes solo los enlaza.
- **Ajuste nuevo ⇒** columna con default y `check` en `finca_ajustes` (o en la tabla por especie y su default en `parametros_especie`), la entrada en
  `GRUPOS_AJUSTES` de `lib/ajustes.ts` (de ahí salen el formulario, la validación y la lectura), la función en `restablecer_ajustes_finca` y los tipos en `lib/tipos.ts`.
  Para leerlos en el servidor, `obtenerAjustes()` (`lib/ajustes-servidor.ts`); un componente de cliente recibe lo que necesita por props.
- **No se muestra un ajuste que no hace nada sin decirlo:** los de módulos que aún no existen (alimentación e inventarios, nómina, avisos de vacunas) quedan
  guardados y su grupo lleva una nota («se usarán cuando llegue…»). Al construir el módulo, se quita la nota.
- **No son ajustables a propósito:** el bloqueo por periodo de retiro (es una salvaguarda sanitaria) y todo lo que fija la ley (recargos, retenciones, SMMLV): eso se
  define con su fuente oficial cuando se construya la nómina.
- Conectados hoy: gestación (vistas `v_servicios`, `v_repro_hembras`, `candidatos_ceba`), criterios de la monta, diagnóstico de preñez, último tercio y secado
  (Reproducción), ganancia mínima y peso de faena (Carne), límite de células somáticas y rangos de grasa y proteína (Leche), podología y pediluvio (Sanidad).
