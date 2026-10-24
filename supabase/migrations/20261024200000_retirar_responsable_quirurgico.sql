-- Retira `partos.responsable_quirurgico`: quién asistió un parto o una cesárea es `partos.asistido_por` desde la migración de asistencia
-- (que copió ahí los datos). La app ya no la leía ni la escribía; no tenía datos, ni vistas, ni restricciones, ni índices, ni disparadores que la usaran.
-- `registrar_parto` solo nombra `responsable_quirurgico` como clave opcional del JSON que recibe (no como columna), así que no cambia.
-- La ejecutó el propietario en el Editor SQL (una sentencia con `drop` la retiene la herramienta de migraciones) y se registró esta versión.

alter table public.partos drop column responsable_quirurgico;
