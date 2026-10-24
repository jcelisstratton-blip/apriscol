-- Reportes · Peso y condición corporal: el último pesaje de cada animal activo, el anterior (para la ganancia diaria) y la última condición corporal anotada.
-- Solo agrega una vista (retrocompatible). Es `security_invoker`: lo que la persona ve lo decide la RLS de `pesajes`. Lo derivado no se guarda.

create view public.v_peso_animal with (security_invoker = true) as
with ordenados as (
  select p.finca_id, p.animal_id, p.fecha, p.peso_kg,
         row_number() over (partition by p.animal_id order by p.fecha desc, p.created_at desc) as n,
         count(*) over (partition by p.animal_id) as pesajes
  from public.pesajes p
  join public.animales a on a.id = p.animal_id and a.finca_id = p.finca_id and a.estado = 'activo' and a.deleted_at is null
)
select u.finca_id,
       u.animal_id,
       u.fecha as ultima_fecha,
       u.peso_kg as ultimo_peso_kg,
       a.fecha as anterior_fecha,
       a.peso_kg as anterior_peso_kg,
       c.condicion_corporal,
       c.fecha as fecha_condicion,
       u.pesajes::integer as pesajes
from ordenados u
left join ordenados a on a.animal_id = u.animal_id and a.n = 2
left join lateral (
  select x.condicion_corporal, x.fecha
  from public.pesajes x
  where x.animal_id = u.animal_id and x.condicion_corporal is not null
  order by x.fecha desc, x.created_at desc
  limit 1
) c on true
where u.n = 1;
