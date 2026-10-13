-- costos_por_animal: la especie y el sexo del animal son tipos propios (enum); se comparan y se devuelven como texto.
-- Cuánto costó cada animal en el periodo. Directo: gastos cargados al animal y su parte de cada tratamiento. Repartido: lo cargado a su lote, a su
-- corral (por los animales que estaban ahí ese día) o a su especie, en partes iguales. Lo cargado a toda la finca no se reparte.
create or replace function public.costos_por_animal(p_finca uuid, p_desde date, p_hasta date)
returns table (animal_id uuid, numero_arete text, nombre text, especie text, sexo text, estado text, directo numeric, repartido numeric, total numeric, valor_compra numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.costos_permiso(p_finca);
  return query
    with b as (select * from private.costos_base(p_finca, p_desde, p_hasta)),
    dir as (
      select x.animal_id as aid, x.monto as m from b x where x.destino_tipo = 'animal'
      union all
      select ea.animal_id, x.monto / n.n
        from b x
        join public.evento_sanitario_animales ea on ea.evento_id = x.origen_id and ea.finca_id = p_finca
        join lateral (select count(*)::numeric as n from public.evento_sanitario_animales y where y.evento_id = x.origen_id and y.finca_id = p_finca) n on true
       where x.destino_tipo = 'evento'
    ),
    rep as (
      select a.id as aid, x.monto / n.n as m
        from b x
        join public.animales a on a.lote_ceba_id = x.lote_id and a.finca_id = p_finca and a.deleted_at is null
        join lateral (select count(*)::numeric as n from public.animales y where y.lote_ceba_id = x.lote_id and y.finca_id = p_finca and y.deleted_at is null) n on true
       where x.destino_tipo = 'lote'
      union all
      select mv.animal_id, x.monto / n.n
        from b x
        join public.movimientos_animales mv on mv.ubicacion_id = x.ubicacion_id and mv.finca_id = p_finca and mv.desde <= x.fecha and (mv.hasta is null or mv.hasta >= x.fecha)
        join lateral (select count(distinct y.animal_id)::numeric as n from public.movimientos_animales y
                       where y.ubicacion_id = x.ubicacion_id and y.finca_id = p_finca and y.desde <= x.fecha and (y.hasta is null or y.hasta >= x.fecha)) n on true
       where x.destino_tipo = 'ubicacion'
      union all
      select a.id, x.monto / n.n
        from b x
        join public.animales a on a.finca_id = p_finca and a.especie::text = x.especie and a.deleted_at is null
             and (a.fecha_nacimiento is null or a.fecha_nacimiento <= x.fecha)
             and not exists (select 1 from public.bajas z where z.animal_id = a.id and z.fecha < x.fecha)
        join lateral (select count(*)::numeric as n from public.animales y
                       where y.finca_id = p_finca and y.especie::text = x.especie and y.deleted_at is null
                         and (y.fecha_nacimiento is null or y.fecha_nacimiento <= x.fecha)
                         and not exists (select 1 from public.bajas z where z.animal_id = y.id and z.fecha < x.fecha)) n on true
       where x.destino_tipo = 'especie'
    ),
    d as (select dir.aid, sum(dir.m) as m from dir group by dir.aid),
    r as (select rep.aid, sum(rep.m) as m from rep group by rep.aid)
    select a.id, a.numero_arete, a.nombre, a.especie::text, a.sexo::text, a.estado,
           round(coalesce(d.m, 0), 2), round(coalesce(r.m, 0), 2), round(coalesce(d.m, 0) + coalesce(r.m, 0), 2), a.valor_compra
      from public.animales a
      left join d on d.aid = a.id
      left join r on r.aid = a.id
     where a.finca_id = p_finca and (d.m is not null or r.m is not null)
     order by coalesce(d.m, 0) + coalesce(r.m, 0) desc, a.numero_arete;
end;
$$;

