# Ubicación por país (fincas y ferias)

Movido desde `CLAUDE.md`; sigue siendo ley del repo. Si cambia, se actualiza aquí en el mismo commit.

## Qué se guarda

- `fincas` y `ferias` guardan el **país** (`pais`, ISO 3166-1 alfa-2, de fábrica `CO`), el **nombre** del primer y segundo nivel (`departamento`, `municipio`:
  lo que la persona ve y elige; en Ecuador serán la provincia y el cantón) **y** los **códigos oficiales** de cada nivel (`nivel1_codigo`, `nivel2_codigo`).
  Para qué sirven los códigos: reportar o agrupar por zona sin depender de cómo esté escrito un nombre (en Colombia hay 67 nombres de municipio repetidos).
- Las llaves son **compuestas** `(pais, codigo)` → `geo_divisiones`: los códigos de dos países pueden coincidir (el `05` de Colombia y el `05` de Ecuador).
- `departamento_dane` y `municipio_dane` (los de antes, solo Colombia) **se siguen llenando** mientras existan, y se quitarán cuando todo lea `nivel1_codigo` y
  `nivel2_codigo` (la migración que los quite la corre el propietario en el Editor SQL, porque lleva `drop`).

## El catálogo (global, de solo lectura, regla 12 de `CLAUDE.md`)

- `geo_paises`: cada país que Apriscol conoce, cómo se llaman sus dos niveles («Departamento/Municipio», «Provincia/Cantón»), su moneda y su zona horaria,
  y si está **activo** (solo los activos se ofrecen).
- `geo_divisiones`: la división oficial de cada país con los códigos de su organismo estadístico. Nivel 1 = departamento/provincia, 2 = municipio/cantón,
  3 = reservado (parroquia en Ecuador). **Colombia**: 33 + 1.122 entidades (1.103 municipios, 18 áreas no municipalizadas y 1 isla), DIVIPOLA del DANE.
- `geo_alias`: equivalencias entre el nombre que ofrece la app y el oficial (en Colombia, 25 municipios y 2 departamentos: Cúcuta = San José de Cúcuta,
  Cali = Santiago de Cali, Buga, Tumaco, Tolú, Mompós, Mariquita, Ubaté, Sincé, Bogotá…).
- `divipola_*` (Colombia) quedan como la fuente de la que se copió y de la que depende el libro genealógico (`libro_genealogico`); no se tocan.

## Cómo se calculan

- El formulario no cambia: la persona elige de las listas de `lib/colombia.ts` y `lib/municipios.ts`.
- El **servidor** llama a `geo_codigos(país, nivel 1, nivel 2)` (`lib/ubicacion.ts#codigosUbicacion`) y guarda país y códigos junto al nombre (`crearFinca`,
  `editarFinca`, y al editar una feria o crearla desde un premio). Nunca se confía en un código que llegue del navegador.
- Compara sin tildes, sin mayúsculas y sin signos, y usa `geo_alias`. Si no hay coincidencia devuelve `null` y **nunca adivina**; guardar la finca o la
  feria no se bloquea por eso. Un país sin datos o inexistente devuelve `null`.
- `tests/ubicacion.test.mjs` comprueba que **cada municipio que ofrece la app** resuelve a **un solo** código del catálogo. Si se agrega o renombra un
  municipio en `lib/municipios.ts`, esa prueba dice si falta su equivalencia.

## Reglas

- **La feria siempre pide departamento y municipio** (dónde se concursó): el formulario no ofrece «Sin especificar» (`CamposUbicacion requerido`) y la acción
  del servidor lo vuelve a exigir. En la finca siguen siendo opcionales.
- Las columnas de texto no se quitan: el nombre sigue siendo el dato principal.
- La exportación de la finca rotula los códigos como «Código del departamento (DANE)» y «Código del municipio (DANE)».

## Sumar un país nuevo (por ejemplo Ecuador)

La fila de Ecuador ya existe en `geo_paises` con `activo = false`. Para ofrecerlo:
1. Cargar sus divisiones oficiales en `geo_divisiones` (Ecuador: el clasificador DPA del INEC; provincia de 2 dígitos, cantón de 4, parroquia de 6) en una migración.
2. Agregar sus equivalencias de nombres en `geo_alias` y su lista de provincias y cantones para el formulario (hoy las listas viven en `lib/colombia.ts` y
   `lib/municipios.ts`; habría que dejarlas por país o leerlas de `geo_divisiones`).
3. Que el formulario muestre las etiquetas del país (`geo_paises.nivel1_nombre`/`nivel2_nombre`) y pida el país al crear la finca (hoy no se pregunta: solo
   hay uno activo y se usa `PAIS_DEFECTO`).
4. Marcarlo `activo = true`.
Fuera de la geografía hay más por revisar antes de abrir un país: IVA, textos legales, autoridad sanitaria, cobro de los planes y la zona horaria
(`hoyBogota` está en unos 150 archivos; Ecuador continental tiene la misma hora que Colombia, Galápagos no).
