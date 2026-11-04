-- Cargue de historia desde Excel: pesajes y ordeños pasados, con el mismo lote reversible que el cargue de animales.
--  · `pesajes.importacion_id` y `ordenos.importacion_id` marcan lo que trajo cada cargue; `importaciones.tipo` admite 'pesajes' y 'ordenos'.
--  · `importar_historial(p_finca, p_tipo, p_filas, p_archivo)`: todo o nada; un animal por arete (debe estar en el hato; los ordeños, de una hembra);
--    lo que ya estaba registrado (mismo animal y día, o animal, día y jornada) se deja como está y se cuenta como omitido.
--  · `deshacer_importacion` también deshace estos cargues si ninguno de sus registros se editó después.

alter table public.importaciones drop constraint importaciones_tipo_check;
alter table public.importaciones add constraint importaciones_tipo_check check (tipo in ('animales', 'pesajes', 'ordenos'));

alter table public.pesajes add column importacion_id uuid;
alter table public.pesajes
  add constraint pesajes_importacion_fk foreign key (importacion_id, finca_id)
  references public.importaciones (id, finca_id) on delete set null (importacion_id);
create index pesajes_importacion_idx on public.pesajes (importacion_id, finca_id) where importacion_id is not null;

alter table public.ordenos add column importacion_id uuid;
alter table public.ordenos
  add constraint ordenos_importacion_fk foreign key (importacion_id, finca_id)
  references public.importaciones (id, finca_id) on delete set null (importacion_id);
create index ordenos_importacion_idx on public.ordenos (importacion_id, finca_id) where importacion_id is not null;

create or replace function public.importar_historial(p_finca uuid, p_tipo text, p_filas jsonb, p_archivo text default null)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  c_max constant integer := 5000;
  v_hoy constant date := (now() at time zone 'America/Bogota')::date;
  v_total integer;
  v_imp uuid;
  v_creados integer;
  v_mal record;
begin
  if p_tipo not in ('pesajes', 'ordenos') then
    raise exception 'El tipo de cargue no es válido.' using errcode = 'check_violation';
  end if;
  if not private.puede_escribir(p_finca, case p_tipo when 'pesajes' then 'carne' else 'leche' end::public.modulo_app) then
    raise exception 'No tienes permiso para registrar % en esta finca.', case p_tipo when 'pesajes' then 'pesos' else 'ordeños' end using errcode = 'insufficient_privilege';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no tiene registros para cargar.' using errcode = 'check_violation';
  end if;
  v_total := jsonb_array_length(p_filas);
  if v_total > c_max then
    raise exception 'Son demasiados registros a la vez (máximo %).', c_max using errcode = 'check_violation';
  end if;

  -- Cada fila debe ser de un animal del hato (y, en ordeños, de una hembra): se dice la fila del Excel y el arete.
  select f.n, f.f ->> 'fila' as fila, btrim(f.f ->> 'numero_arete') as arete, a.id as animal, a.sexo
    into v_mal
  from jsonb_array_elements(p_filas) with ordinality f(f, n)
  left join public.animales a on a.finca_id = p_finca and a.deleted_at is null and lower(btrim(a.numero_arete)) = lower(btrim(f.f ->> 'numero_arete'))
  where a.id is null or (p_tipo = 'ordenos' and a.sexo <> 'hembra')
  order by f.n limit 1;
  if found then
    if v_mal.animal is null then
      raise exception 'Fila %, arete «%»: no está en tu hato.', coalesce(v_mal.fila, (v_mal.n + 1)::text), v_mal.arete using errcode = 'check_violation';
    end if;
    raise exception 'Fila %, arete «%»: el ordeño debe registrarse sobre una hembra.', coalesce(v_mal.fila, (v_mal.n + 1)::text), v_mal.arete using errcode = 'check_violation';
  end if;

  insert into public.importaciones (finca_id, tipo, archivo, modo) values (p_finca, p_tipo, left(nullif(btrim(p_archivo), ''), 200), 'nuevos') returning id into v_imp;

  if p_tipo = 'pesajes' then
    with filas as (select f.f from jsonb_array_elements(p_filas) f(f)),
    ins as (
      insert into public.pesajes (finca_id, animal_id, fecha, peso_kg, tipo, condicion_corporal, observaciones, importacion_id)
      select p_finca, a.id, (f.f ->> 'fecha')::date, (f.f ->> 'peso_kg')::numeric, coalesce(nullif(f.f ->> 'tipo', ''), 'control'),
             nullif(f.f ->> 'condicion_corporal', '')::numeric, nullif(btrim(f.f ->> 'observaciones'), ''), v_imp
      from filas f
      join public.animales a on a.finca_id = p_finca and a.deleted_at is null and lower(btrim(a.numero_arete)) = lower(btrim(f.f ->> 'numero_arete'))
      where (f.f ->> 'fecha')::date <= v_hoy
      on conflict (animal_id, fecha) do nothing
      returning 1
    )
    select count(*) into v_creados from ins;
  else
    with filas as (select f.f from jsonb_array_elements(p_filas) f(f)),
    ins as (
      insert into public.ordenos (finca_id, animal_id, fecha, jornada, litros, descartada, motivo_descarte, observaciones, importacion_id)
      select p_finca, a.id, (f.f ->> 'fecha')::date, coalesce(nullif(f.f ->> 'jornada', ''), 'unico'), (f.f ->> 'litros')::numeric,
             coalesce((f.f ->> 'descartada')::boolean, false), case when coalesce((f.f ->> 'descartada')::boolean, false) then 'otro' end,
             nullif(btrim(f.f ->> 'observaciones'), ''), v_imp
      from filas f
      join public.animales a on a.finca_id = p_finca and a.deleted_at is null and lower(btrim(a.numero_arete)) = lower(btrim(f.f ->> 'numero_arete'))
      where (f.f ->> 'fecha')::date <= v_hoy
      on conflict (animal_id, fecha, jornada) do nothing
      returning 1
    )
    select count(*) into v_creados from ins;
  end if;

  update public.importaciones set creados = v_creados, omitidos = v_total - v_creados where id = v_imp;
  return jsonb_build_object('importacion', v_imp, 'creados', v_creados, 'omitidos', v_total - v_creados);
end;
$$;

revoke execute on function public.importar_historial(uuid, text, jsonb, text) from public, anon;
grant execute on function public.importar_historial(uuid, text, jsonb, text) to authenticated;

create or replace function public.deshacer_importacion(p_importacion uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  c_claves constant text[] := array['nombre','raza_id','fecha_nacimiento','fecha_nacimiento_aprox','padre_id','madre_id','padre_externo','madre_externa',
    'chip','color','marcas','notas','peso_nacer_kg','valor_compra','fecha_compra','partos_previos','uso_macho','vocacion'];
  -- Lo que el propio cargue registra a cada animal que crea: se va con él si nadie lo tocó después.
  c_propias constant text[] := array['lactancias_animal_fk', 'movimientos_animal_fk', 'diagnosticos_hembra_fk', 'servicios_hembra_fk', 'servicios_macho_fk'];
  v_imp public.importaciones;
  v_ids uuid[];
  v_n bigint;
  v_en_uso text[] := '{}';
  r record;
  v_c jsonb;
  k text;
  v_filas integer;
  v_eliminados integer := 0;
  v_revertidos integer := 0;
  v_conservados integer := 0;
begin
  select * into v_imp from public.importaciones where id = p_importacion for update;
  if not found then
    raise exception 'Esa carga no existe.' using errcode = 'no_data_found';
  end if;
  if not private.puede_gestionar(v_imp.finca_id) then
    raise exception 'Solo el propietario o un administrador puede deshacer una carga.' using errcode = 'insufficient_privilege';
  end if;
  if v_imp.estado <> 'aplicada' then
    raise exception 'Esta carga ya se deshizo.' using errcode = 'check_violation';
  end if;

  -- Un cargue de historia (pesajes u ordeños): se quitan sus registros si nadie los editó después.
  if v_imp.tipo in ('pesajes', 'ordenos') then
    execute format('select count(*) from public.%I where importacion_id = $1 and updated_at > $2', v_imp.tipo) using p_importacion, v_imp.created_at into v_n;
    if v_n > 0 then
      raise exception 'Ya se modificaron % registros de esta carga: ya no se puede deshacer completa.', v_n using errcode = 'check_violation';
    end if;
    execute format('delete from public.%I where importacion_id = $1', v_imp.tipo) using p_importacion;
    get diagnostics v_eliminados = row_count;
    update public.importaciones set estado = 'deshecha', deshecha_en = now(), deshecha_por = auth.uid() where id = p_importacion;
    return jsonb_build_object('eliminados', v_eliminados, 'revertidos', 0, 'conservados', 0);
  end if;

  select coalesce(array_agg(id), '{}') into v_ids from public.animales where importacion_id = p_importacion;

  if cardinality(v_ids) > 0 then
    select count(*) into v_n from public.animales where importacion_id = p_importacion and updated_at > v_imp.created_at;
    if v_n > 0 then
      raise exception 'Ya se modificaron % de los animales de esta carga: ya no se puede deshacer completa.', v_n using errcode = 'check_violation';
    end if;

    -- Todo lo que apunta a un animal cargado y que el cargue no creó (las llaves foráneas de `animales` lo encuentran sin lista a mano).
    for r in
      select c.conrelid::regclass::text as tabla, c.conname, a.attname as col, (c.conrelid = 'public.animales'::regclass) as es_animales
      from pg_constraint c
      join lateral (select c.conkey[array_position(c.confkey, (select attnum from pg_attribute where attrelid = 'public.animales'::regclass and attname = 'id'))] as n) x on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = x.n
      where c.contype = 'f' and c.confrelid = 'public.animales'::regclass
    loop
      if r.es_animales then
        execute format('select count(*) from %s t where t.%I = any($1) and t.importacion_id is distinct from $2', r.tabla, r.col) using v_ids, p_importacion into v_n;
      elsif r.conname = any (c_propias) then
        execute format('select count(*) from %s t where t.%I = any($1) and t.created_at <> $2', r.tabla, r.col) using v_ids, v_imp.created_at into v_n;
      else
        execute format('select count(*) from %s t where t.%I = any($1)', r.tabla, r.col) using v_ids into v_n;
      end if;
      if v_n > 0 then v_en_uso := v_en_uso || r.tabla; end if;
    end loop;
    if cardinality(v_en_uso) > 0 then
      raise exception 'Algunos animales de esta carga ya tienen registros (ordeños, pesajes, sanidad, partos, ventas…): ya no se puede deshacer completa.'
        using errcode = 'check_violation', detail = array_to_string(v_en_uso, ', ');
    end if;
  end if;

  -- Los animales que ya existían recuperan lo que el cargue cambió, salvo lo que alguien volvió a editar después.
  for v_c in select * from jsonb_array_elements(v_imp.cambios) loop
    for k in select jsonb_object_keys(v_c -> 'despues') loop
      continue when not (k = any (c_claves));
      execute format(
        'update public.animales set %1$I = (jsonb_populate_record(null::public.animales, $1)).%1$I where id = $2 and %1$I is not distinct from (jsonb_populate_record(null::public.animales, $3)).%1$I',
        k) using jsonb_build_object(k, (v_c -> 'antes') -> k), (v_c ->> 'id')::uuid, jsonb_build_object(k, (v_c -> 'despues') -> k);
      get diagnostics v_filas = row_count;
      if v_filas > 0 then v_revertidos := v_revertidos + 1; else v_conservados := v_conservados + 1; end if;
    end loop;
  end loop;

  -- Los servicios, lactancias, diagnósticos y movimientos del cargue se van en cascada con sus animales.
  -- Primero las hembras (sus servicios, lactancias y diagnósticos se van en cascada) y luego los machos: al revés, la base intentaría
  -- dejar sin semental el servicio de una hembra que todavía existe.
  delete from public.animales where importacion_id = p_importacion and sexo = 'hembra';
  get diagnostics v_filas = row_count;
  v_eliminados := v_filas;
  delete from public.animales where importacion_id = p_importacion;
  get diagnostics v_filas = row_count;
  v_eliminados := v_eliminados + v_filas;

  update public.importaciones set estado = 'deshecha', deshecha_en = now(), deshecha_por = auth.uid() where id = p_importacion;

  return jsonb_build_object('eliminados', v_eliminados, 'revertidos', v_revertidos, 'conservados', v_conservados);
end;
$$;

revoke execute on function public.deshacer_importacion(uuid) from public, anon;
grant execute on function public.deshacer_importacion(uuid) to authenticated;
