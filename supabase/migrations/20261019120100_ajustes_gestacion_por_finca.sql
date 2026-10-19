-- La duración de la gestación pasa a ser un ajuste de cada finca (`finca_ajustes_especie.gestacion_dias`, ver 20261019120000): el propietario puede
-- afinarla dentro del rango biológico de la especie. Sin ajuste (no debería pasar: cada finca tiene su fila) se usa el valor de `parametros_especie`.
-- Solo cambia de dónde sale la cifra: las mismas columnas y la misma lógica de antes.

-- Servicios con fecha prevista de parto según la gestación de la finca.
create or replace view public.v_servicios with (security_invoker = true) as
select s.*,
       coalesce(fae.gestacion_dias, p.gestacion_dias) as gestacion_dias,
       s.fecha + coalesce(fae.gestacion_dias, p.gestacion_dias)::int as fecha_prevista_parto
from public.servicios s
join public.animales a on a.id = s.hembra_id
join public.parametros_especie p on p.especie = a.especie
left join public.finca_ajustes_especie fae on fae.finca_id = s.finca_id and fae.especie = a.especie;

-- Estado reproductivo de cada hembra (misma definición de 20261012140448; solo cambia la gestación).
create or replace view public.v_repro_hembras with (security_invoker = true) as
with fin_gestacion as (
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
       case
         when v.id is not null and v.fecha > coalesce(fg.fecha, date '0001-01-01') and not coalesce(d.fecha >= v.fecha and d.resultado = 'vacia', false)
           then v.fecha + coalesce(fae.gestacion_dias, p.gestacion_dias)::int
       end as fecha_prevista_parto,
       d.resultado as diagnostico,
       d.fecha as fecha_diagnostico,
       case
         when v.id is null or v.fecha <= coalesce(fg.fecha, date '0001-01-01')
           then case when fg.fecha is null and pr.n is null and a.partos_previos is null then 'sin_datos' else 'vacia' end
         when d.fecha >= v.fecha and d.resultado = 'gestante' then 'gestante'
         when d.fecha >= v.fecha and d.resultado = 'vacia' then 'vacia'
         else 'servida'
       end as estado,
       exists (select 1 from public.lactancias l where l.animal_id = a.id and l.fecha_secado is null) as en_lactancia,
       emp.id as empadronamiento_id,
       emp.nombre as empadronamiento_nombre,
       emp.macho_id as empadronamiento_macho_id
from public.animales a
join public.parametros_especie p on p.especie = a.especie
left join public.finca_ajustes_especie fae on fae.finca_id = a.finca_id and fae.especie = a.especie
left join partos_reg pr on pr.madre_id = a.id
left join fin_gestacion fg on fg.madre_id = a.id
left join servicio v on v.hembra_id = a.id
left join diag d on d.hembra_id = a.id
left join lateral (
  select e.id, e.nombre, h.macho_id
  from public.empadronamiento_hembras h join public.empadronamientos e on e.id = h.empadronamiento_id
  where h.hembra_id = a.id and e.cerrado_en is null
  limit 1
) emp on true
where a.sexo = 'hembra' and a.estado = 'activo' and a.deleted_at is null;

-- Candidatos a ceba: la ventana «gestación + 60 días» usa la gestación de la finca (misma definición de 20261012092652).
create or replace function public.candidatos_ceba(p_finca uuid, p_animal uuid default null)
returns table (
  animal_id uuid, sexo text, especie text, edad_meses integer, partos_totales integer, uso_macho text,
  nivel text, motivos text[], advertencias text[], estado_repro text, en_lactancia boolean, retiro_carne_hasta date,
  peso_ultimo numeric, fecha_ultimo_peso date, gdp_reciente_g numeric
)
language sql stable security definer
set search_path = ''
as $$
  with hoy as (select (now() at time zone 'America/Bogota')::date as d),
  reglas as (select * from public.reglas_ceba_efectivas(p_finca)),
  pesos as (select * from public.ceba_animales(p_finca)),
  retiros as (select r.animal_id, r.retiro_carne_hasta from public.animales_en_retiro(p_finca) r where r.retiro_carne_hasta is not null and r.retiro_carne_hasta >= (select d from hoy)),
  base as (
    select a.id, a.sexo::text as sexo, a.especie::text as especie, a.uso_macho,
           (extract(year from age(h.d, a.fecha_nacimiento)) * 12 + extract(month from age(h.d, a.fecha_nacimiento)))::int as edad_meses,
           v.partos_totales::int as partos_totales, v.estado as estado_repro, coalesce(v.en_lactancia, false) as en_lactancia, v.ultimo_servicio,
           coalesce(fae.gestacion_dias, pe.gestacion_dias, 150) as gestacion_dias, h.d as hoy,
           g.hembra_partos_proxima, g.hembra_partos_toca, g.hembra_meses_proxima, g.hembra_meses_toca,
           g.macho_meses_proxima, g.macho_meses_toca, g.reproductor_meses_viejo, g.dias_entre_pesajes, g.hembra_dias_entre_pesajes
    from public.animales a
    cross join hoy h
    join reglas g on g.especie::text = a.especie::text
    left join public.lotes_ceba l on l.id = a.lote_ceba_id and l.finca_id = a.finca_id
    left join public.v_repro_hembras v on v.animal_id = a.id
    left join public.parametros_especie pe on pe.especie::text = a.especie::text
    left join public.finca_ajustes_especie fae on fae.finca_id = a.finca_id and fae.especie::text = a.especie::text
    where a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null
      and (p_animal is null or a.id = p_animal)
      and (a.ceba_pospuesto_hasta is null or a.ceba_pospuesto_hasta <= h.d)
      and (l.id is null or l.cerrado_en is not null)
      and (select private.puede_ver(p_finca, 'carne'::public.modulo_app))
  ),
  evaluado as (
    select b.*,
      (b.estado_repro in ('gestante', 'servida') and b.ultimo_servicio is not null and b.ultimo_servicio >= b.hoy - (b.gestacion_dias + 60)) as preniada,
      case
        when b.sexo = 'hembra' then
          case when b.partos_totales >= b.hembra_partos_toca or b.edad_meses >= b.hembra_meses_toca then 'toca'
               when b.partos_totales >= b.hembra_partos_proxima or b.edad_meses >= b.hembra_meses_proxima then 'proxima' end
        when b.uso_macho is null then
          case when b.edad_meses >= b.macho_meses_toca then 'toca'
               when b.edad_meses >= b.macho_meses_proxima then 'proxima' end
        when b.uso_macho = 'reproductor' then
          case when b.edad_meses >= b.reproductor_meses_viejo then 'toca'
               when b.edad_meses >= b.reproductor_meses_viejo - 12 then 'proxima' end
        when b.uso_macho = 'carne' then 'toca'
      end as nivel
    from base b
  )
  select e.id, e.sexo, e.especie, e.edad_meses, e.partos_totales, e.uso_macho, e.nivel,
         array_remove(array[
           case when e.sexo = 'hembra' and e.partos_totales >= e.hembra_partos_proxima then 'partos' end,
           case when e.sexo = 'hembra' and e.edad_meses >= e.hembra_meses_proxima then 'edad' end,
           case when e.sexo = 'macho' and e.uso_macho is null then 'definir_uso' end,
           case when e.uso_macho = 'reproductor' then 'reproductor_viejo' end,
           case when e.uso_macho = 'carne' then 'carne_sin_lote' end
         ], null),
         array_remove(array[
           case when e.preniada and e.estado_repro = 'gestante' then 'gestante' end,
           case when e.preniada and e.estado_repro = 'servida' then 'probable_gestante' end,
           case when e.en_lactancia then 'lactancia' end,
           case when rt.animal_id is not null then 'retiro_carne' end,
           case when p.fecha_ultimo is null or e.hoy - p.fecha_ultimo > (case when e.sexo = 'hembra' then e.hembra_dias_entre_pesajes else e.dias_entre_pesajes end) then 'sin_pesar' end
         ], null),
         e.estado_repro, e.en_lactancia, rt.retiro_carne_hasta, p.peso_ultimo, p.fecha_ultimo, p.gdp_reciente_g
  from evaluado e
  left join pesos p on p.animal_id = e.id
  left join retiros rt on rt.animal_id = e.id
  where e.nivel is not null
    and (not e.preniada or (e.sexo = 'hembra' and (e.edad_meses >= e.hembra_meses_toca or (e.edad_meses is null and e.nivel = 'toca'))))
  order by (e.nivel = 'toca') desc, e.edad_meses desc nulls last;
$$;
