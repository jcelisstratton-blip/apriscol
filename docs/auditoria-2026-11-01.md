# Auditoría del estado de la app (1 de noviembre de 2026)

Revisión de seguridad y rendimiento de la base y del despliegue, con lo que se hizo y lo que queda pendiente.

## Funciones `SECURITY DEFINER` ejecutables por usuarios con sesión (73)

El asesor de Supabase las marca como aviso. Se revisó una por una (existencia de `search_path` fijo y de una validación de quién llama dentro del cuerpo):

- **Todas fijan `search_path`.** Ninguna lo deja abierto.
- **59 validan quién llama directamente** (`private.puede_*`, `private.es_miembro`, `es_admin_plataforma`, `auth.uid()`…).
- **12 delegan en un validador propio**: `costos_*` y `ventas_*` llaman a `private.costos_permiso(p_finca)` (exige ver Contabilidad); `equipo_notificaciones` a `private.gestiona_avisos(p_finca)` (propietario, administrador o superadmin).
- **`admin_activar_plan_finca`** no valida por sí sola: entrega todo a `admin_confirmar_pago`, que sí valida que quien llama es administrador de la plataforma.
- **`invitacion_publica(p_token)`** es la única ejecutable sin iniciar sesión, y es intencional: la página de invitación por enlace. La protege el token (uuid aleatorio), solo devuelve invitaciones no aceptadas y vigentes (correo, rol y nombre de la finca).

Conclusión: ninguna función queda sin control de acceso. Una función nueva `SECURITY DEFINER` debe validar quién llama y revocar `anon`, como ya dice `CLAUDE.md`.

## Rendimiento

- **Índices de llaves foráneas** (`20261101143658_indices_llaves_foraneas.sql`): 52 índices sobre las llaves compuestas `(x_id, finca_id)`. Los avisos pasaron de 102 a 50; los 50 que quedan son columnas de auditoría (`created_by`, `updated_by`…) que nunca se consultan, y se dejan sin índice a propósito.
- **Índices sin uso**: los 21 antiguos y los 52 nuevos salen «sin usar» porque la base casi no tiene tráfico; no se borra ninguno hasta tener uso real.
- **Políticas permisivas múltiples**: `novedades` (borrar) y `productos_veterinarios` (leer) tienen dos políticas cada una. Unirlas cambia la lógica de seguridad por una ganancia mínima en tablas pequeñas; queda como mejora para cuando crezcan.

## Despliegue y operación

- **Vercel está en plan Hobby**: conserva solo 1 hora de registros de ejecución. Así no se puede observar la política de contenido (CSP) durante días, y por eso sigue en solo reportar. Antes de abrir la app a clientes de pago conviene pasar a un plan con más retención (y revisar los términos de Vercel sobre uso comercial del plan Hobby).
- **Errores de ejecución de los últimos 7 días**: seis grupos, todos del 19 al 30 de octubre y ya corregidos; ninguno posterior.
- **Copias de seguridad de Supabase**: no verificadas (depende del plan del proyecto). Pendiente confirmar y probar una restauración.

## Datos de prueba

El esquema `respaldo_pruebas_20261031` guarda las filas de prueba borradas del piloto el 31 de octubre (13 tablas, sin llaves primarias). Es solo de respaldo: se borra cuando ya no haga falta.
