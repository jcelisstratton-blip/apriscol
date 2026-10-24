# Reproducción

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia el proceso, se actualiza aquí en el mismo commit.

## Empadronamiento (temporada de monta)

Se trabaja en **Hato → filtro «Empadronamiento»** (`/hato?vista=empadronamiento`: crear, agregar hembras, cerrar) y **Reproducción → Empadronamiento** (`/reproduccion?vista=empadronamiento`) es el resumen global con filtros de estado y fechas y con qué hembras se hizo cada temporada. Las hembras se eligen **ya al crear la temporada** (hoja con endogamia por pareja) o después con «Agregar hembras», y **solo entran hembras libres**: sin gestación, sin servicio esperando diagnóstico y fuera de otra temporada abierta (UI, acción y disparador lo exigen). El semental puede ser **del hato o de otro hato** (prestado: `sementales_externos` con chip, hato de origen, dueño, préstamo y sanidad; sin genealogía, así que no hay endogamia que calcular). **Cada semental tiene su número de hembras** (`empadronamiento_machos.num_hembras`, obligatorio): es un **tope exacto** y, al crear la temporada, las hembras elegidas deben ser justo ese número (UI, acción y disparador lo exigen). El máximo recomendado por especie y edad (`capacidadSemental`) solo avisa cuando el número lo supera. La endogamia de una pareja **se calcula y se bloquea antes de asignarla** (`empadronamiento_endogamia`, disparador `emp_hembras_validar`): «llega al umbral» = misma regla que el color «Alta» (`private.sobre_umbral`); solo entra como **excepción registrada**. Al cerrar, cada hembra queda **servida** (monta natural en la fecha base) y de ahí manda `v_repro_hembras`; nunca se guarda una fecha de parto aparte. Una temporada cerrada no se cambia.

## Servicios (monta, inseminación y transferencia de embrión)

Se registran desde la ficha de la hembra (`FormServicio`) y cada tipo pide solo lo suyo; la acción (`leerServicio`) lo exige y **solo guarda en cada tipo los datos que le corresponden** (no queda una pajilla en una monta):

- **Monta natural:** reproductor obligatorio, del hato o de otra finca (`macho_id` / `macho_externo`). Sin pajilla.
- **Inseminación artificial:** reproductor donante (hato, otra finca o banco), **código o banco de la pajilla / lote** (`semen_lote`) y **tipo de inseminación** (`tecnica_inseminacion`: cervical, transcervical, laparoscópica, como tarjetas); técnico opcional (`responsable`).
- **Transferencia de embrión:** la hembra del servicio es la **receptora**. Padre genético (`macho_id` / `macho_externo`), **madre genética** (`madre_genetica_id` hembra del hato de la misma especie y distinta de la receptora, o `madre_genetica_externa`), **código o lote del embrión** (`embrion_codigo`) y **tipo de transferencia** (`tipo_transferencia`: fresco, vitrificado, congelado, como tarjetas); técnico opcional.

Migración `20261024135534_servicios_datos_por_tipo` (solo agrega columnas). `v_servicios` no incluye las columnas nuevas (la usa solo el inicio). Los servicios antiguos que no tengan estos datos se leen igual; al editarlos se piden los que falten.
