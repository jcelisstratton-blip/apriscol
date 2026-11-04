-- `deshacer_grupo` deshace los tramos de un archivo del último al primero; antes ordenaba por hora, y dos tramos de la misma transacción (o del mismo instante)
-- quedaban empatados. `orden` es un consecutivo que no se repite.
alter table public.importaciones add column orden bigint generated always as identity;

create or replace function public.deshacer_grupo(p_grupo uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  r record;
  v jsonb;
  v_eliminados integer := 0;
  v_revertidos integer := 0;
  v_conservados integer := 0;
begin
  if not exists (select 1 from public.importaciones where grupo = p_grupo) then
    raise exception 'Esa carga no existe.' using errcode = 'no_data_found';
  end if;
  -- Del último tramo al primero: una cría de un tramo puede tener a su padre en uno anterior. `orden` es consecutivo aunque dos tramos compartan la hora.
  for r in select id from public.importaciones where grupo = p_grupo and estado = 'aplicada' order by orden desc loop
    v := public.deshacer_importacion(r.id);
    v_eliminados := v_eliminados + (v ->> 'eliminados')::integer;
    v_revertidos := v_revertidos + (v ->> 'revertidos')::integer;
    v_conservados := v_conservados + (v ->> 'conservados')::integer;
  end loop;
  return jsonb_build_object('eliminados', v_eliminados, 'revertidos', v_revertidos, 'conservados', v_conservados);
end;
$$;

revoke execute on function public.deshacer_grupo(uuid) from public, anon;
grant execute on function public.deshacer_grupo(uuid) to authenticated;
