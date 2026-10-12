-- Empadronamiento: elegir las hembras al crear la temporada, y que solo entren hembras LIBRES.
--  · empadronamiento_candidatas_criterios: las hembras candidatas según los criterios (sin necesitar que la temporada exista todavía).
--  · empadronamiento_candidatas(lote) pasa a ser un envoltorio de la anterior (mismo resultado de siempre).
--  · empadronamiento_endogamia_previa: la endogamia de cada pareja con una finca en vez de una temporada.
--  · emp_hembras_validar: al agregar una hembra, la base exige que esté libre (ni gestante ni servida esperando diagnóstico).

create function public.empadronamiento_candidatas_criterios(
  p_finca uuid, p_especie public.especie, p_edad_min integer, p_peso_min numeric, p_cc_min numeric, p_excluir_lote uuid default null
)
returns table (
  animal_id uuid, numero_arete text, nombre text, edad_meses integer,
  peso_kg numeric, fecha_peso date, cc numeric, fecha_cc date,
  estado_repro text, otro_lote text,
  edad_ok text, peso_ok text, cc_ok text
)
language sql stable set search_path = ''
as $$
  with hoy as (select (now() at time zone 'America/Bogota')::date as d)
  select a.id, a.numero_arete::text, a.nombre::text,
         case when a.fecha_nacimiento is null then null
              else (extract(year from age(hoy.d, a.fecha_nacimiento)) * 12 + extract(month from age(hoy.d, a.fecha_nacimiento)))::int end,
         pw.peso_kg, pw.fecha, pc.condicion_corporal, pc.fecha,
         r.estado::text,
         ot.nombre::text,
         case when a.fecha_nacimiento is null then 'sin_dato'
              when (extract(year from age(hoy.d, a.fecha_nacimiento)) * 12 + extract(month from age(hoy.d, a.fecha_nacimiento))) >= p_edad_min then 'ok'
              else 'no' end,
         case when pw.peso_kg is null then 'sin_dato' when pw.peso_kg >= p_peso_min then 'ok' else 'no' end,
         case when pc.condicion_corporal is null then 'sin_dato' when pc.condicion_corporal >= p_cc_min then 'ok' else 'no' end
  from hoy
  join public.animales a on a.finca_id = p_finca and a.especie = p_especie and a.sexo = 'hembra' and a.estado = 'activo' and a.deleted_at is null
  left join public.v_repro_hembras r on r.animal_id = a.id
  left join lateral (select p.peso_kg, p.fecha from public.pesajes p where p.animal_id = a.id order by p.fecha desc, p.created_at desc limit 1) pw on true
  left join lateral (select p.condicion_corporal, p.fecha from public.pesajes p where p.animal_id = a.id and p.condicion_corporal is not null order by p.fecha desc, p.created_at desc limit 1) pc on true
  left join lateral (
    select e.nombre from public.empadronamiento_hembras h join public.empadronamientos e on e.id = h.empadronamiento_id
    where h.hembra_id = a.id and e.cerrado_en is null and (p_excluir_lote is null or e.id <> p_excluir_lote) limit 1
  ) ot on true
  order by a.numero_arete
$$;

create or replace function public.empadronamiento_candidatas(p_lote uuid)
returns table (
  animal_id uuid, numero_arete text, nombre text, edad_meses integer,
  peso_kg numeric, fecha_peso date, cc numeric, fecha_cc date,
  estado_repro text, otro_lote text,
  edad_ok text, peso_ok text, cc_ok text
)
language sql stable set search_path = ''
as $$
  select c.*
  from public.empadronamientos l
  cross join lateral public.empadronamiento_candidatas_criterios(l.finca_id, l.especie, l.edad_min_meses::int, l.peso_min_kg, l.cc_min, l.id) c
  where l.id = p_lote
    and not exists (select 1 from public.empadronamiento_hembras h where h.empadronamiento_id = l.id and h.hembra_id = c.animal_id)
  order by c.numero_arete
$$;

create function public.empadronamiento_endogamia_previa(p_finca uuid, p_macho uuid, p_hembras uuid[])
returns table (hembra_id uuid, f numeric, sobre_umbral boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_umbral numeric;
begin
  select f.umbral_endogamia into v_umbral from public.fincas f where f.id = p_finca;
  if v_umbral is null or not private.puede_ver(p_finca, 'reproduccion') then
    raise exception 'Finca no encontrada.' using errcode = 'P0002';
  end if;
  if cardinality(p_hembras) > 500 then
    raise exception 'Elige hasta 500 hembras a la vez.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.animales m where m.id = p_macho and m.finca_id = p_finca and m.sexo = 'macho' and m.deleted_at is null) then
    raise exception 'Semental no encontrado.' using errcode = 'P0002';
  end if;
  return query
  select a.id, x.f, private.sobre_umbral(x.f, v_umbral)
  from public.animales a
  cross join lateral (select private.f_cruza(p_macho, a.id) as f) x
  where a.id = any (p_hembras) and a.finca_id = p_finca and a.sexo = 'hembra' and a.deleted_at is null;
end;
$$;

revoke execute on function public.empadronamiento_candidatas_criterios(uuid, public.especie, integer, numeric, numeric, uuid),
  public.empadronamiento_endogamia_previa(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.empadronamiento_candidatas_criterios(uuid, public.especie, integer, numeric, numeric, uuid),
  public.empadronamiento_endogamia_previa(uuid, uuid, uuid[]) to authenticated;

-- Solo entran hembras libres: la base lo exige también (no depende de la pantalla).
create or replace function private.emp_hembras_validar() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_lote public.empadronamientos; v_a record; v_umbral numeric; v_f numeric; v_otro text; v_estado text;
begin
  select * into v_lote from public.empadronamientos where id = coalesce(new.empadronamiento_id, old.empadronamiento_id);
  if not found then return coalesce(new, old); end if;
  if v_lote.cerrado_en is not null then
    raise exception 'El empadronamiento ya está cerrado: no se pueden cambiar sus hembras.' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  select sexo, especie, estado, deleted_at into v_a from public.animales where id = new.hembra_id;
  if v_a.sexo is distinct from 'hembra' then
    raise exception 'Solo una hembra puede entrar a un empadronamiento.' using errcode = 'check_violation';
  end if;
  if v_a.especie is distinct from v_lote.especie then
    raise exception 'La hembra debe ser de la misma especie del empadronamiento.' using errcode = 'check_violation';
  end if;
  if v_a.estado <> 'activo' or v_a.deleted_at is not null then
    raise exception 'La hembra ya no está en el hato.' using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    select r.estado into v_estado from public.v_repro_hembras r where r.animal_id = new.hembra_id;
    if v_estado = 'gestante' then
      raise exception 'Una hembra gestante no puede entrar a un empadronamiento: solo entran hembras libres.' using errcode = 'check_violation';
    elsif v_estado = 'servida' then
      raise exception 'Una hembra servida que espera su diagnóstico no puede entrar a un empadronamiento: solo entran hembras libres.' using errcode = 'check_violation';
    end if;
  end if;

  select e.nombre into v_otro
  from public.empadronamiento_hembras h join public.empadronamientos e on e.id = h.empadronamiento_id
  where h.hembra_id = new.hembra_id and e.cerrado_en is null and e.id <> new.empadronamiento_id limit 1;
  if v_otro is not null then
    raise exception 'Esa hembra ya está en otro empadronamiento abierto («%»).', v_otro using errcode = 'check_violation';
  end if;

  -- Control genético: la pareja no puede llegar al umbral de endogamia de la finca, salvo excepción registrada.
  v_f := private.f_cruza(new.macho_id, new.hembra_id);
  select umbral_endogamia into v_umbral from public.fincas where id = v_lote.finca_id;
  new.endogamia := v_f;
  if private.sobre_umbral(v_f, v_umbral) and not new.excepcion then
    raise exception 'La endogamia de esta pareja (% %%) llega al umbral de tu finca (% %%).',
      replace(to_char(v_f * 100, 'FM990.00'), '.', ','), replace(to_char(v_umbral * 100, 'FM990.00'), '.', ',') using errcode = 'check_violation';
  end if;
  if not private.sobre_umbral(v_f, v_umbral) then new.excepcion := false; end if;
  return new;
end;
$$;
