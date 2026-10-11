-- Endogamia a nivel de finca: lista de animales con su F y ancestros en común de una cruza simulada.
-- Reutiliza el mismo cálculo de coef_endogamia (libro si el animal viene de él, hato si no).

create function private.f_animal(p_animal uuid) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  v_padre uuid; v_madre uuid; v_libro uuid; lp uuid; lm uuid;
begin
  select padre_id, madre_id, libro_id into v_padre, v_madre, v_libro from public.animales where id = p_animal;
  if v_libro is not null then
    select padre_id, madre_id into lp, lm from public.libro_genealogico where id = v_libro;
    if lp is not null and lm is not null then
      return round((0.5 * coalesce(private.relacion_libro(lp, lm), 0))::numeric, 6);
    end if;
  end if;
  if v_padre is null or v_madre is null then return null; end if;  -- sin ambos padres no hay nada que medir
  return round((0.5 * coalesce(private.relacion_aditiva(v_padre, v_madre), 0))::numeric, 6);
end;
$$;
revoke all on function private.f_animal(uuid) from public, anon, authenticated;

-- Animales de la finca con pedigrí evaluable (ambos padres conocidos), de mayor a menor F.
create function public.animales_endogamia(p_finca uuid, p_min numeric default null)
returns table (animal_id uuid, numero_arete text, nombre text, sexo text, especie text, estado text, f numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.puede_ver(p_finca, 'hato') then
    raise exception 'No tienes acceso a esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.numero_arete::text, a.nombre::text, a.sexo::text, a.especie::text, a.estado::text, x.f
  from public.animales a
  cross join lateral (select private.f_animal(a.id) as f) x
  where a.finca_id = p_finca and a.deleted_at is null and x.f is not null
    and (p_min is null or x.f >= p_min)
  order by x.f desc, a.numero_arete
  limit 3000;
end;
$$;

-- Ancestros que comparten un macho y una hembra (los más cercanos primero): explica por qué una cruza sale alta.
create function public.ancestros_comunes(p_macho uuid, p_hembra uuid, p_max_gen int default 6)
returns table (nombre text, gen_macho int, gen_hembra int)
language plpgsql stable security definer set search_path = ''
as $$
declare
  m record; h record;
begin
  select id, libro_id into m from public.animales where id = p_macho and deleted_at is null and private.puede_ver(finca_id, 'hato');
  select id, libro_id into h from public.animales where id = p_hembra and deleted_at is null and private.puede_ver(finca_id, 'hato');
  if m.id is null or h.id is null then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  p_max_gen := least(greatest(coalesce(p_max_gen, 6), 1), 8);

  if m.libro_id is not null and h.libro_id is not null then
    return query
    with recursive am (id, g) as (
      select m.libro_id, 0
      union all
      select p.x, am.g + 1
      from am join public.libro_genealogico l on l.id = am.id
      cross join lateral (values (l.padre_id), (l.madre_id)) p (x)
      where p.x is not null and am.g < p_max_gen
    ), ah (id, g) as (
      select h.libro_id, 0
      union all
      select p.x, ah.g + 1
      from ah join public.libro_genealogico l on l.id = ah.id
      cross join lateral (values (l.padre_id), (l.madre_id)) p (x)
      where p.x is not null and ah.g < p_max_gen
    ), c as (
      select am.id, min(am.g) as gm, min(ah.g) as gh from am join ah on ah.id = am.id group by am.id
    )
    select coalesce(nullif(l.nombre, ''), l.chip)::text, c.gm, c.gh
    from c join public.libro_genealogico l on l.id = c.id
    order by c.gm + c.gh, 1
    limit 8;
  else
    return query
    with recursive am (id, g) as (
      select m.id, 0
      union all
      select p.x, am.g + 1
      from am join public.animales a on a.id = am.id
      cross join lateral (values (a.padre_id), (a.madre_id)) p (x)
      where p.x is not null and am.g < p_max_gen
    ), ah (id, g) as (
      select h.id, 0
      union all
      select p.x, ah.g + 1
      from ah join public.animales a on a.id = ah.id
      cross join lateral (values (a.padre_id), (a.madre_id)) p (x)
      where p.x is not null and ah.g < p_max_gen
    ), c as (
      select am.id, min(am.g) as gm, min(ah.g) as gh from am join ah on ah.id = am.id group by am.id
    )
    select coalesce(a.nombre, a.numero_arete)::text, c.gm, c.gh
    from c join public.animales a on a.id = c.id
    order by c.gm + c.gh, 1
    limit 8;
  end if;
end;
$$;

revoke execute on function public.animales_endogamia(uuid, numeric), public.ancestros_comunes(uuid, uuid, int) from public, anon;
grant execute on function public.animales_endogamia(uuid, numeric), public.ancestros_comunes(uuid, uuid, int) to authenticated;
