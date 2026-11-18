-- Registrar un animal guarda también la cobertura (lana o pelo) de una oveja, si la persona la definió en el formulario.
-- Retrocompatible: lo que no trae «cobertura» se guarda como antes (vacía = la de su raza). Solo cambia una columna en el INSERT; el resto es igual.
create or replace function public.registrar_animal(p_finca uuid, p_animal jsonb, p_fecha_ultimo_parto date default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_solicitud uuid := nullif(p_animal ->> 'client_request_id', '')::uuid;
begin
  if not private.puede_escribir(p_finca, 'hato') then
    raise exception 'No tienes permiso para registrar animales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if v_solicitud is not null then
    select id into v_id from public.animales where finca_id = p_finca and client_request_id = v_solicitud;
    if v_id is not null then return v_id; end if;
  end if;
  begin
    insert into public.animales (
      finca_id, especie, numero_arete, nombre, sexo, raza_id, fecha_nacimiento, fecha_nacimiento_aprox,
      padre_id, madre_id, padre_externo, madre_externa, origen, vocacion, uso_macho,
      chip, color, marcas, rasgos, notas, peso_nacer_kg, valor_compra, fecha_compra, foto_path, client_request_id, cobertura
    ) values (
      p_finca,
      (p_animal ->> 'especie')::public.especie,
      btrim(p_animal ->> 'numero_arete'),
      nullif(btrim(p_animal ->> 'nombre'), ''),
      (p_animal ->> 'sexo')::public.sexo_animal,
      nullif(p_animal ->> 'raza_id', '')::smallint,
      nullif(p_animal ->> 'fecha_nacimiento', '')::date,
      coalesce((p_animal ->> 'fecha_nacimiento_aprox')::boolean, false),
      nullif(p_animal ->> 'padre_id', '')::uuid,
      nullif(p_animal ->> 'madre_id', '')::uuid,
      nullif(btrim(p_animal ->> 'padre_externo'), ''),
      nullif(btrim(p_animal ->> 'madre_externa'), ''),
      coalesce(nullif(p_animal ->> 'origen', ''), 'nacido_en_finca'),
      coalesce(nullif(p_animal ->> 'vocacion', ''), 'leche')::public.vocacion_animal,
      nullif(p_animal ->> 'uso_macho', ''),
      nullif(btrim(p_animal ->> 'chip'), ''),
      nullif(btrim(p_animal ->> 'color'), ''),
      nullif(btrim(p_animal ->> 'marcas'), ''),
      nullif(btrim(p_animal ->> 'rasgos'), ''),
      nullif(btrim(p_animal ->> 'notas'), ''),
      nullif(p_animal ->> 'peso_nacer_kg', '')::numeric,
      nullif(p_animal ->> 'valor_compra', '')::numeric,
      nullif(p_animal ->> 'fecha_compra', '')::date,
      nullif(p_animal ->> 'foto_path', ''),
      v_solicitud,
      case when (p_animal ->> 'especie') = 'ovino' then nullif(p_animal ->> 'cobertura', '') end
    ) returning id into v_id;

    if p_fecha_ultimo_parto is not null then
      insert into public.lactancias (finca_id, animal_id, numero, fecha_parto) values (p_finca, v_id, 1, p_fecha_ultimo_parto);
    end if;
  exception when unique_violation then
    if v_solicitud is not null and sqlerrm like '%client_req%' then
      select id into v_id from public.animales where finca_id = p_finca and client_request_id = v_solicitud;
      if v_id is not null then return v_id; end if;
    end if;
    raise;
  end;
  return v_id;
end;
$$;
