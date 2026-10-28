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
  (Reproducción), plazos de los semáforos de partos y de hembras vacías sin servicio (`parto_preparar_dias`, `parto_vigilar_dias`, `vacia_aviso_dias`, `vacia_urgente_dias`; migración `20261028010406`, ver `semaforos.md`), ganancia mínima y peso de faena (Carne), límite de células somáticas y rangos de grasa y proteína (Leche), podología y pediluvio (Sanidad).

## Logo de la finca

**Más → Datos de la finca** (`/mas/finca`, solo propietario y administradores) permite subir un **logo opcional** (`fincas.logo_path`). Es identidad, no un ajuste: no cambia colores ni el tema de la app (decisión del dueño del producto: sin colores de marca por ahora).
- **Archivo:** JPG, PNG o WebP; **nunca SVG** (puede llevar código). El navegador lo reduce a 512 px y un PNG conserva su transparencia (`comprimirImagen` con `conservarTransparencia`); el bucket `logos-fincas` es privado y limita a 1 MB.
- **Ruta y permisos:** `<finca_id>/<uuid>.<ext>`, armada siempre por el servidor (`prepararSubidaLogo`) y subida con URL firmada; el CHECK `fincas_logo_path_ck` impide apuntar a la carpeta de otra finca. Ver: cualquier miembro; subir y borrar: quien gestiona (`private.puede_gestionar`). Sin política de listado ni de actualización.
- **Cómo se ve:** `LogoFinca` (circular, completo; sin logo, la inicial) en el chip de `FincaSelector`, en su hoja «Tus fincas» y, por ahí, en el menú lateral y las pantallas que lo usan. Se pide a **`/api/logo?f=<finca>&v=<archivo>`**, una ruta con sesión que toma la ruta real de la base (nunca de la dirección) y la entrega con caché de un año: el nombre del archivo es la versión, así que un logo nuevo es otra dirección.
- **Al cambiar o quitar:** `editarFinca` guarda la ruta nueva y borra el archivo anterior. Si la persona sube un logo y cancela sin guardar, queda un archivo suelto sin efecto.
- **No está en los Excel todavía** (encabezado de reportes y exportación): se agrega cuando se pida.

