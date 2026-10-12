-- Reproducción: partos previos al uso de la app y el estado reproductivo de cada hembra (vacía, servida, gestante), con su fecha
-- prevista de parto y su número de partos. El estado y los totales se calculan (vista), no se guardan.

-- Partos que la hembra ya había tenido antes de registrarlos aquí (nulo = no se sabe). Los que se registren desde ahora se suman.
alter table public.animales
  add column partos_previos smallint check (partos_previos >= 0 and partos_previos <= 30);

create view public.v_repro_hembras with (security_invoker = true) as
with fin_gestacion as (
  -- Cualquier parto o aborto cierra la gestación anterior.
  select madre_id, max(fecha) as fecha from public.partos group by madre_id
),
partos_reg as (
  select madre_id, count(*)::int as n, max(fecha) as ultimo from public.partos where tipo <> 'aborto' group by madre_id
),
servicio as (
  select distinct on (hembra_id) hembra_id, id, fecha, tipo
  from public.servicios
  order by hembra_id, fecha desc, created_at desc
),
diag as (
  select distinct on (hembra_id) hembra_id, fecha, resultado
  from public.diagnosticos_gestacion
  order by hembra_id, fecha desc, created_at desc
)
select a.id as animal_id,
       a.finca_id,
       a.especie,
       pr.ultimo as ultimo_parto,
       coalesce(pr.n, 0) as partos_registrados,
       a.partos_previos,
       case when a.partos_previos is null and coalesce(pr.n, 0) = 0 then null else coalesce(a.partos_previos, 0) + coalesce(pr.n, 0) end as partos_totales,
       v.id as servicio_id,
       v.fecha as ultimo_servicio,
       v.fecha + p.gestacion_dias::int as fecha_prevista_parto,
       d.resultado as diagnostico,
       d.fecha as fecha_diagnostico,
       case
         when v.id is null or v.fecha <= coalesce(fg.fecha, date '0001-01-01')
           then case when fg.fecha is null and pr.n is null and a.partos_previos is null then 'sin_datos' else 'vacia' end
         when d.fecha >= v.fecha and d.resultado = 'gestante' then 'gestante'
         when d.fecha >= v.fecha and d.resultado = 'vacia' then 'vacia'
         else 'servida'
       end as estado,
       exists (select 1 from public.lactancias l where l.animal_id = a.id and l.fecha_secado is null) as en_lactancia
from public.animales a
join public.parametros_especie p on p.especie = a.especie
left join partos_reg pr on pr.madre_id = a.id
left join fin_gestacion fg on fg.madre_id = a.id
left join servicio v on v.hembra_id = a.id
left join diag d on d.hembra_id = a.id
where a.sexo = 'hembra' and a.estado = 'activo' and a.deleted_at is null;

revoke all on public.v_repro_hembras from anon;
grant select on public.v_repro_hembras to authenticated;
