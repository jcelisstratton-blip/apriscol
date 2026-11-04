-- Deshacer un cargue: el servicio que el propio cargue registró a una hembra usa como semental al macho del mismo cargue; esa llave también es «propia».
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
