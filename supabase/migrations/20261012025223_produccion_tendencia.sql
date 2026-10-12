-- Vigilancia de la producción de leche: ¿el promedio diario de una hembra empieza a bajar de forma inesperada?
-- Todo es derivado (funciones de solo lectura que respetan RLS): no se guarda nada nuevo.

-- Tendencia por animal: últimos 3 días completos contra los 7 días anteriores.
--  · Un día solo cuenta si está completo: tiene tantas jornadas como las que ese animal suele ordeñarse
--    (así un ordeño sin registrar no parece una caída de producción).
--  · Hoy no cuenta (el día aún no termina). Las fechas son de Colombia.
--  · Hace falta historia: 4 días completos de base, 2 recientes y al menos 0,3 L/día de promedio base.
--  · nivel: normal · alerta (baja del 20 % o más) · critico (baja del 35 % o más) · sin_datos.
create function public.produccion_tendencia(p_finca uuid, p_hoy date default null)
returns table (
  animal_id uuid,
  litros_base numeric,
  litros_recientes numeric,
  dias_base integer,
  dias_recientes integer,
  variacion numeric,
  nivel text
)
language sql stable
set search_path = ''
as $$
  with params as (
    select coalesce(p_hoy, (now() at time zone 'America/Bogota')::date) as hoy
  ),
  dia as (
    select o.animal_id, o.fecha, count(distinct o.jornada) as jornadas, sum(o.litros) as litros
    from public.ordenos o, params p
    where o.finca_id = p_finca and o.fecha between p.hoy - 10 and p.hoy - 1
    group by o.animal_id, o.fecha
  ),
  tipico as (
    select d.animal_id, mode() within group (order by d.jornadas) as jornadas_tipicas
    from dia d
    group by d.animal_id
  ),
  completos as (
    select d.animal_id, d.litros, (d.fecha >= p.hoy - 3) as reciente
    from dia d
    join tipico t on t.animal_id = d.animal_id
    cross join params p
    where d.jornadas >= t.jornadas_tipicas
  ),
  resumen as (
    select c.animal_id,
           avg(c.litros) filter (where not c.reciente) as base,
           avg(c.litros) filter (where c.reciente) as recientes,
           (count(*) filter (where not c.reciente))::integer as n_base,
           (count(*) filter (where c.reciente))::integer as n_recientes
    from completos c
    group by c.animal_id
  ),
  evaluado as (
    select r.*, (r.n_base >= 4 and r.n_recientes >= 2 and r.base >= 0.3) as suficiente
    from resumen r
  )
  select e.animal_id,
         round(e.base, 2),
         round(e.recientes, 2),
         e.n_base,
         e.n_recientes,
         case when e.suficiente then round((e.recientes - e.base) / e.base, 3) end,
         case
           when not e.suficiente then 'sin_datos'
           when (e.recientes - e.base) / e.base <= -0.35 then 'critico'
           when (e.recientes - e.base) / e.base <= -0.20 then 'alerta'
           else 'normal'
         end
  from evaluado e
  join public.lactancias l on l.animal_id = e.animal_id and l.finca_id = p_finca and l.fecha_secado is null
  join public.animales a on a.id = e.animal_id and a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null;
$$;

-- Lo que un animal da habitualmente en cada jornada (últimos 7 días completos antes de hoy, mínimo 3 registros).
-- Sirve para avisar en el momento del ordeño si esta vez dio mucho menos de lo normal.
create function public.produccion_habitual(p_finca uuid, p_hoy date default null)
returns table (animal_id uuid, jornada text, litros_habitual numeric, dias integer)
language sql stable
set search_path = ''
as $$
  select o.animal_id, o.jornada, round(avg(o.litros), 2), count(*)::integer
  from public.ordenos o
  where o.finca_id = p_finca
    and o.fecha between coalesce(p_hoy, (now() at time zone 'America/Bogota')::date) - 7
                    and coalesce(p_hoy, (now() at time zone 'America/Bogota')::date) - 1
  group by o.animal_id, o.jornada
  having count(*) >= 3;
$$;

revoke execute on function public.produccion_tendencia(uuid, date), public.produccion_habitual(uuid, date) from public, anon;
grant execute on function public.produccion_tendencia(uuid, date), public.produccion_habitual(uuid, date) to authenticated;
