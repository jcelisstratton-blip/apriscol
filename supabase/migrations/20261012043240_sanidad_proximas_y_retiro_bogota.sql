-- Sanidad: próxima dosis, pendientes derivados y retiros calculados con el día calendario de Colombia
-- (antes usaban el del servidor).

alter table public.eventos_sanitarios
  add column proxima_fecha date,
  add constraint eventos_sanitarios_proxima_ck check (proxima_fecha is null or proxima_fecha > fecha);

-- Lo pendiente no se guarda: es la «próxima dosis» de cada evento mientras el animal no haya recibido después
-- el mismo tipo de tratamiento con el mismo producto. Solo animales activos. Modo invoker: respeta RLS.
create view public.v_sanidad_pendiente with (security_invoker = true) as
select ea.finca_id,
       ea.animal_id,
       e.id as evento_id,
       e.tipo,
       e.producto_id,
       e.producto_nombre,
       e.proxima_fecha
from public.evento_sanitario_animales ea
join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
join public.animales a on a.id = ea.animal_id and a.finca_id = ea.finca_id and a.estado = 'activo' and a.deleted_at is null
where e.proxima_fecha is not null
  and not exists (
    select 1
    from public.evento_sanitario_animales ea2
    join public.eventos_sanitarios e2 on e2.id = ea2.evento_id and e2.finca_id = ea2.finca_id
    where ea2.animal_id = ea.animal_id
      and ea2.finca_id = ea.finca_id
      and e2.tipo = e.tipo
      and e2.fecha > e.fecha
      and coalesce(e2.producto_id::text, lower(btrim(coalesce(e2.producto_nombre, ''))))
        = coalesce(e.producto_id::text, lower(btrim(coalesce(e.producto_nombre, ''))))
  );

revoke all on public.v_sanidad_pendiente from anon;
grant select on public.v_sanidad_pendiente to authenticated;

create or replace function public.animales_en_retiro(p_finca uuid)
returns table (animal_id uuid, retiro_leche_hasta date, retiro_carne_hasta date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if not private.es_miembro(p_finca) then
    raise exception 'No perteneces a esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select ea.animal_id,
         max(e.fin_retiro_leche) filter (where e.retiro_leche_dias > 0 and v_hoy <= e.fin_retiro_leche),
         max(e.fin_retiro_carne) filter (where e.retiro_carne_dias > 0 and v_hoy <= e.fin_retiro_carne)
  from public.evento_sanitario_animales ea
  join public.eventos_sanitarios e on e.id = ea.evento_id and e.finca_id = ea.finca_id
  where ea.finca_id = p_finca
    and e.fecha <= v_hoy
    and ((e.retiro_leche_dias > 0 and v_hoy <= e.fin_retiro_leche)
      or (e.retiro_carne_dias > 0 and v_hoy <= e.fin_retiro_carne))
  group by ea.animal_id;
end;
$$;
