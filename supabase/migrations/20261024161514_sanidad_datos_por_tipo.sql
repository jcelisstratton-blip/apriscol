-- Sanidad: datos propios de cada tipo de evento (vacunación, desparasitación, tratamiento, podología, pediluvio, cirugía, otro). Solo agrega columnas y una función
-- que envuelve a `guardar_evento_sanitario`: retrocompatible.
--  · `categoria`: qué es en concreto, según el tipo (contra qué enfermedad, qué parásito, qué problema, qué se hizo en la pezuña, qué solución, qué cirugía).
--  · `motivo` (desparasitación: FAMACHA, coprológico o rutina) y `etapa` (vacunación: primera dosis, refuerzo o anual).
--  · `dias_tratamiento`: un tratamiento de varios días. El retiro cuenta desde la ÚLTIMA dosis: los días de retiro que se guardan ya suman esos días, y esta columna
--    permite volver a mostrar los de la etiqueta al corregir.
--  · `cojera` (podología, 0 a 3), `concentracion_pct` y `minutos` (pediluvio), `anestesia` (cirugía).
-- `guardar_evento_sanitario_detalle` llama a la función de siempre (que reemplaza la lista de animales con sus permisos) y guarda estos datos en la misma transacción.

alter table public.eventos_sanitarios
  add column categoria text check (categoria is null or char_length(btrim(categoria)) between 1 and 40),
  add column motivo text check (motivo is null or motivo in ('famacha', 'coprologico', 'rutina', 'otro')),
  add column etapa text check (etapa is null or etapa in ('primera', 'refuerzo', 'anual')),
  add column dias_tratamiento smallint check (dias_tratamiento is null or dias_tratamiento between 1 and 60),
  add column cojera smallint check (cojera is null or cojera between 0 and 3),
  add column concentracion_pct numeric(4, 1) check (concentracion_pct is null or (concentracion_pct > 0 and concentracion_pct <= 100)),
  add column minutos smallint check (minutos is null or minutos between 1 and 240),
  add column anestesia text check (anestesia is null or anestesia in ('ninguna', 'local', 'sedacion', 'general'));

create or replace function public.guardar_evento_sanitario_detalle(p_finca uuid, p_evento uuid, p_datos jsonb, p_extra jsonb, p_animales uuid[])
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := public.guardar_evento_sanitario(p_finca, p_evento, p_datos, p_animales);
  update public.eventos_sanitarios set
    categoria = nullif(btrim(p_extra ->> 'categoria'), ''),
    motivo = nullif(p_extra ->> 'motivo', ''),
    etapa = nullif(p_extra ->> 'etapa', ''),
    dias_tratamiento = nullif(p_extra ->> 'dias_tratamiento', '')::smallint,
    cojera = nullif(p_extra ->> 'cojera', '')::smallint,
    concentracion_pct = nullif(p_extra ->> 'concentracion_pct', '')::numeric,
    minutos = nullif(p_extra ->> 'minutos', '')::smallint,
    anestesia = nullif(p_extra ->> 'anestesia', '')
  where id = v_id and finca_id = p_finca;
  return v_id;
end;
$$;
revoke execute on function public.guardar_evento_sanitario_detalle(uuid, uuid, jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.guardar_evento_sanitario_detalle(uuid, uuid, jsonb, jsonb, uuid[]) to authenticated;
