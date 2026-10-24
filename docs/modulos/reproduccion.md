# Reproducción

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia el proceso, se actualiza aquí en el mismo commit.

## Empadronamiento (temporada de monta)

Se trabaja en **Hato → filtro «Empadronamiento»** (`/hato?vista=empadronamiento`: crear, agregar hembras, cerrar) y **Reproducción → Empadronamiento** (`/reproduccion?vista=empadronamiento`) es el resumen global con filtros de estado y fechas y con qué hembras se hizo cada temporada. Las hembras se eligen **ya al crear la temporada** (hoja con endogamia por pareja) o después con «Agregar hembras», y **solo entran hembras libres**: sin gestación, sin servicio esperando diagnóstico y fuera de otra temporada abierta (UI, acción y disparador lo exigen). El semental puede ser **del hato o de otro hato** (prestado: `sementales_externos` con chip, hato de origen, dueño, préstamo y sanidad; sin genealogía, así que no hay endogamia que calcular). **Cada semental tiene su número de hembras** (`empadronamiento_machos.num_hembras`, obligatorio): es un **tope exacto** y, al crear la temporada, las hembras elegidas deben ser justo ese número (UI, acción y disparador lo exigen). El máximo recomendado por especie y edad (`capacidadSemental`) solo avisa cuando el número lo supera. La endogamia de una pareja **se calcula y se bloquea antes de asignarla** (`empadronamiento_endogamia`, disparador `emp_hembras_validar`): «llega al umbral» = misma regla que el color «Alta» (`private.sobre_umbral`); solo entra como **excepción registrada**. Al cerrar, cada hembra queda **servida** (monta natural en la fecha base) y de ahí manda `v_repro_hembras`; nunca se guarda una fecha de parto aparte. Una temporada cerrada no se cambia.

## Servicios (monta, inseminación y transferencia de embrión)

Se registran desde la ficha de la hembra (`FormServicio`) y cada tipo pide solo lo suyo; la acción (`leerServicio`) lo exige y **solo guarda en cada tipo los datos que le corresponden** (no queda una pajilla en una monta):

- **Monta natural:** reproductor obligatorio, del hato o de otra finca (`macho_id` / `macho_externo`). Sin pajilla.
- **Inseminación artificial:** reproductor donante (hato, otra finca o banco), **código o banco de la pajilla / lote** (`semen_lote`) y **tipo de inseminación** (`tecnica_inseminacion`: cervical, transcervical, laparoscópica, como tarjetas); técnico opcional (`responsable`).
- **Transferencia de embrión:** la hembra del servicio es la **receptora**. Padre genético (`macho_id` / `macho_externo`), **madre genética** (`madre_genetica_id` hembra del hato de la misma especie y distinta de la receptora, o `madre_genetica_externa`), **código o lote del embrión** (`embrion_codigo`) y **tipo de transferencia** (`tipo_transferencia`: fresco, vitrificado, congelado, como tarjetas); técnico opcional.

**Endogamia al elegir el macho** (`EndogamiaServicio`, `lib/cruza-cliente.ts`): en cuanto hay macho y pareja, el formulario muestra el porcentaje de endogamia de la cría, su nivel frente al umbral de la finca (aceptable, a vigilar, alta, muy alta), la recomendación, un aviso si algún pedigrí está incompleto y «Ver de dónde viene» (ancestros repetidos y rutas). Usa los mismos cálculos del simulador de cruza (`simular_endogamia`, `completitud_pedigri`, `explicar_cruza`). La pareja es **la hembra** en la monta y la inseminación, y **la madre genética** en la transferencia de embrión (la receptora no aporta genes). Con un macho o una madre de otra finca no hay pedigrí: dice «Sin dato de endogamia», nunca 0 %. **Solo informa, no bloquea**: el servicio es un hecho que ya ocurrió (a diferencia del empadronamiento, que sí pide excepción antes de asignar la pareja); no se guarda, se calcula.

Migración `20261024135534_servicios_datos_por_tipo` (solo agrega columnas). `v_servicios` no incluye las columnas nuevas (la usa solo el inicio). Los servicios antiguos que no tengan estos datos se leen igual; al editarlos se piden los que falten.

## Diagnóstico de gestación

Se registra desde la ficha de la hembra (`FormDiagnostico`). **Siempre cuelga de un servicio activo**: `servicioVigente` (`lib/servicio-vigente.ts`) lo busca en el servidor (el navegador no lo elige) y es el último servicio de la hembra mientras no haya un parto o aborto desde entonces y su último diagnóstico no sea «Vacía». Sin él no se guarda (la pantalla lo explica y lleva a «Registrar servicio»; la acción y el disparador `diagnosticos_validar_servicio` lo exigen). Al editar, el diagnóstico conserva su servicio.

Cada método pide lo suyo y solo guarda sus datos (opciones como tarjetas):

- **Ecografía** (si el resultado no es «Vacía»): días de gestación estimados, fetos detectados (único, mellizos, trillizos, cuatro o más) y viabilidad fetal (latido / sin actividad). Con «Gestante» los tres son obligatorios y «Sin actividad» no confirma gestación; los días no pueden superar los transcurridos desde el servicio (+10).
- **Palpación:** indicador (no volvió a celo, retornó al celo, llenado uterino, revisión manual; «retornó al celo» no puede quedar gestante) y condición corporal (obligatoria si queda vacía: decide si vuelve al lote de reproducción).
- **Otro método:** prueba o kit y su resultado, ambos obligatorios.

El estado sale de `v_repro_hembras`, no se guarda: **Gestante** → estado gestante y parto previsto = servicio + días de gestación de la especie en la finca (150 caprinos, 147 ovinos por omisión); **Vacía** → disponible otra vez (servicio, sincronización o empadronamiento); **Dudoso** → sigue «servida» y se muestra como **«En observación»** (`enObservacion`), y el panel avisa para repetir la prueba entre **14 y 21 días** después (`ventanaRepetirDx`, tarjeta «Diagnósticos para repetir»). Migración `20261024140929_diagnosticos_datos_por_metodo` (solo agrega columnas y un disparador de inserción).
