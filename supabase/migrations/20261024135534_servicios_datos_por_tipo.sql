-- Servicios: datos propios de cada tipo (inseminación y transferencia de embrión). Solo agrega columnas: es retrocompatible.
--  · Inseminación: `tecnica_inseminacion` (cervical, transcervical, laparoscópica). La pajilla va en `semen_lote`, el donante en `macho_id`/`macho_externo`
--    y quien la hizo en `responsable`.
--  · Transferencia de embrión: `embrion_codigo`, `tipo_transferencia` (fresco, vitrificado, congelado), padre genético en `macho_id`/`macho_externo` y
--    madre genética (donante del óvulo) en `madre_genetica_id` (hembra del hato) o `madre_genetica_externa` (texto). La hembra del servicio es la receptora.

alter table public.servicios
  add column tecnica_inseminacion text check (tecnica_inseminacion in ('cervical', 'transcervical', 'laparoscopica')),
  add column tipo_transferencia text check (tipo_transferencia in ('fresco', 'vitrificado', 'congelado')),
  add column embrion_codigo text,
  add column madre_genetica_id uuid,
  add column madre_genetica_externa text,
  add constraint servicios_madre_genetica_fk foreign key (madre_genetica_id, finca_id)
    references public.animales (id, finca_id) on delete set null (madre_genetica_id),
  add constraint servicios_madre_genetica_una_sola check (madre_genetica_id is null or madre_genetica_externa is null);
