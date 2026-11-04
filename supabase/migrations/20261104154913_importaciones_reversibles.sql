-- Cargue de animales por lotes que se pueden deshacer, y con modo «completar / corregir» para los animales que ya existen.
--  · `importaciones`: un registro por cargue (archivo, modo, cuántos creó y actualizó, y qué cambió en los existentes para poder revertirlo).
--  · `animales.importacion_id`: marca a los animales que creó cada cargue.
--  · `importar_animales(p_finca, p_filas, p_modo, p_archivo)`: como `importar_animales_lote` (que se deja igual: retrocompatible) pero registra el lote
--    y, según el modo, omite, completa (solo campos vacíos) o corrige (el archivo manda) a los animales cuyo arete ya existe.
--    A los que ya existen NO se les tocan servicios, lactancias ni corral: solo los datos del animal. La genealogía solo se completa, nunca se reemplaza.
--  · `deshacer_importacion(p_importacion)`: solo propietario o administrador. Quita los animales que creó el cargue (con lo que el propio cargue les
--    registró) y devuelve los campos que cambió en los existentes. Se niega si algo del cargue ya se usó (ordeños, pesajes, sanidad, partos, ventas…
--    se detecta por las llaves foráneas de `animales`, así una tabla nueva queda protegida sola) o si un animal creado se editó después.

create table public.importaciones (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  tipo text not null default 'animales' check (tipo in ('animales')),
  archivo text check (archivo is null or char_length(archivo) <= 200),
  modo text not null check (modo in ('nuevos', 'completar', 'corregir')),
  creados integer not null default 0,
  actualizados integer not null default 0,
  omitidos integer not null default 0,
  cambios jsonb not null default '[]'::jsonb,
  estado text not null default 'aplicada' check (estado in ('aplicada', 'deshecha')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  deshecha_en timestamptz,
  deshecha_por uuid,
  unique (id, finca_id)
);
create index importaciones_finca_idx on public.importaciones (finca_id, created_at desc);

select private.crear_politicas_finca('importaciones', 'hato');
grant select, insert, update on public.importaciones to authenticated;

alter table public.animales add column importacion_id uuid;
alter table public.animales
  add constraint animales_importacion_fk foreign key (importacion_id, finca_id)
  references public.importaciones (id, finca_id) on delete set null (importacion_id);
create index animales_importacion_idx on public.animales (importacion_id, finca_id) where importacion_id is not null;

-- Elige el valor que queda al «completar» (solo si no había) o «corregir» (el archivo manda). Un valor nuevo vacío nunca borra nada.
create or replace function private.elegir(p_modo text, p_actual anyelement, p_nuevo anyelement)
returns anyelement language sql immutable set search_path = '' as $$
  select case when p_nuevo is null then p_actual when p_modo = 'corregir' then p_nuevo else coalesce(p_actual, p_nuevo) end
$$;

create or replace function public.importar_animales(p_finca uuid, p_filas jsonb, p_modo text default 'nuevos', p_archivo text default null)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  c_max constant integer := 500;
  c_claves constant text[] := array['nombre','raza_id','fecha_nacimiento','fecha_nacimiento_aprox','padre_id','madre_id','padre_externo','madre_externa',
    'chip','color','marcas','notas','peso_nacer_kg','valor_compra','fecha_compra','partos_previos','uso_macho','vocacion'];
  v_hoy constant date := (now() at time zone 'America/Bogota')::date;
  v_imp uuid;
  v_fila jsonb;
  v_i integer := 0;
  v_nfila text;
  v_arete text;
  v_padre uuid;
  v_madre uuid;
  v_id uuid;
  v_macho uuid;
  v_servicio uuid;
  v_sexo public.sexo_animal;
  v_uso text;
  v_parto date;
  v_ex public.animales;
  v_antes jsonb;
  v_despues jsonb;
  v_a jsonb;
  v_d jsonb;
  v_cambios jsonb := '[]'::jsonb;
  v_nuevos integer := 0;
  v_actualizados integer := 0;
  v_sin_cambios integer := 0;
  v_omitidos integer := 0;
  v_con_padres integer := 0;
  v_partos integer := 0;
  v_servicios integer := 0;
  v_ubicados integer := 0;
begin
  if not private.puede_escribir(p_finca, 'hato') then
    raise exception 'No tienes permiso para registrar animales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_modo is null or p_modo not in ('nuevos', 'completar', 'corregir') then
    raise exception 'El modo de cargue no es válido.' using errcode = 'check_violation';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no tiene animales para cargar.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_filas) > c_max then
    raise exception 'Son demasiados animales a la vez (máximo %).', c_max using errcode = 'check_violation';
  end if;

  insert into public.importaciones (finca_id, archivo, modo) values (p_finca, left(nullif(btrim(p_archivo), ''), 200), p_modo) returning id into v_imp;

  -- 1) Los animales (padres antes que crías); a los que ya existen se los omite, completa o corrige según el modo.
  for v_fila in select * from jsonb_array_elements(p_filas) loop
    v_i := v_i + 1;
    v_arete := btrim(v_fila ->> 'numero_arete');
    v_nfila := coalesce(nullif(v_fila ->> 'fila', ''), (v_i + 1)::text);
    begin
      v_padre := null; v_madre := null; v_uso := null; v_parto := null;
      v_sexo := (v_fila ->> 'sexo')::public.sexo_animal;

      select * into v_ex from public.animales
      where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(v_arete);

      if found then
        if p_modo = 'nuevos' then
          v_omitidos := v_omitidos + 1;
          continue;
        end if;
        if v_ex.sexo <> v_sexo then
          raise exception 'el arete ya existe en tu hato como %, y el archivo dice %.', v_ex.sexo, v_sexo using errcode = 'check_violation';
        end if;
        v_id := v_ex.id;
        -- La genealogía solo se completa: si el animal ya tiene padre (o madre), no se cambia.
        if v_ex.padre_id is null and v_ex.padre_externo is null and nullif(btrim(v_fila ->> 'padre_arete'), '') is not null then
          select id into v_padre from public.animales
          where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(btrim(v_fila ->> 'padre_arete'));
          if v_padre is null then
            raise exception 'El padre con arete «%» no está en el hato ni antes en el archivo.', btrim(v_fila ->> 'padre_arete') using errcode = 'check_violation';
          end if;
        end if;
        if v_ex.madre_id is null and v_ex.madre_externa is null and nullif(btrim(v_fila ->> 'madre_arete'), '') is not null then
          select id into v_madre from public.animales
          where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(btrim(v_fila ->> 'madre_arete'));
          if v_madre is null then
            raise exception 'La madre con arete «%» no está en el hato ni antes en el archivo.', btrim(v_fila ->> 'madre_arete') using errcode = 'check_violation';
          end if;
        end if;

        v_antes := to_jsonb(v_ex);
        update public.animales a set
          nombre = private.elegir(p_modo, a.nombre, nullif(btrim(v_fila ->> 'nombre'), '')),
          raza_id = private.elegir(p_modo, a.raza_id, nullif(v_fila ->> 'raza_id', '')::smallint),
          fecha_nacimiento = private.elegir(p_modo, a.fecha_nacimiento, nullif(v_fila ->> 'fecha_nacimiento', '')::date),
          fecha_nacimiento_aprox = case
            when nullif(v_fila ->> 'fecha_nacimiento', '') is null then a.fecha_nacimiento_aprox
            when p_modo = 'corregir' or a.fecha_nacimiento is null then coalesce((v_fila ->> 'fecha_nacimiento_aprox')::boolean, false)
            else a.fecha_nacimiento_aprox end,
          padre_id = coalesce(v_padre, a.padre_id),
          madre_id = coalesce(v_madre, a.madre_id),
          padre_externo = case when v_padre is not null then null
            when a.padre_id is null and a.padre_externo is null then nullif(btrim(v_fila ->> 'padre_externo'), '') else a.padre_externo end,
          madre_externa = case when v_madre is not null then null
            when a.madre_id is null and a.madre_externa is null then nullif(btrim(v_fila ->> 'madre_externa'), '') else a.madre_externa end,
          chip = private.elegir(p_modo, a.chip, nullif(btrim(v_fila ->> 'chip'), '')),
          color = private.elegir(p_modo, a.color, nullif(btrim(v_fila ->> 'color'), '')),
          marcas = private.elegir(p_modo, a.marcas, nullif(btrim(v_fila ->> 'marcas'), '')),
          notas = private.elegir(p_modo, a.notas, nullif(btrim(v_fila ->> 'notas'), '')),
          peso_nacer_kg = private.elegir(p_modo, a.peso_nacer_kg, nullif(v_fila ->> 'peso_nacer_kg', '')::numeric),
          valor_compra = private.elegir(p_modo, a.valor_compra, nullif(v_fila ->> 'valor_compra', '')::numeric),
          fecha_compra = private.elegir(p_modo, a.fecha_compra, nullif(v_fila ->> 'fecha_compra', '')::date),
          partos_previos = case when a.sexo = 'hembra' then private.elegir(p_modo, a.partos_previos, nullif(v_fila ->> 'partos_total', '')::smallint) else a.partos_previos end,
          uso_macho = case when a.sexo = 'macho' and v_fila ->> 'uso_macho' in ('reproductor', 'carne') then private.elegir(p_modo, a.uso_macho, v_fila ->> 'uso_macho') else a.uso_macho end,
          vocacion = case when a.sexo = 'hembra' and nullif(v_fila ->> 'vocacion', '') is not null
            then private.elegir(p_modo, a.vocacion, (v_fila ->> 'vocacion')::public.vocacion_animal) else a.vocacion end
        where a.id = v_id;
        select to_jsonb(a) into v_despues from public.animales a where a.id = v_id;
        select coalesce(jsonb_object_agg(k, v_antes -> k), '{}'::jsonb), coalesce(jsonb_object_agg(k, v_despues -> k), '{}'::jsonb)
          into v_a, v_d from unnest(c_claves) k where (v_antes -> k) is distinct from (v_despues -> k);
        if v_d <> '{}'::jsonb then
          v_cambios := v_cambios || jsonb_build_object('id', v_id, 'arete', v_arete, 'antes', v_a, 'despues', v_d);
          v_actualizados := v_actualizados + 1;
        else
          v_sin_cambios := v_sin_cambios + 1;
        end if;
        continue;
      end if;

      if nullif(btrim(v_fila ->> 'padre_arete'), '') is not null then
        select id into v_padre from public.animales
        where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(btrim(v_fila ->> 'padre_arete'));
        if v_padre is null then
          raise exception 'El padre con arete «%» no está en el hato ni antes en el archivo.', btrim(v_fila ->> 'padre_arete') using errcode = 'check_violation';
        end if;
      end if;
      if nullif(btrim(v_fila ->> 'madre_arete'), '') is not null then
        select id into v_madre from public.animales
        where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(btrim(v_fila ->> 'madre_arete'));
        if v_madre is null then
          raise exception 'La madre con arete «%» no está en el hato ni antes en el archivo.', btrim(v_fila ->> 'madre_arete') using errcode = 'check_violation';
        end if;
      end if;

      if v_sexo = 'macho' and v_fila ->> 'uso_macho' in ('reproductor', 'carne') then v_uso := v_fila ->> 'uso_macho'; end if;
      if v_sexo = 'hembra' then v_parto := nullif(v_fila ->> 'fecha_ultimo_parto', '')::date; end if;

      insert into public.animales (
        finca_id, especie, numero_arete, nombre, sexo, raza_id, fecha_nacimiento, fecha_nacimiento_aprox,
        padre_id, madre_id, padre_externo, madre_externa, origen, vocacion, uso_macho,
        chip, color, marcas, notas, peso_nacer_kg, valor_compra, fecha_compra, partos_previos, importacion_id
      ) values (
        p_finca,
        (v_fila ->> 'especie')::public.especie,
        v_arete,
        nullif(btrim(v_fila ->> 'nombre'), ''),
        v_sexo,
        nullif(v_fila ->> 'raza_id', '')::smallint,
        nullif(v_fila ->> 'fecha_nacimiento', '')::date,
        coalesce((v_fila ->> 'fecha_nacimiento_aprox')::boolean, false),
        v_padre, v_madre,
        case when v_padre is null then nullif(btrim(v_fila ->> 'padre_externo'), '') end,
        case when v_madre is null then nullif(btrim(v_fila ->> 'madre_externa'), '') end,
        coalesce(nullif(v_fila ->> 'origen', ''), 'nacido_en_finca'),
        case when v_sexo = 'macho' then 'carne'::public.vocacion_animal
             else coalesce(nullif(v_fila ->> 'vocacion', ''), 'leche')::public.vocacion_animal end,
        v_uso,
        nullif(btrim(v_fila ->> 'chip'), ''),
        nullif(btrim(v_fila ->> 'color'), ''),
        nullif(btrim(v_fila ->> 'marcas'), ''),
        nullif(btrim(v_fila ->> 'notas'), ''),
        nullif(v_fila ->> 'peso_nacer_kg', '')::numeric,
        nullif(v_fila ->> 'valor_compra', '')::numeric,
        nullif(v_fila ->> 'fecha_compra', '')::date,
        case when v_sexo = 'hembra' then nullif(v_fila ->> 'partos_total', '')::smallint end,
        v_imp
      ) returning id into v_id;

      v_nuevos := v_nuevos + 1;
      if v_padre is not null or v_madre is not null then v_con_padres := v_con_padres + 1; end if;

      if v_parto is not null then
        insert into public.lactancias (finca_id, animal_id, numero, fecha_parto) values (p_finca, v_id, 1, v_parto);
        v_partos := v_partos + 1;
      end if;
    exception when others then
      if sqlstate = '23505' and sqlerrm like '%animales_arete_uk%' then
        raise exception 'Fila %, arete «%»: ya existe un animal con ese arete en esta finca.', v_nfila, v_arete using errcode = 'unique_violation';
      end if;
      raise exception 'Fila %, arete «%»: %', v_nfila, v_arete, sqlerrm using errcode = sqlstate;
    end;
  end loop;

  -- 2) Servicio y preñez, y 3) corral o potrero: solo de los animales que creó este cargue.
  v_i := 0;
  for v_fila in select * from jsonb_array_elements(p_filas) loop
    v_i := v_i + 1;
    v_arete := btrim(v_fila ->> 'numero_arete');
    v_nfila := coalesce(nullif(v_fila ->> 'fila', ''), (v_i + 1)::text);
    begin
      select id, sexo into v_id, v_sexo from public.animales
      where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(v_arete) and importacion_id = v_imp;
      if v_id is null then continue; end if;

      if nullif(v_fila ->> 'fecha_servicio', '') is not null then
        if not private.puede_escribir(p_finca, 'reproduccion') then
          raise exception 'No tienes permiso para registrar servicios en esta finca.' using errcode = 'insufficient_privilege';
        end if;
        v_macho := null;
        if nullif(btrim(v_fila ->> 'semental_arete'), '') is not null then
          select id into v_macho from public.animales
          where finca_id = p_finca and deleted_at is null and lower(btrim(numero_arete)) = lower(btrim(v_fila ->> 'semental_arete'))
            and sexo = 'macho' and especie = (v_fila ->> 'especie')::public.especie;
          if v_macho is null then
            raise exception 'El semental con arete «%» no es un macho de la misma especie en el hato ni en el archivo.', btrim(v_fila ->> 'semental_arete') using errcode = 'check_violation';
          end if;
        end if;
        insert into public.servicios (finca_id, hembra_id, fecha, tipo, macho_id, macho_externo, observaciones)
        values (
          p_finca, v_id, (v_fila ->> 'fecha_servicio')::date,
          coalesce(nullif(v_fila ->> 'tipo_servicio', ''), 'monta_natural'),
          v_macho,
          case when v_macho is null then nullif(btrim(v_fila ->> 'semental_externo'), '') end,
          'Cargado desde Excel'
        ) returning id into v_servicio;
        if coalesce((v_fila ->> 'prenez_confirmada')::boolean, false) then
          insert into public.diagnosticos_gestacion (finca_id, hembra_id, servicio_id, fecha, metodo, resultado, observaciones)
          values (p_finca, v_id, v_servicio, v_hoy, 'otro', 'gestante', 'Preñez confirmada al cargar el animal desde Excel');
        end if;
        v_servicios := v_servicios + 1;
      end if;

      if nullif(v_fila ->> 'ubicacion_id', '') is not null then
        perform public.mover_animales(p_finca, (v_fila ->> 'ubicacion_id')::uuid, array[v_id], v_hoy, 'ingreso', 'Cargado desde Excel');
        v_ubicados := v_ubicados + 1;
      end if;
    exception when others then
      raise exception 'Fila %, arete «%»: %', v_nfila, v_arete, sqlerrm using errcode = sqlstate;
    end;
  end loop;

  update public.importaciones set creados = v_nuevos, actualizados = v_actualizados, omitidos = v_omitidos, cambios = v_cambios where id = v_imp;

  return jsonb_build_object('importacion', v_imp, 'animales', v_nuevos, 'actualizados', v_actualizados, 'sin_cambios', v_sin_cambios, 'omitidos', v_omitidos,
    'con_padres', v_con_padres, 'con_parto', v_partos, 'con_servicio', v_servicios, 'con_ubicacion', v_ubicados);
end;
$$;

revoke execute on function public.importar_animales(uuid, jsonb, text, text) from public, anon;
grant execute on function public.importar_animales(uuid, jsonb, text, text) to authenticated;

create or replace function public.deshacer_importacion(p_importacion uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  c_claves constant text[] := array['nombre','raza_id','fecha_nacimiento','fecha_nacimiento_aprox','padre_id','madre_id','padre_externo','madre_externa',
    'chip','color','marcas','notas','peso_nacer_kg','valor_compra','fecha_compra','partos_previos','uso_macho','vocacion'];
  -- Lo que el propio cargue registra a cada animal que crea: se va con él si nadie lo tocó después.
  c_propias constant text[] := array['lactancias_animal_fk', 'movimientos_animal_fk', 'diagnosticos_hembra_fk', 'servicios_hembra_fk'];
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
  delete from public.animales where importacion_id = p_importacion;
  get diagnostics v_eliminados = row_count;

  update public.importaciones set estado = 'deshecha', deshecha_en = now(), deshecha_por = auth.uid() where id = p_importacion;

  return jsonb_build_object('eliminados', v_eliminados, 'revertidos', v_revertidos, 'conservados', v_conservados);
end;
$$;

revoke execute on function public.deshacer_importacion(uuid) from public, anon;
grant execute on function public.deshacer_importacion(uuid) to authenticated;
