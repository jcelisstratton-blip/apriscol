-- Archivos de más de 500 animales: el cargue se hace por tramos de 500 (cada uno es una transacción de unos 3 s) y todos los tramos de un archivo comparten un `grupo`.
--  · `importaciones.grupo`: une los tramos de un mismo archivo.
--  · `importar_animales(…, p_grupo)`: igual que antes (la versión de 4 argumentos se reemplaza por esta, que la contiene con el grupo opcional).
--  · `deshacer_grupo(p_grupo)`: deshace todos los tramos del archivo, del último al primero (una cría de un tramo puede tener a su padre en uno anterior), en una sola transacción:
--    si alguno ya no se puede deshacer, no se deshace ninguno.

alter table public.importaciones add column grupo uuid;
create index importaciones_grupo_idx on public.importaciones (grupo) where grupo is not null;

drop function public.importar_animales(uuid, jsonb, text, text);

create or replace function public.importar_animales(p_finca uuid, p_filas jsonb, p_modo text default 'nuevos', p_archivo text default null, p_grupo uuid default null)
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

  insert into public.importaciones (finca_id, archivo, modo, grupo) values (p_finca, left(nullif(btrim(p_archivo), ''), 200), p_modo, p_grupo) returning id into v_imp;

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

revoke execute on function public.importar_animales(uuid, jsonb, text, text, uuid) from public, anon;
grant execute on function public.importar_animales(uuid, jsonb, text, text, uuid) to authenticated;

create or replace function public.deshacer_grupo(p_grupo uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  r record;
  v jsonb;
  v_eliminados integer := 0;
  v_revertidos integer := 0;
  v_conservados integer := 0;
begin
  if not exists (select 1 from public.importaciones where grupo = p_grupo) then
    raise exception 'Esa carga no existe.' using errcode = 'no_data_found';
  end if;
  for r in select id from public.importaciones where grupo = p_grupo and estado = 'aplicada' order by created_at desc, id loop
    v := public.deshacer_importacion(r.id);
    v_eliminados := v_eliminados + (v ->> 'eliminados')::integer;
    v_revertidos := v_revertidos + (v ->> 'revertidos')::integer;
    v_conservados := v_conservados + (v ->> 'conservados')::integer;
  end loop;
  return jsonb_build_object('eliminados', v_eliminados, 'revertidos', v_revertidos, 'conservados', v_conservados);
end;
$$;

revoke execute on function public.deshacer_grupo(uuid) from public, anon;
grant execute on function public.deshacer_grupo(uuid) to authenticated;
