-- Historial de producción de leche para la pantalla «Leche»: totales por día y jornada de toda la finca (o de un animal)
-- y totales por animal en un periodo. Modo invoker: respetan RLS (solo ve ordeños quien puede ver el módulo leche).
create function public.produccion_historial(p_finca uuid, p_desde date, p_hasta date, p_animal uuid default null)
returns table (fecha date, jornada text, litros_tanque numeric, litros_descartados numeric, ordenos integer, animales integer)
language plpgsql stable set search_path = ''
as $$
begin
  if p_hasta < p_desde then
    raise exception 'La fecha final no puede ser anterior a la inicial.' using errcode = 'check_violation';
  end if;
  if p_hasta - p_desde > 800 then
    raise exception 'El rango es muy largo (máximo 800 días).' using errcode = 'check_violation';
  end if;
  return query
  select o.fecha,
         o.jornada,
         coalesce(sum(o.litros) filter (where not o.descartada), 0),
         coalesce(sum(o.litros) filter (where o.descartada), 0),
         count(*)::int,
         count(distinct o.animal_id)::int
  from public.ordenos o
  where o.finca_id = p_finca
    and o.fecha between p_desde and p_hasta
    and (p_animal is null or o.animal_id = p_animal)
  group by o.fecha, o.jornada
  order by o.fecha, o.jornada;
end;
$$;

create function public.produccion_por_animal(p_finca uuid, p_desde date, p_hasta date)
returns table (animal_id uuid, litros_tanque numeric, litros_descartados numeric, ordenos integer, dias integer)
language plpgsql stable set search_path = ''
as $$
begin
  if p_hasta < p_desde then
    raise exception 'La fecha final no puede ser anterior a la inicial.' using errcode = 'check_violation';
  end if;
  if p_hasta - p_desde > 800 then
    raise exception 'El rango es muy largo (máximo 800 días).' using errcode = 'check_violation';
  end if;
  return query
  select o.animal_id,
         coalesce(sum(o.litros) filter (where not o.descartada), 0),
         coalesce(sum(o.litros) filter (where o.descartada), 0),
         count(*)::int,
         count(distinct o.fecha)::int
  from public.ordenos o
  where o.finca_id = p_finca and o.fecha between p_desde and p_hasta
  group by o.animal_id
  order by 2 desc, 1;
end;
$$;

revoke execute on function public.produccion_historial(uuid, date, date, uuid), public.produccion_por_animal(uuid, date, date) from public, anon;
grant execute on function public.produccion_historial(uuid, date, date, uuid), public.produccion_por_animal(uuid, date, date) to authenticated;
