-- Programa del ordeño: en qué turnos se ordeña cada hembra. `null` = sin programar (aparece en todos los turnos, como hasta ahora);
-- una lista vacía = no se ordeña en ningún turno por ahora. Es una decisión del productor, no un dato derivado.
alter table public.animales
  add column turnos_ordeno text[],
  add constraint animales_turnos_ordeno_ck check (turnos_ordeno is null or turnos_ordeno <@ array['manana', 'tarde', 'noche']::text[]);
