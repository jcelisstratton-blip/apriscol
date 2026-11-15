# Ubicación con código DANE (fincas y ferias)

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia, se actualiza aquí en el mismo commit.

## Qué se guarda

- `fincas` y `ferias` guardan el **nombre** del departamento y del municipio (`departamento`, `municipio`, el dato que la persona ve y elige) **y** sus
  **códigos DIVIPOLA del DANE** (`departamento_dane`, 2 dígitos; `municipio_dane`, 5 dígitos), con llave foránea a `divipola_departamentos` y
  `divipola_municipios`. Para qué sirven: reportar o agrupar por zona sin depender de cómo esté escrito un nombre (hay 67 nombres de municipio
  repetidos en el país). Una restricción impide un municipio que no sea del departamento guardado.
- El catálogo (33 departamentos, 1.122 entidades: 1.103 municipios, 18 áreas no municipalizadas y 1 isla) es global y de solo lectura; ver la regla 12 de `CLAUDE.md`.

## Cómo se calculan

- El formulario no cambia: la persona elige departamento y municipio de las listas de `lib/colombia.ts` y `lib/municipios.ts`.
- El **servidor** llama a la función `divipola_codigos(departamento, municipio)` (`lib/ubicacion.ts#codigosDane`) y guarda los códigos junto al nombre
  (`crearFinca`, `editarFinca`, y al editar una feria o crearla desde un premio). Nunca se confía en un código que llegue del navegador.
- La función compara sin tildes, sin mayúsculas y sin signos. **25 municipios** se llaman distinto en la app y en el DANE (Cúcuta = San José de Cúcuta,
  Cali = Santiago de Cali, Buga, Tumaco, Tolú, Mompós, Mariquita, Ubaté, Sincé, Bogotá…): están en la tabla de equivalencias dentro de la función.
  Si no hay coincidencia devuelve `null` y **nunca adivina**; guardar la finca o la feria no se bloquea por eso.
- `tests/ubicacion.test.mjs` comprueba que **cada municipio que ofrece la app** resuelve a **un solo** código del catálogo. Si se agrega o renombra un municipio
  en `lib/municipios.ts`, esa prueba dice si falta su equivalencia.

## Reglas

- **La feria siempre pide departamento y municipio** (dónde se concursó): el formulario no ofrece «Sin especificar» (`CamposUbicacion requerido`) y la acción
  del servidor lo vuelve a exigir. En la finca siguen siendo opcionales.
- Las columnas de texto no se quitan (retrocompatible): el nombre sigue siendo el dato principal.
- La exportación de la finca rotula las columnas nuevas como «Código del departamento (DANE)» y «Código del municipio (DANE)».
