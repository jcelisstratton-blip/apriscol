-- Cuántas hembras por semental. Es una guía, no un tope duro: si la temporada no fija un número, se usa el recomendado según la especie y la
-- edad de cada semental (lib/empadronamiento.ts). Fijarlo sirve a quien quiere ser más prudente (por ejemplo, 10 con un macho primerizo).
alter table public.empadronamientos
  add column hembras_por_macho smallint check (hembras_por_macho is null or hembras_por_macho between 1 and 100);

-- La vista suma la columna nueva al final (el resto queda igual).
create or replace view public.v_empadronamientos with (security_invoker = true) as
select e.id, e.finca_id, e.especie, e.nombre, e.fecha_inicio, e.fecha_fin_prevista, e.cerrado_en, e.fecha_base,
       e.edad_min_meses, e.peso_min_kg, e.cc_min, e.observaciones, e.client_request_id, e.created_by, e.created_at, e.updated_at,
       (select count(*)::int from public.empadronamiento_machos m where m.empadronamiento_id = e.id) as machos,
       (select count(*)::int from public.empadronamiento_hembras h where h.empadronamiento_id = e.id) as hembras,
       (select count(*)::int from public.empadronamiento_hembras h where h.empadronamiento_id = e.id and h.excepcion) as excepciones,
       e.hembras_por_macho
from public.empadronamientos e;

-- Una temporada cerrada tampoco cambia este dato.
create or replace function private.emp_proteger_cerrado() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.cerrado_en is not null and (
       new.nombre is distinct from old.nombre or new.especie is distinct from old.especie or new.fecha_inicio is distinct from old.fecha_inicio
       or new.fecha_fin_prevista is distinct from old.fecha_fin_prevista or new.cerrado_en is distinct from old.cerrado_en
       or new.fecha_base is distinct from old.fecha_base or new.edad_min_meses is distinct from old.edad_min_meses
       or new.peso_min_kg is distinct from old.peso_min_kg or new.cc_min is distinct from old.cc_min
       or new.hembras_por_macho is distinct from old.hembras_por_macho) then
    raise exception 'Un empadronamiento cerrado ya no se puede cambiar (solo sus observaciones).' using errcode = 'check_violation';
  end if;
  if new.especie is distinct from old.especie and exists (select 1 from public.empadronamiento_machos where empadronamiento_id = old.id) then
    raise exception 'No se puede cambiar la especie: ya tiene sementales.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
