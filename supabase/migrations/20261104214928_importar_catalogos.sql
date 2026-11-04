-- Cargue de catálogos y bodega desde Excel: corrales y potreros, medicamentos y vacunas (con su conteo de apertura por lote) y alimento (con su conteo de apertura en kg).
--  · `importacion_id` en `ubicaciones`, `productos_veterinarios`, `inventario_movimientos`, `finca_productos` e `inventario_alimento_movimientos`: marca lo que trajo cada cargue.
--  · `importar_catalogo(p_finca, p_tipo, p_filas, p_archivo)`: todo o nada. Un corral, un producto o un alimento que ya existe (por nombre) se reutiliza y NO se modifica; el conteo
--    de apertura de un lote que ya tiene apertura se deja como está (se cuenta como omitido). Los permisos son los de cada módulo (RLS aplica): corrales; sanidad e inventario;
--    contabilidad y nutrición con rol de gestión.
--  · `deshacer_importacion` entiende estos cargues: se niega si algo creado ya se usó (llaves foráneas) o se editó después. Para eso la función anterior pasa a
--    `private.deshacer_importacion_base` y la pública decide a cuál llamar.
--  · `finca_productos` no tenía política de borrado: se agrega SOLO para lo que trajo un cargue (`importacion_id` no nulo) y no es automático, y solo para propietario y administrador.

alter table public.importaciones drop constraint importaciones_tipo_check;
alter table public.importaciones add constraint importaciones_tipo_check
  check (tipo in ('animales', 'pesajes', 'ordenos', 'sanidad', 'corrales', 'medicamentos', 'alimento'));

alter table public.ubicaciones add column importacion_id uuid;
alter table public.ubicaciones add constraint ubicaciones_importacion_fk foreign key (importacion_id, finca_id)
  references public.importaciones (id, finca_id) on delete set null (importacion_id);
create index ubicaciones_importacion_idx on public.ubicaciones (importacion_id, finca_id) where importacion_id is not null;

alter table public.productos_veterinarios add column importacion_id uuid;
alter table public.productos_veterinarios add constraint productos_veterinarios_importacion_fk foreign key (importacion_id, finca_id)
  references public.importaciones (id, finca_id) on delete set null (importacion_id);
create index productos_veterinarios_importacion_idx on public.productos_veterinarios (importacion_id, finca_id) where importacion_id is not null;

alter table public.inventario_movimientos add column importacion_id uuid;
alter table public.inventario_movimientos add constraint inventario_movimientos_importacion_fk foreign key (importacion_id, finca_id)
  references public.importaciones (id, finca_id) on delete set null (importacion_id);
create index inventario_movimientos_importacion_idx on public.inventario_movimientos (importacion_id, finca_id) where importacion_id is not null;

alter table public.finca_productos add column importacion_id uuid;
alter table public.finca_productos add constraint finca_productos_importacion_fk foreign key (importacion_id, finca_id)
  references public.importaciones (id, finca_id) on delete set null (importacion_id);
create index finca_productos_importacion_idx on public.finca_productos (importacion_id, finca_id) where importacion_id is not null;

alter table public.inventario_alimento_movimientos add column importacion_id uuid;
alter table public.inventario_alimento_movimientos add constraint inventario_alimento_movimientos_importacion_fk foreign key (importacion_id, finca_id)
  references public.importaciones (id, finca_id) on delete set null (importacion_id);
create index inventario_alimento_movimientos_importacion_idx on public.inventario_alimento_movimientos (importacion_id, finca_id) where importacion_id is not null;

grant delete on public.finca_productos to authenticated;
create policy finca_productos_delete on public.finca_productos for delete to authenticated
  using ((select private.puede_gestionar(finca_id)) and importacion_id is not null and not automatico);

create or replace function public.importar_catalogo(p_finca uuid, p_tipo text, p_filas jsonb, p_archivo text default null)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  c_max constant integer := 2000;
  v_hoy constant date := (now() at time zone 'America/Bogota')::date;
  v_imp uuid;
  v_fila jsonb;
  v_i integer := 0;
  v_nfila text;
  v_prod uuid;
  v_rubro text;
  v_productos integer := 0;
  v_creados integer := 0;
  v_omitidos integer := 0;
  v_filas integer;
begin
  if p_tipo not in ('corrales', 'medicamentos', 'alimento') then
    raise exception 'El tipo de cargue no es válido.' using errcode = 'check_violation';
  end if;
  if p_tipo = 'corrales' and not private.puede_escribir(p_finca, 'corrales') then
    raise exception 'No tienes permiso para crear corrales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo = 'medicamentos' and not (private.puede_escribir(p_finca, 'sanidad') and private.puede_escribir(p_finca, 'inventario')) then
    raise exception 'No tienes permiso para cargar el inventario de medicamentos en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo = 'alimento' and not (private.puede_gestionar(p_finca) and private.puede_escribir(p_finca, 'nutricion') and private.puede_escribir(p_finca, 'contabilidad')) then
    raise exception 'Solo el propietario o un administrador puede cargar el inventario de alimento.' using errcode = 'insufficient_privilege';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no tiene registros para cargar.' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_filas) > c_max then
    raise exception 'Son demasiados registros a la vez (máximo %).', c_max using errcode = 'check_violation';
  end if;

  insert into public.importaciones (finca_id, tipo, archivo, modo) values (p_finca, p_tipo, left(nullif(btrim(p_archivo), ''), 200), 'nuevos') returning id into v_imp;

  for v_fila in select * from jsonb_array_elements(p_filas) loop
    v_i := v_i + 1;
    v_nfila := coalesce(nullif(v_fila ->> 'fila', ''), (v_i + 1)::text);
    begin
      if p_tipo = 'corrales' then
        if exists (select 1 from public.ubicaciones where finca_id = p_finca and lower(btrim(nombre)) = lower(btrim(v_fila ->> 'nombre'))) then
          v_omitidos := v_omitidos + 1;
        else
          insert into public.ubicaciones (finca_id, tipo, nombre, uso, capacidad, area_m2, piso, agua, dias_ocupacion_max, dias_descanso_min, observaciones, importacion_id)
          values (
            p_finca, coalesce(nullif(v_fila ->> 'tipo', ''), 'corral'), btrim(v_fila ->> 'nombre'), coalesce(nullif(v_fila ->> 'uso', ''), 'general'),
            nullif(v_fila ->> 'capacidad', '')::integer, nullif(v_fila ->> 'area_m2', '')::numeric, nullif(v_fila ->> 'piso', ''),
            coalesce((v_fila ->> 'agua')::boolean, true), coalesce(nullif(v_fila ->> 'dias_ocupacion_max', '')::smallint, 5),
            coalesce(nullif(v_fila ->> 'dias_descanso_min', '')::smallint, 35), nullif(btrim(v_fila ->> 'observaciones'), ''), v_imp);
          v_creados := v_creados + 1;
        end if;

      elsif p_tipo = 'medicamentos' then
        select id into v_prod from public.productos_veterinarios where finca_id = p_finca and lower(btrim(nombre)) = lower(btrim(v_fila ->> 'nombre'));
        if v_prod is null then
          insert into public.productos_veterinarios (finca_id, nombre, tipo, registro_ica, retiro_leche_dias, retiro_carne_dias, unidad_dosis, presentacion, contenido_presentacion, stock_minimo, importacion_id)
          values (
            p_finca, btrim(v_fila ->> 'nombre'), coalesce(nullif(v_fila ->> 'tipo', ''), 'otro'), nullif(btrim(v_fila ->> 'registro_ica'), ''),
            coalesce(nullif(v_fila ->> 'retiro_leche_dias', '')::smallint, 0), coalesce(nullif(v_fila ->> 'retiro_carne_dias', '')::smallint, 0),
            nullif(btrim(v_fila ->> 'unidad_dosis'), ''), nullif(btrim(v_fila ->> 'presentacion'), ''), nullif(v_fila ->> 'contenido_presentacion', '')::numeric,
            nullif(v_fila ->> 'stock_minimo', '')::numeric, v_imp)
          returning id into v_prod;
          v_productos := v_productos + 1;
        end if;
        insert into public.inventario_movimientos (finca_id, producto_vet_id, tipo, fecha, cantidad, lote, vencimiento, importacion_id)
        values (p_finca, v_prod, 'apertura', coalesce(nullif(v_fila ->> 'fecha', '')::date, v_hoy), (v_fila ->> 'cantidad')::numeric,
                nullif(btrim(v_fila ->> 'lote'), ''), nullif(v_fila ->> 'vencimiento', '')::date, v_imp)
        on conflict (finca_id, producto_vet_id, (coalesce(lote, ''))) where tipo = 'apertura' do nothing;
        get diagnostics v_filas = row_count;
        v_creados := v_creados + v_filas;
        v_omitidos := v_omitidos + (1 - v_filas);

      else
        select id, rubro into v_prod, v_rubro from public.finca_productos where finca_id = p_finca and tipo = 'compra' and lower(btrim(nombre)) = lower(btrim(v_fila ->> 'nombre'));
        if v_prod is not null and v_rubro not in ('concentrado', 'forraje', 'sales_suplementos', 'leche_maternizada') then
          raise exception 'ya existe un producto con ese nombre que no es un alimento.' using errcode = 'check_violation';
        end if;
        if v_prod is null then
          insert into public.finca_productos (finca_id, tipo, nombre, rubro, unidad, kg_por_unidad, importacion_id)
          values (p_finca, 'compra', btrim(v_fila ->> 'nombre'), v_fila ->> 'rubro', nullif(btrim(v_fila ->> 'unidad'), ''), nullif(v_fila ->> 'kg_por_unidad', '')::numeric, v_imp)
          returning id into v_prod;
          v_productos := v_productos + 1;
        end if;
        insert into public.inventario_alimento_movimientos (finca_id, producto_id, tipo, fecha, cantidad, importacion_id)
        values (p_finca, v_prod, 'apertura', coalesce(nullif(v_fila ->> 'fecha', '')::date, v_hoy), (v_fila ->> 'cantidad')::numeric, v_imp)
        on conflict (finca_id, producto_id) where tipo = 'apertura' do nothing;
        get diagnostics v_filas = row_count;
        v_creados := v_creados + v_filas;
        v_omitidos := v_omitidos + (1 - v_filas);
      end if;
    exception when others then
      raise exception 'Fila %, «%»: %', v_nfila, btrim(v_fila ->> 'nombre'), sqlerrm using errcode = sqlstate;
    end;
  end loop;

  update public.importaciones set creados = v_creados, omitidos = v_omitidos where id = v_imp;
  return jsonb_build_object('importacion', v_imp, 'productos', v_productos, 'creados', v_creados, 'omitidos', v_omitidos);
end;
$$;

revoke execute on function public.importar_catalogo(uuid, text, jsonb, text) from public, anon;
grant execute on function public.importar_catalogo(uuid, text, jsonb, text) to authenticated;

-- La función de deshacer que ya existía (animales, pesajes, ordeños y sanidad) pasa a `private` y la pública elige.
alter function public.deshacer_importacion(uuid) rename to deshacer_importacion_base;
alter function public.deshacer_importacion_base(uuid) set schema private;
revoke execute on function private.deshacer_importacion_base(uuid) from public, anon;
grant execute on function private.deshacer_importacion_base(uuid) to authenticated;

create or replace function private.deshacer_catalogo(p_importacion uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_imp public.importaciones;
  v_tabla text;
  v_movs text;
  v_ids uuid[];
  v_n bigint;
  v_en_uso text[] := '{}';
  r record;
  v_eliminados integer := 0;
  v_filas integer;
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

  v_tabla := case v_imp.tipo when 'corrales' then 'ubicaciones' when 'medicamentos' then 'productos_veterinarios' else 'finca_productos' end;
  v_movs := case v_imp.tipo when 'medicamentos' then 'inventario_movimientos' when 'alimento' then 'inventario_alimento_movimientos' else null end;

  -- Si algo de lo que trajo el cargue se editó después, ya no se puede deshacer completo.
  execute format('select count(*) from public.%I where importacion_id = $1 and updated_at > $2', v_tabla) using p_importacion, v_imp.created_at into v_n;
  if v_n > 0 then
    raise exception 'Ya se modificaron % registros de esta carga: ya no se puede deshacer completa.', v_n using errcode = 'check_violation';
  end if;
  if v_movs is not null then
    execute format('select count(*) from public.%I where importacion_id = $1 and updated_at > $2', v_movs) using p_importacion, v_imp.created_at into v_n;
    if v_n > 0 then
      raise exception 'Ya se modificaron % conteos de esta carga: ya no se puede deshacer completa.', v_n using errcode = 'check_violation';
    end if;
  end if;

  -- Todo lo que apunta a lo creado y que el cargue no trajo (se encuentra por las llaves foráneas: una tabla nueva queda protegida sola).
  execute format('select coalesce(array_agg(id), ''{}'') from public.%I where importacion_id = $1', v_tabla) using p_importacion into v_ids;
  if cardinality(v_ids) > 0 then
    for r in
      select c.conrelid::regclass::text as tabla, a.attname as col,
             exists (select 1 from pg_attribute x where x.attrelid = c.conrelid and x.attname = 'importacion_id' and not x.attisdropped) as marca
      from pg_constraint c
      join lateral (select c.conkey[array_position(c.confkey, (select attnum from pg_attribute where attrelid = c.confrelid and attname = 'id'))] as n) k on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n
      where c.contype = 'f' and c.confrelid = ('public.' || v_tabla)::regclass
    loop
      if r.marca then
        execute format('select count(*) from %s t where t.%I = any($1) and t.importacion_id is distinct from $2', r.tabla, r.col) using v_ids, p_importacion into v_n;
      else
        execute format('select count(*) from %s t where t.%I = any($1)', r.tabla, r.col) using v_ids into v_n;
      end if;
      if v_n > 0 then v_en_uso := v_en_uso || r.tabla; end if;
    end loop;
    if cardinality(v_en_uso) > 0 then
      raise exception 'Algo de lo que trajo esta carga ya se usó (animales, compras, aplicaciones…): ya no se puede deshacer completa.'
        using errcode = 'check_violation', detail = array_to_string(v_en_uso, ', ');
    end if;
  end if;

  -- Primero los conteos (apuntan al producto) y luego lo que se creó.
  if v_movs is not null then
    execute format('delete from public.%I where importacion_id = $1', v_movs) using p_importacion;
    get diagnostics v_filas = row_count;
    v_eliminados := v_eliminados + v_filas;
  end if;
  execute format('delete from public.%I where importacion_id = $1', v_tabla) using p_importacion;
  get diagnostics v_filas = row_count;
  v_eliminados := v_eliminados + v_filas;

  update public.importaciones set estado = 'deshecha', deshecha_en = now(), deshecha_por = auth.uid() where id = p_importacion;
  return jsonb_build_object('eliminados', v_eliminados, 'revertidos', 0, 'conservados', 0);
end;
$$;

revoke execute on function private.deshacer_catalogo(uuid) from public, anon;
grant execute on function private.deshacer_catalogo(uuid) to authenticated;

create or replace function public.deshacer_importacion(p_importacion uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_tipo text;
begin
  select tipo into v_tipo from public.importaciones where id = p_importacion;
  if v_tipo in ('corrales', 'medicamentos', 'alimento') then
    return private.deshacer_catalogo(p_importacion);
  end if;
  return private.deshacer_importacion_base(p_importacion);
end;
$$;

revoke execute on function public.deshacer_importacion(uuid) from public, anon;
grant execute on function public.deshacer_importacion(uuid) to authenticated;
