-- Aplicada desde el editor SQL de Supabase (la herramienta de migraciones pide confirmación por la sentencia de borrado)
-- y registrada con esta versión en supabase_migrations.schema_migrations.

-- Guardar un evento sanitario con sus animales, de forma atómica (crear o corregir).
-- SECURITY DEFINER a propósito: al corregir un evento hay que reemplazar su lista de animales, y borrar filas
-- hijas exige ser propietario/administrador por RLS, aunque un veterinario sí puede editar sanidad.
-- Se valida dentro quién llama; las llaves compuestas (animal, finca) impiden mezclar fincas.
create function public.guardar_evento_sanitario(p_finca uuid, p_evento uuid, p_datos jsonb, p_animales uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.puede_escribir(p_finca, 'sanidad') then
    raise exception 'No tienes permiso para registrar sanidad en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_animales is null or cardinality(p_animales) = 0 then
    raise exception 'Elige al menos un animal.' using errcode = 'check_violation';
  end if;
  if cardinality(p_animales) > 1000 then
    raise exception 'Son demasiados animales a la vez (máximo 1000).' using errcode = 'check_violation';
  end if;

  if p_evento is null then
    insert into public.eventos_sanitarios (
      finca_id, fecha, tipo, producto_id, producto_nombre, lote_producto, fecha_vencimiento, dosis, unidad_dosis, via,
      responsable, costo, retiro_leche_dias, retiro_carne_dias, diagnostico, observaciones, proxima_fecha, client_request_id
    ) values (
      p_finca, (p_datos ->> 'fecha')::date, p_datos ->> 'tipo', nullif(p_datos ->> 'producto_id', '')::uuid,
      nullif(p_datos ->> 'producto_nombre', ''), nullif(p_datos ->> 'lote_producto', ''), nullif(p_datos ->> 'fecha_vencimiento', '')::date,
      nullif(p_datos ->> 'dosis', '')::numeric, nullif(p_datos ->> 'unidad_dosis', ''), nullif(p_datos ->> 'via', ''),
      nullif(p_datos ->> 'responsable', ''), nullif(p_datos ->> 'costo', '')::numeric,
      coalesce(nullif(p_datos ->> 'retiro_leche_dias', '')::smallint, 0), coalesce(nullif(p_datos ->> 'retiro_carne_dias', '')::smallint, 0),
      nullif(p_datos ->> 'diagnostico', ''), nullif(p_datos ->> 'observaciones', ''), nullif(p_datos ->> 'proxima_fecha', '')::date,
      nullif(p_datos ->> 'client_request_id', '')::uuid
    ) returning id into v_id;
  else
    update public.eventos_sanitarios set
      fecha = (p_datos ->> 'fecha')::date,
      tipo = p_datos ->> 'tipo',
      producto_id = nullif(p_datos ->> 'producto_id', '')::uuid,
      producto_nombre = nullif(p_datos ->> 'producto_nombre', ''),
      lote_producto = nullif(p_datos ->> 'lote_producto', ''),
      fecha_vencimiento = nullif(p_datos ->> 'fecha_vencimiento', '')::date,
      dosis = nullif(p_datos ->> 'dosis', '')::numeric,
      unidad_dosis = nullif(p_datos ->> 'unidad_dosis', ''),
      via = nullif(p_datos ->> 'via', ''),
      responsable = nullif(p_datos ->> 'responsable', ''),
      costo = nullif(p_datos ->> 'costo', '')::numeric,
      retiro_leche_dias = coalesce(nullif(p_datos ->> 'retiro_leche_dias', '')::smallint, 0),
      retiro_carne_dias = coalesce(nullif(p_datos ->> 'retiro_carne_dias', '')::smallint, 0),
      diagnostico = nullif(p_datos ->> 'diagnostico', ''),
      observaciones = nullif(p_datos ->> 'observaciones', ''),
      proxima_fecha = nullif(p_datos ->> 'proxima_fecha', '')::date
    where id = p_evento and finca_id = p_finca
    returning id into v_id;
    if v_id is null then
      raise exception 'No encontramos ese registro.' using errcode = 'no_data_found';
    end if;
    delete from public.evento_sanitario_animales where evento_id = v_id and finca_id = p_finca;
  end if;

  insert into public.evento_sanitario_animales (evento_id, animal_id, finca_id)
  select v_id, a, p_finca from (select distinct unnest(p_animales) as a) t;
  return v_id;
end;
$$;
revoke execute on function public.guardar_evento_sanitario(uuid, uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.guardar_evento_sanitario(uuid, uuid, jsonb, uuid[]) to authenticated;
