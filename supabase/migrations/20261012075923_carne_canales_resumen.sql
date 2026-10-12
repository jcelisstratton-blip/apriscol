-- Promedios de las canales de la finca (modo invoker: respeta RLS), para la pestaña Canales de Carne.
create function public.canales_resumen(p_finca uuid)
returns table (n integer, peso_caliente_prom numeric, rendimiento_caliente_prom numeric, rendimiento_frio_prom numeric, merma_prom numeric)
language sql stable set search_path = ''
as $$
  select count(*)::int,
         round(avg(peso_canal_caliente_kg), 1),
         round(avg(rendimiento_caliente_pct), 1),
         round(avg(rendimiento_frio_pct), 1),
         round(avg(merma_oreo_pct), 1)
  from public.v_canales
  where finca_id = p_finca;
$$;
revoke execute on function public.canales_resumen(uuid) from public, anon;
grant execute on function public.canales_resumen(uuid) to authenticated;
