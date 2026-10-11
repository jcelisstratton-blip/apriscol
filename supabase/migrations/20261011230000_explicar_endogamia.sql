-- Explicar la endogamia: qué ancestros la causan y por qué rutas llegan al padre y a la madre.
-- Coeficiente de Wright por rutas: F = Σ (1/2)^(n1+n2+1) · (1 + F_ancestro), sobre cada par de rutas
-- (una por el padre, otra por la madre) que se juntan en un ancestro sin repetir animales.

create function private.explicar_pares(p_sire uuid, p_dam uuid, p_libro boolean, p_max int default 8)
returns table (ancestro_chip text, ancestro_nombre text, ancestro_sexo text, aporte numeric, ruta_padre jsonb, ruta_madre jsonb)
language plpgsql stable set search_path = ''
as $$
begin
  if p_sire is null or p_dam is null then return; end if;
  if p_libro then
    return query
    with recursive ps (id, path) as (
      select p_sire, array[p_sire]
      union all
      select p.x, ps.path || p.x
      from ps join public.libro_genealogico l on l.id = ps.id
      cross join lateral (values (l.padre_id), (l.madre_id)) p (x)
      where p.x is not null and cardinality(ps.path) <= p_max
    ), pd (id, path) as (
      select p_dam, array[p_dam]
      union all
      select p.x, pd.path || p.x
      from pd join public.libro_genealogico l on l.id = pd.id
      cross join lateral (values (l.padre_id), (l.madre_id)) p (x)
      where p.x is not null and cardinality(pd.path) <= p_max
    ), pares as (
      select a.id as anc, a.path as pa, b.path as pb, cardinality(a.path) - 1 as n1, cardinality(b.path) - 1 as n2
      from ps a join pd b on b.id = a.id
      where not (a.path[1:cardinality(a.path) - 1] && b.path[1:cardinality(b.path) - 1])
    )
    select coalesce(l.chip, '')::text, l.nombre::text, l.sexo::text,
           round(power(0.5::numeric, p.n1 + p.n2 + 1) * (1 + coalesce(fa.f, 0)), 6),
           (select jsonb_agg(jsonb_build_object('c', x.chip, 'n', x.nombre, 's', x.sexo) order by o.ord)
              from unnest(p.pa) with ordinality o (id, ord) join public.libro_genealogico x on x.id = o.id),
           (select jsonb_agg(jsonb_build_object('c', x.chip, 'n', x.nombre, 's', x.sexo) order by o.ord)
              from unnest(p.pb) with ordinality o (id, ord) join public.libro_genealogico x on x.id = o.id)
    from pares p
    join public.libro_genealogico l on l.id = p.anc
    left join lateral (
      select (0.5 * private.relacion_libro(l.padre_id, l.madre_id))::numeric as f
      where l.padre_id is not null and l.madre_id is not null
    ) fa on true
    order by 4 desc, 2
    limit 40;
  else
    return query
    with recursive ps (id, path) as (
      select p_sire, array[p_sire]
      union all
      select p.x, ps.path || p.x
      from ps join public.animales a on a.id = ps.id
      cross join lateral (values (a.padre_id), (a.madre_id)) p (x)
      where p.x is not null and cardinality(ps.path) <= p_max
    ), pd (id, path) as (
      select p_dam, array[p_dam]
      union all
      select p.x, pd.path || p.x
      from pd join public.animales a on a.id = pd.id
      cross join lateral (values (a.padre_id), (a.madre_id)) p (x)
      where p.x is not null and cardinality(pd.path) <= p_max
    ), pares as (
      select a.id as anc, a.path as pa, b.path as pb, cardinality(a.path) - 1 as n1, cardinality(b.path) - 1 as n2
      from ps a join pd b on b.id = a.id
      where not (a.path[1:cardinality(a.path) - 1] && b.path[1:cardinality(b.path) - 1])
    )
    select coalesce(an.chip, an.numero_arete)::text, an.nombre::text, an.sexo::text,
           round(power(0.5::numeric, p.n1 + p.n2 + 1) * (1 + coalesce(fa.f, 0)), 6),
           (select jsonb_agg(jsonb_build_object('c', coalesce(x.chip, x.numero_arete), 'n', x.nombre, 's', x.sexo) order by o.ord)
              from unnest(p.pa) with ordinality o (id, ord) join public.animales x on x.id = o.id),
           (select jsonb_agg(jsonb_build_object('c', coalesce(x.chip, x.numero_arete), 'n', x.nombre, 's', x.sexo) order by o.ord)
              from unnest(p.pb) with ordinality o (id, ord) join public.animales x on x.id = o.id)
    from pares p
    join public.animales an on an.id = p.anc
    left join lateral (
      select (0.5 * private.relacion_aditiva(an.padre_id, an.madre_id))::numeric as f
      where an.padre_id is not null and an.madre_id is not null
    ) fa on true
    order by 4 desc, 2
    limit 40;
  end if;
end;
$$;
revoke all on function private.explicar_pares(uuid, uuid, boolean, int) from public, anon, authenticated;

-- Origen de la endogamia de un animal (por sus padres).
create function public.explicar_endogamia(p_animal uuid)
returns table (ancestro_chip text, ancestro_nombre text, ancestro_sexo text, aporte numeric, ruta_padre jsonb, ruta_madre jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_padre uuid; v_madre uuid; v_libro uuid; lp uuid; lm uuid;
begin
  select padre_id, madre_id, libro_id into v_padre, v_madre, v_libro
  from public.animales where id = p_animal and deleted_at is null and private.puede_ver(finca_id, 'hato');
  if not found then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  if v_libro is not null then
    select padre_id, madre_id into lp, lm from public.libro_genealogico where id = v_libro;
    if lp is not null and lm is not null then
      return query select * from private.explicar_pares(lp, lm, true);
      return;
    end if;
  end if;
  return query select * from private.explicar_pares(v_padre, v_madre, false);
end;
$$;

-- Origen de la endogamia que tendría la cría de una cruza.
create function public.explicar_cruza(p_macho uuid, p_hembra uuid)
returns table (ancestro_chip text, ancestro_nombre text, ancestro_sexo text, aporte numeric, ruta_padre jsonb, ruta_madre jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare
  m record; h record;
begin
  select id, finca_id, sexo, especie, libro_id into m
  from public.animales where id = p_macho and deleted_at is null and private.puede_ver(finca_id, 'hato');
  select id, finca_id, sexo, especie, libro_id into h
  from public.animales where id = p_hembra and deleted_at is null and private.puede_ver(finca_id, 'hato');
  if m.id is null or h.id is null then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  if m.sexo <> 'macho' or h.sexo <> 'hembra' then
    raise exception 'La simulación requiere un macho y una hembra.' using errcode = 'check_violation';
  end if;
  if m.finca_id <> h.finca_id or m.especie <> h.especie then
    raise exception 'Ambos animales deben ser de la misma finca y especie.' using errcode = 'check_violation';
  end if;
  if m.libro_id is not null and h.libro_id is not null then
    return query select * from private.explicar_pares(m.libro_id, h.libro_id, true);
  else
    return query select * from private.explicar_pares(m.id, h.id, false);
  end if;
end;
$$;

revoke execute on function public.explicar_endogamia(uuid), public.explicar_cruza(uuid, uuid) from public, anon;
grant execute on function public.explicar_endogamia(uuid), public.explicar_cruza(uuid, uuid) to authenticated;
