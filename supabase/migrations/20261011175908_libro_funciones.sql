-- Libro genealógico: endogamia sobre el libro compartido, importación (solo llave de servicio) y flujo de reclamo.

-- ───────────────────────── Endogamia: núcleo común ─────────────────────────
-- Método tabular de parentesco aditivo sobre arreglos paralelos (id, padre, madre). Sirve igual para los animales
-- de una finca que para el libro; solo cambia de dónde se recogen los ancestros.
create function private.relacion_core(p_ids uuid[], p_sires uuid[], p_dams uuid[], p_a uuid, p_b uuid)
returns double precision
language plpgsql immutable set search_path = ''
as $$
declare
  n int; i int; j int; pos int; pos2 int; passes int := 0; r int; k int;
  sidx int[]; didx int[]; rk int[]; ord int[]; a float8[]; v float8; changed boolean;
begin
  n := coalesce(array_length(p_ids, 1), 0);
  if n = 0 then return null; end if;

  sidx := array_fill(0, array[n]);
  didx := array_fill(0, array[n]);
  for i in 1..n loop
    sidx[i] := coalesce(array_position(p_ids, p_sires[i]), 0);
    didx[i] := coalesce(array_position(p_ids, p_dams[i]), 0);
  end loop;

  -- Rango = 1 + máximo rango de los padres: asegura procesar padres antes que hijos.
  rk := array_fill(0, array[n]);
  loop
    changed := false;
    for i in 1..n loop
      r := 1 + greatest(
        case when sidx[i] = 0 then 0 else rk[sidx[i]] end,
        case when didx[i] = 0 then 0 else rk[didx[i]] end);
      if r <> rk[i] then rk[i] := r; changed := true; end if;
    end loop;
    exit when not changed;
    passes := passes + 1;
    if passes > n + 1 then
      raise exception 'Se detectó un ciclo en la genealogía.' using errcode = 'check_violation';
    end if;
  end loop;

  select array_agg(x order by rk[x]) into ord from generate_series(1, n) x;

  a := array_fill(0::float8, array[n * n]);
  for pos in 1..n loop
    i := ord[pos];
    for pos2 in 1..pos - 1 loop
      j := ord[pos2];
      v := 0.5 * (
        case when sidx[i] = 0 then 0 else a[(sidx[i] - 1) * n + j] end
        + case when didx[i] = 0 then 0 else a[(didx[i] - 1) * n + j] end);
      a[(i - 1) * n + j] := v;
      a[(j - 1) * n + i] := v;
    end loop;
    a[(i - 1) * n + i] := 1 + case
      when sidx[i] = 0 or didx[i] = 0 then 0
      else 0.5 * a[(sidx[i] - 1) * n + didx[i]]
    end;
  end loop;

  r := array_position(p_ids, p_a);
  k := array_position(p_ids, p_b);
  if r is null or k is null then return null; end if;
  return a[(r - 1) * n + k];
end;
$$;

-- Animales de finca (misma firma que antes; ahora delega en el núcleo).
create or replace function private.relacion_aditiva(p_a uuid, p_b uuid, p_max_gen int default 10)
returns double precision
language plpgsql stable set search_path = ''
as $$
declare
  ids uuid[]; sires uuid[]; dams uuid[];
begin
  if p_a is null or p_b is null then return 0; end if;
  select array_agg(t.id), array_agg(t.padre_id), array_agg(t.madre_id) into ids, sires, dams
  from (
    with recursive anc (id, padre_id, madre_id, g) as (
      select x.id, x.padre_id, x.madre_id, 0 from public.animales x where x.id in (p_a, p_b)
      union
      select y.id, y.padre_id, y.madre_id, anc.g + 1
      from anc join public.animales y on y.id in (anc.padre_id, anc.madre_id)
      where anc.g < p_max_gen
    )
    select distinct on (id) id, padre_id, madre_id from anc order by id, g
  ) t;
  return private.relacion_core(ids, sires, dams, p_a, p_b);
end;
$$;

-- Libro genealógico (los pedigríes cruzan entre criaderos).
create function private.relacion_libro(p_a uuid, p_b uuid, p_max_gen int default 12)
returns double precision
language plpgsql stable set search_path = ''
as $$
declare
  ids uuid[]; sires uuid[]; dams uuid[];
begin
  if p_a is null or p_b is null then return 0; end if;
  select array_agg(t.id), array_agg(t.padre_id), array_agg(t.madre_id) into ids, sires, dams
  from (
    with recursive anc (id, padre_id, madre_id, g) as (
      select x.id, x.padre_id, x.madre_id, 0 from public.libro_genealogico x where x.id in (p_a, p_b)
      union
      select y.id, y.padre_id, y.madre_id, anc.g + 1
      from anc join public.libro_genealogico y on y.id in (anc.padre_id, anc.madre_id)
      where anc.g < p_max_gen
    )
    select distinct on (id) id, padre_id, madre_id from anc order by id, g
  ) t;
  return private.relacion_core(ids, sires, dams, p_a, p_b);
end;
$$;

create function private.completitud_libro(p_libro uuid, p_generaciones int) returns numeric
language sql stable set search_path = ''
as $$
  with recursive s (id, g) as (
    select p_libro, 0
    union all
    select v.x, s.g + 1
    from s
    join public.libro_genealogico a on a.id = s.id
    cross join lateral (values (a.padre_id), (a.madre_id)) v (x)
    where s.g < p_generaciones
  )
  select round(
    count(*) filter (where id is not null and g between 1 and p_generaciones)::numeric
    / (power(2::numeric, p_generaciones + 1) - 2), 3)
  from s;
$$;

-- ───────────────────────── Endogamia: funciones públicas ─────────────────────────
create function public.coef_endogamia_libro(p_libro uuid) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  lp uuid; lm uuid; hallado boolean;
begin
  select padre_id, madre_id, true into lp, lm, hallado from public.libro_genealogico where id = p_libro;
  if hallado is not true then
    raise exception 'Animal del libro no encontrado.' using errcode = 'P0002';
  end if;
  if lp is null or lm is null then return 0; end if;
  return round((0.5 * coalesce(private.relacion_libro(lp, lm), 0))::numeric, 6);
end;
$$;

create function public.simular_endogamia_libro(p_macho uuid, p_hembra uuid) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  m record; h record;
begin
  select id, sexo, especie into m from public.libro_genealogico where id = p_macho;
  select id, sexo, especie into h from public.libro_genealogico where id = p_hembra;
  if m.id is null or h.id is null then
    raise exception 'Animal del libro no encontrado.' using errcode = 'P0002';
  end if;
  if m.sexo <> 'macho' or h.sexo <> 'hembra' then
    raise exception 'La simulación requiere un macho y una hembra.' using errcode = 'check_violation';
  end if;
  if m.especie <> h.especie then
    raise exception 'Ambos animales deben ser de la misma especie.' using errcode = 'check_violation';
  end if;
  return round((0.5 * coalesce(private.relacion_libro(p_macho, p_hembra), 0))::numeric, 6);
end;
$$;

create function public.completitud_pedigri_libro(p_libro uuid, p_generaciones int default 4) returns numeric
language sql stable set search_path = ''
as $$ select private.completitud_libro(p_libro, p_generaciones); $$;

-- Si el animal está vinculado al libro, el pedigrí que cuenta es el del libro (cruza criaderos).
create or replace function public.coef_endogamia(p_animal uuid) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  v_padre uuid; v_madre uuid; v_libro uuid; lp uuid; lm uuid; r double precision;
begin
  select padre_id, madre_id, libro_id into v_padre, v_madre, v_libro
  from public.animales where id = p_animal and deleted_at is null;
  if not found then
    raise exception 'Animal no encontrado.' using errcode = 'P0002';
  end if;
  if v_libro is not null then
    select padre_id, madre_id into lp, lm from public.libro_genealogico where id = v_libro;
    if lp is not null and lm is not null then
      return round((0.5 * coalesce(private.relacion_libro(lp, lm), 0))::numeric, 6);
    end if;
  end if;
  if v_padre is null or v_madre is null then return 0; end if;
  r := private.relacion_aditiva(v_padre, v_madre);
  return round((0.5 * coalesce(r, 0))::numeric, 6);
end;
$$;

create or replace function public.simular_endogamia(p_macho uuid, p_hembra uuid) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  m record; h record; r double precision;
begin
  select id, finca_id, sexo, especie, libro_id into m from public.animales where id = p_macho and deleted_at is null;
  select id, finca_id, sexo, especie, libro_id into h from public.animales where id = p_hembra and deleted_at is null;
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
    r := private.relacion_libro(m.libro_id, h.libro_id);
  else
    r := private.relacion_aditiva(p_macho, p_hembra);
  end if;
  return round((0.5 * coalesce(r, 0))::numeric, 6);
end;
$$;

create or replace function public.completitud_pedigri(p_animal uuid, p_generaciones int default 4) returns numeric
language plpgsql stable set search_path = ''
as $$
declare
  v_libro uuid; v numeric;
begin
  select libro_id into v_libro from public.animales where id = p_animal;
  if v_libro is not null then
    return private.completitud_libro(v_libro, p_generaciones);
  end if;
  with recursive s (id, g) as (
    select p_animal, 0
    union all
    select x.v, s.g + 1
    from s
    join public.animales a on a.id = s.id
    cross join lateral (values (a.padre_id), (a.madre_id)) x (v)
    where s.g < p_generaciones
  )
  select round(
    count(*) filter (where id is not null and g between 1 and p_generaciones)::numeric
    / (power(2::numeric, p_generaciones + 1) - 2), 3)
  into v from s;
  return v;
end;
$$;

revoke execute on function public.coef_endogamia_libro(uuid), public.simular_endogamia_libro(uuid, uuid),
  public.completitud_pedigri_libro(uuid, int) from public, anon;
grant execute on function public.coef_endogamia_libro(uuid), public.simular_endogamia_libro(uuid, uuid),
  public.completitud_pedigri_libro(uuid, int) to authenticated;

-- ───────────────────────── Importación (solo llave de servicio) ─────────────────────────
create function private.upsert_titular(p_entidad text, p_tipo text, p_documento text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_digitos text := private.normalizar_documento(p_documento);
  v_tipo text := upper(btrim(coalesce(p_tipo, '')));
  v_id uuid;
begin
  if v_digitos = '' or v_digitos ~ '^0+$' then return null; end if;
  if v_tipo = 'NT' then v_tipo := 'NIT'; end if;
  if v_tipo not in ('CC', 'CE', 'NIT') then v_tipo := 'OTRO'; end if;

  insert into public.libro_titulares (entidad, documento_tipo, documento_hash, documento_ultimos4, persona_juridica)
  values (p_entidad, v_tipo, private.hash_documento(v_digitos), right(v_digitos, 4), v_tipo = 'NIT')
  on conflict (entidad, documento_hash) do update set documento_tipo = public.libro_titulares.documento_tipo
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.upsert_titular(text, text, text) from public, anon, authenticated;

create function public.importar_libro_lote(p_lote jsonb, p_entidad text default 'ANCO') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e jsonb; v_titular uuid; v_criador uuid; v_raza smallint; v_nuevo boolean;
  insertados int := 0; actualizados int := 0; sin_raza int := 0; errores jsonb := '[]'::jsonb;
begin
  for e in select * from jsonb_array_elements(p_lote) loop
    begin
      v_titular := private.upsert_titular(p_entidad, e #>> '{titular,tipo}', e #>> '{titular,documento}');
      v_criador := private.upsert_titular(p_entidad, e #>> '{criador,tipo}', e #>> '{criador,documento}');

      select ra.raza_id into v_raza
      from public.razas_alias ra
      where ra.especie = (e ->> 'especie')::public.especie
        and ra.alias = upper(regexp_replace(btrim(coalesce(e ->> 'raza', '')), '\s+', ' ', 'g'));
      if v_raza is null then sin_raza := sin_raza + 1; end if;

      insert into public.libro_genealogico (
        entidad, numero_registro, chip, nombre, prefijo, especie, sexo, raza_id, composicion, libro, concepcion,
        fecha_nacimiento, fecha_solicitud, color, rasgos, marcas, puntaje_fundador, padre_chip_origen, madre_chip_origen,
        criadero, departamento_dane, municipio_dane, estado, fecha_baja, titular_id, criador_id, foto_origen,
        observaciones, datos_origen, notas_importacion)
      values (
        p_entidad, e ->> 'numero_registro', e ->> 'chip', e ->> 'nombre', nullif(e ->> 'prefijo', ''),
        (e ->> 'especie')::public.especie, (e ->> 'sexo')::public.sexo_animal, v_raza,
        nullif(e ->> 'composicion', ''), nullif(e ->> 'libro', ''), nullif(e ->> 'concepcion', ''),
        nullif(e ->> 'fecha_nacimiento', '')::date, nullif(e ->> 'fecha_solicitud', '')::date,
        nullif(e ->> 'color', ''), nullif(e ->> 'rasgos', ''), nullif(e ->> 'marcas', ''),
        nullif(e ->> 'puntaje_fundador', '')::smallint, nullif(e ->> 'padre_chip', ''), nullif(e ->> 'madre_chip', ''),
        nullif(e ->> 'criadero', ''), nullif(e ->> 'departamento_dane', ''), nullif(e ->> 'municipio_dane', ''),
        coalesce(nullif(e ->> 'estado', ''), 'vivo'), nullif(e ->> 'fecha_baja', '')::date, v_titular, v_criador,
        nullif(e ->> 'foto_origen', ''), nullif(e ->> 'observaciones', ''),
        coalesce(e -> 'datos_origen', '{}'::jsonb),
        coalesce(array(select jsonb_array_elements_text(coalesce(e -> 'notas', '[]'::jsonb))), '{}'))
      on conflict (entidad, numero_registro) do update set
        chip = excluded.chip, nombre = excluded.nombre, prefijo = excluded.prefijo, especie = excluded.especie,
        sexo = excluded.sexo, raza_id = excluded.raza_id, composicion = excluded.composicion, libro = excluded.libro,
        concepcion = excluded.concepcion, fecha_nacimiento = excluded.fecha_nacimiento,
        fecha_solicitud = excluded.fecha_solicitud, color = excluded.color, rasgos = excluded.rasgos,
        marcas = excluded.marcas, puntaje_fundador = excluded.puntaje_fundador,
        padre_chip_origen = excluded.padre_chip_origen, madre_chip_origen = excluded.madre_chip_origen,
        criadero = excluded.criadero, departamento_dane = excluded.departamento_dane,
        municipio_dane = excluded.municipio_dane, estado = excluded.estado, fecha_baja = excluded.fecha_baja,
        titular_id = excluded.titular_id, criador_id = excluded.criador_id, foto_origen = excluded.foto_origen,
        observaciones = excluded.observaciones, datos_origen = excluded.datos_origen,
        notas_importacion = excluded.notas_importacion
      returning (xmax = 0) into v_nuevo;

      if v_nuevo then insertados := insertados + 1; else actualizados := actualizados + 1; end if;
    exception when others then
      if jsonb_array_length(errores) < 20 then
        errores := errores || jsonb_build_object('numero_registro', e ->> 'numero_registro', 'error', sqlerrm);
      end if;
    end;
  end loop;

  return jsonb_build_object('insertados', insertados, 'actualizados', actualizados, 'sin_raza', sin_raza, 'errores', errores);
end;
$$;

-- Enlaza padre y madre por chip una vez cargado todo el libro, descartando vínculos imposibles.
create function public.resolver_padres_libro(p_entidad text default 'ANCO') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_padres int; v_madres int; v_ciclos int; v_sin_padre int; v_sin_madre int;
begin
  with u as (
    update public.libro_genealogico h set padre_id = p.id
    from public.libro_genealogico p
    where h.entidad = p_entidad and p.entidad = p_entidad
      and h.padre_chip_origen is not null and p.chip = h.padre_chip_origen
      and p.id <> h.id and p.sexo = 'macho' and p.especie = h.especie
      and (p.fecha_nacimiento is null or h.fecha_nacimiento is null or p.fecha_nacimiento < h.fecha_nacimiento)
      and h.padre_id is distinct from p.id
    returning h.id)
  select count(*) into v_padres from u;

  with u as (
    update public.libro_genealogico h set madre_id = p.id
    from public.libro_genealogico p
    where h.entidad = p_entidad and p.entidad = p_entidad
      and h.madre_chip_origen is not null and p.chip = h.madre_chip_origen
      and p.id <> h.id and p.sexo = 'hembra' and p.especie = h.especie
      and (p.fecha_nacimiento is null or h.fecha_nacimiento is null or p.fecha_nacimiento < h.fecha_nacimiento)
      and h.madre_id is distinct from p.id
    returning h.id)
  select count(*) into v_madres from u;

  -- Notas de por qué un padre/madre declarado no quedó enlazado.
  update public.libro_genealogico h set notas_importacion =
    coalesce((select array_agg(x) from unnest(h.notas_importacion) x where x not like 'padre\_%' and x not like 'madre\_%'), '{}')
    || case
         when h.padre_chip_origen is null or h.padre_id is not null then '{}'::text[]
         when p.id is null then array['padre_no_encontrado']
         when p.sexo <> 'macho' then array['padre_no_es_macho']
         when p.especie <> h.especie then array['padre_otra_especie']
         else array['padre_nace_despues_que_la_cria']
       end
    || case
         when h.madre_chip_origen is null or h.madre_id is not null then '{}'::text[]
         when m.id is null then array['madre_no_encontrada']
         when m.sexo <> 'hembra' then array['madre_no_es_hembra']
         when m.especie <> h.especie then array['madre_otra_especie']
         else array['madre_nace_despues_que_la_cria']
       end
  from public.libro_genealogico h2
  left join public.libro_genealogico p on p.entidad = p_entidad and p.chip = h2.padre_chip_origen
  left join public.libro_genealogico m on m.entidad = p_entidad and m.chip = h2.madre_chip_origen
  where h.id = h2.id and h.entidad = p_entidad;

  select count(*) filter (where padre_chip_origen is not null and padre_id is null),
         count(*) filter (where madre_chip_origen is not null and madre_id is null)
  into v_sin_padre, v_sin_madre
  from public.libro_genealogico where entidad = p_entidad;

  with recursive a (origen, actual, prof) as (
    select l.id, v.x, 1
    from public.libro_genealogico l
    cross join lateral (values (l.padre_id), (l.madre_id)) v (x)
    where l.entidad = p_entidad and v.x is not null
    union all
    select a.origen, v.x, a.prof + 1
    from a
    join public.libro_genealogico l on l.id = a.actual
    cross join lateral (values (l.padre_id), (l.madre_id)) v (x)
    where v.x is not null and a.prof < 20 and a.actual <> a.origen
  )
  select count(distinct origen) into v_ciclos from a where actual = origen;

  return jsonb_build_object('padres_enlazados', v_padres, 'madres_enlazadas', v_madres,
    'padres_sin_enlazar', v_sin_padre, 'madres_sin_enlazar', v_sin_madre, 'animales_en_ciclos', v_ciclos);
end;
$$;

revoke all on function public.importar_libro_lote(jsonb, text), public.resolver_padres_libro(text)
  from public, anon, authenticated;
grant execute on function public.importar_libro_lote(jsonb, text), public.resolver_padres_libro(text) to service_role;

-- ───────────────────────── Reclamo de animales ─────────────────────────
create function public.solicitar_reclamo(p_finca uuid, p_tipo text, p_documento text, p_mensaje text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_digitos text := private.normalizar_documento(p_documento);
  v_titular uuid; v_total int; v_vivos int; v_sol uuid; v_intentos int;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = 'insufficient_privilege';
  end if;
  if not private.puede_gestionar(p_finca) then
    raise exception 'Solo el propietario o un administrador de la finca puede reclamar animales.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_digitos) < 5 then
    raise exception 'Escribe el número de documento completo.' using errcode = 'check_violation';
  end if;

  select count(*) into v_intentos from public.intentos_reclamo
  where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_intentos >= 10 then
    raise exception 'Demasiados intentos. Espera un rato antes de volver a probar.' using errcode = 'P0001';
  end if;

  -- Los NIT a veces se registran con o sin dígito de verificación.
  select id into v_titular from public.libro_titulares
  where entidad = 'ANCO'
    and documento_hash in (
      private.hash_documento(v_digitos),
      case when char_length(v_digitos) = 10 then private.hash_documento(left(v_digitos, 9)) end)
  limit 1;

  insert into public.intentos_reclamo (user_id, encontrado) values (v_uid, v_titular is not null);
  if v_titular is null then
    return jsonb_build_object('encontrado', false);
  end if;

  select count(*), count(*) filter (where l.estado = 'vivo') into v_total, v_vivos
  from public.libro_genealogico l
  where l.titular_id = v_titular
    and not exists (select 1 from public.animales a where a.libro_id = l.id and a.deleted_at is null);
  if v_total = 0 then
    return jsonb_build_object('encontrado', true, 'animales', 0);
  end if;

  select id into v_sol from public.solicitudes_reclamo
  where finca_id = p_finca and titular_id = v_titular and estado = 'pendiente';
  if v_sol is null then
    insert into public.solicitudes_reclamo (finca_id, titular_id, solicitante_id, mensaje, animales_disponibles)
    values (p_finca, v_titular, v_uid, nullif(btrim(p_mensaje), ''), v_total)
    returning id into v_sol;
  end if;
  return jsonb_build_object('encontrado', true, 'solicitud_id', v_sol, 'animales', v_total, 'vivos', v_vivos);
end;
$$;

create function public.admin_listar_reclamos(p_estado text default 'pendiente')
returns table (
  id uuid, estado text, creada_en timestamptz, finca_id uuid, finca_nombre text,
  solicitante_nombre text, solicitante_email text, documento_tipo text, documento_ultimos4 text,
  persona_juridica boolean, animales_total integer, animales_vivos integer, criaderos text[],
  mensaje text, motivo_rechazo text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver las solicitudes.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select s.id, s.estado, s.created_at, s.finca_id, f.nombre,
         coalesce(p.nombre, ''), coalesce(u.email::text, ''),
         t.documento_tipo, t.documento_ultimos4, t.persona_juridica,
         (select count(*)::integer from public.libro_genealogico l where l.titular_id = s.titular_id),
         (select count(*)::integer from public.libro_genealogico l where l.titular_id = s.titular_id and l.estado = 'vivo'),
         coalesce((select array_agg(c) from (
            select distinct l.criadero as c from public.libro_genealogico l
            where l.titular_id = s.titular_id and l.criadero is not null limit 5) x), '{}'),
         s.mensaje, s.motivo_rechazo
  from public.solicitudes_reclamo s
  join public.fincas f on f.id = s.finca_id
  join public.libro_titulares t on t.id = s.titular_id
  left join public.perfiles p on p.id = s.solicitante_id
  left join auth.users u on u.id = s.solicitante_id
  where p_estado is null or s.estado = p_estado
  order by s.created_at desc
  limit 200;
end;
$$;

create function public.aprobar_reclamo(p_solicitud uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  s public.solicitudes_reclamo; v_prop public.vocacion_animal; v_importados int; v_padres int; v_madres int;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede aprobar reclamos.' using errcode = 'insufficient_privilege';
  end if;
  select * into s from public.solicitudes_reclamo where id = p_solicitud for update;
  if not found then
    raise exception 'La solicitud no existe.' using errcode = 'P0002';
  end if;
  if s.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue resuelta.' using errcode = 'check_violation';
  end if;
  select proposito into v_prop from public.fincas where id = s.finca_id;

  -- La finca debe tener activas las especies de los animales que recibe.
  update public.fincas f set especies = (
    select array_agg(distinct e) from unnest(
      f.especies || array(select distinct l.especie from public.libro_genealogico l where l.titular_id = s.titular_id)) e)
  where f.id = s.finca_id;

  with src as (
    select l.*, r.aptitud, pl.nombre as padre_nombre, pl.prefijo as padre_prefijo, ml.nombre as madre_nombre, ml.prefijo as madre_prefijo
    from public.libro_genealogico l
    left join public.razas r on r.id = l.raza_id
    left join public.libro_genealogico pl on pl.id = l.padre_id
    left join public.libro_genealogico ml on ml.id = l.madre_id
    where l.titular_id = s.titular_id
      and not exists (select 1 from public.animales a where a.libro_id = l.id and a.deleted_at is null)
  ), ins as (
    insert into public.animales (
      finca_id, especie, numero_arete, nombre, sexo, raza_id, fecha_nacimiento, origen, vocacion, estado, fecha_baja,
      notas, chip, color, rasgos, marcas, libro_id, padre_externo, madre_externa)
    select s.finca_id, l.especie, coalesce(nullif(l.prefijo, ''), 'REG') || '-' || l.numero_registro, l.nombre, l.sexo,
           l.raza_id, l.fecha_nacimiento,
           case when l.criador_id is not null and l.criador_id = l.titular_id then 'nacido_en_finca' else 'comprado' end,
           coalesce(l.aptitud, v_prop),
           case when l.estado = 'vivo' then 'activo' else 'muerto' end,
           case when l.estado = 'vivo' then null else coalesce(l.fecha_baja, current_date) end,
           nullif(concat_ws(E'\n', l.observaciones,
             case when l.estado = 'baja' and l.fecha_baja is null then 'Baja registrada en el libro sin fecha.' end), ''),
           l.chip, l.color, l.rasgos, l.marcas, l.id,
           case when l.padre_id is not null then concat_ws(' ', l.padre_prefijo, l.padre_nombre) else l.padre_chip_origen end,
           case when l.madre_id is not null then concat_ws(' ', l.madre_prefijo, l.madre_nombre) else l.madre_chip_origen end
    from src l
    on conflict do nothing
    returning 1)
  select count(*) into v_importados from ins;

  -- Enlaza padre y madre dentro de la finca cuando ambos ya están aquí (el resto se lee desde el libro).
  with u as (
    update public.animales a set padre_id = pa.id
    from public.libro_genealogico l
    join public.animales pa on pa.libro_id = l.padre_id and pa.finca_id = s.finca_id and pa.deleted_at is null
    where a.libro_id = l.id and a.finca_id = s.finca_id and a.deleted_at is null and a.padre_id is null
      and pa.sexo = 'macho' and pa.especie = a.especie and pa.id <> a.id
      and (pa.fecha_nacimiento is null or a.fecha_nacimiento is null or pa.fecha_nacimiento < a.fecha_nacimiento)
    returning 1)
  select count(*) into v_padres from u;

  with u as (
    update public.animales a set madre_id = ma.id
    from public.libro_genealogico l
    join public.animales ma on ma.libro_id = l.madre_id and ma.finca_id = s.finca_id and ma.deleted_at is null
    where a.libro_id = l.id and a.finca_id = s.finca_id and a.deleted_at is null and a.madre_id is null
      and ma.sexo = 'hembra' and ma.especie = a.especie and ma.id <> a.id
      and (ma.fecha_nacimiento is null or a.fecha_nacimiento is null or ma.fecha_nacimiento < a.fecha_nacimiento)
    returning 1)
  select count(*) into v_madres from u;

  update public.solicitudes_reclamo set estado = 'aprobada', animales_importados = v_importados,
    resuelta_por = (select auth.uid()), resuelta_en = now()
  where id = s.id;

  return jsonb_build_object('importados', v_importados, 'padres_enlazados', v_padres, 'madres_enlazadas', v_madres);
end;
$$;

create function public.rechazar_reclamo(p_solicitud uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede rechazar reclamos.' using errcode = 'insufficient_privilege';
  end if;
  update public.solicitudes_reclamo
  set estado = 'rechazada', motivo_rechazo = nullif(btrim(p_motivo), ''), resuelta_por = (select auth.uid()), resuelta_en = now()
  where id = p_solicitud and estado = 'pendiente';
  if not found then
    raise exception 'La solicitud no existe o ya fue resuelta.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.solicitar_reclamo(uuid, text, text, text), public.admin_listar_reclamos(text),
  public.aprobar_reclamo(uuid), public.rechazar_reclamo(uuid, text) from public, anon;
grant execute on function public.solicitar_reclamo(uuid, text, text, text), public.admin_listar_reclamos(text),
  public.aprobar_reclamo(uuid), public.rechazar_reclamo(uuid, text) to authenticated;
