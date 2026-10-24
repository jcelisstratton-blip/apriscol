-- Partos: datos propios de cada tipo de evento (normal, asistido, cesárea, aborto). Solo agrega columnas y amplía `registrar_parto`: retrocompatible.
--  · Todos: `observaciones` (clínicas) y `complicaciones` (en una cesárea son las quirúrgicas).
--  · Cesárea: `responsable_quirurgico` (médico veterinario que operó) y `protocolo_posoperatorio` (protocolo y fármacos administrados).
--  · Aborto: `causa_aborto` (causa aparente, para el control epidemiológico); no lleva crías ni pesos.

alter table public.partos
  add column observaciones text,
  add column causa_aborto text check (causa_aborto in ('infecciosa', 'nutricional', 'traumatica', 'toxica', 'desconocida')),
  add column responsable_quirurgico text,
  add column protocolo_posoperatorio text;

-- p_parto: madre_id, servicio_id, fecha, tipo, complicaciones, observaciones, causa_aborto, responsable_quirurgico, protocolo_posoperatorio,
-- client_request_id, padre_id, padre_externo (del servicio). Lo demás igual que en 20261021151119.
create or replace function public.registrar_parto(p_finca uuid, p_parto jsonb, p_crias jsonb)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_madre uuid := (p_parto ->> 'madre_id')::uuid;
  v_fecha date := (p_parto ->> 'fecha')::date;
  v_solicitud uuid := nullif(p_parto ->> 'client_request_id', '')::uuid;
  v_especie public.especie;
  v_vocacion public.vocacion_animal;
  v_puede_hato boolean;
  v_parto uuid;
  v_cria jsonb;
  v_arete text;
  v_sexo text;
  v_animal uuid;
  v_sin text[] := '{}';
begin
  if not private.puede_escribir(p_finca, 'reproduccion') then
    raise exception 'No tienes permiso para registrar partos en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_crias is null or jsonb_typeof(p_crias) <> 'array' then
    raise exception 'No se entendieron los datos de las crías.' using errcode = 'check_violation';
  end if;
  select especie, vocacion into v_especie, v_vocacion from public.animales where id = v_madre and finca_id = p_finca and deleted_at is null;
  if not found then
    raise exception 'No encontramos a la hembra en tu finca.' using errcode = 'no_data_found';
  end if;
  v_puede_hato := private.puede_escribir(p_finca, 'hato');

  if v_solicitud is not null then
    select id into v_parto from public.partos where finca_id = p_finca and client_request_id = v_solicitud;
    if v_parto is not null then
      return jsonb_build_object('parto_id', v_parto, 'repetido', true, 'sin_crear', '[]'::jsonb);
    end if;
  end if;
  begin
    insert into public.partos (finca_id, madre_id, servicio_id, fecha, tipo, numero_crias, complicaciones, observaciones, causa_aborto,
                               responsable_quirurgico, protocolo_posoperatorio, client_request_id)
    values (p_finca, v_madre, nullif(p_parto ->> 'servicio_id', '')::uuid, v_fecha, p_parto ->> 'tipo',
            jsonb_array_length(p_crias), nullif(btrim(p_parto ->> 'complicaciones'), ''), nullif(btrim(p_parto ->> 'observaciones'), ''),
            nullif(p_parto ->> 'causa_aborto', ''), nullif(btrim(p_parto ->> 'responsable_quirurgico'), ''),
            nullif(btrim(p_parto ->> 'protocolo_posoperatorio'), ''), v_solicitud)
    returning id into v_parto;
  exception when unique_violation then
    -- Doble toque: este parto ya se guardó con sus crías; no se repite.
    if v_solicitud is not null and sqlerrm like '%client_req%' then
      select id into v_parto from public.partos where finca_id = p_finca and client_request_id = v_solicitud;
      if v_parto is not null then
        return jsonb_build_object('parto_id', v_parto, 'repetido', true, 'sin_crear', '[]'::jsonb);
      end if;
    end if;
    raise;
  end;

  for v_cria in select * from jsonb_array_elements(p_crias) loop
    v_animal := null;
    v_arete := nullif(btrim(v_cria ->> 'arete'), '');
    v_sexo := nullif(v_cria ->> 'sexo', '');
    if v_arete is not null then
      if v_puede_hato then
        begin
          insert into public.animales (
            finca_id, especie, numero_arete, nombre, sexo, origen, fecha_nacimiento, fecha_nacimiento_aprox,
            madre_id, padre_id, padre_externo, vocacion, peso_nacer_kg
          ) values (
            p_finca, v_especie, v_arete, nullif(btrim(v_cria ->> 'nombre'), ''), v_sexo::public.sexo_animal,
            'nacido_en_finca', v_fecha, false,
            v_madre, nullif(p_parto ->> 'padre_id', '')::uuid, nullif(btrim(p_parto ->> 'padre_externo'), ''),
            case when v_sexo = 'macho' then 'carne'::public.vocacion_animal else v_vocacion end,
            nullif(v_cria ->> 'peso', '')::numeric
          ) returning id into v_animal;
        exception when unique_violation then
          raise exception 'El arete % ya está en tu hato. Usa otro para la cría.', v_arete using errcode = 'unique_violation';
        end;
      else
        v_sin := v_sin || v_arete;
      end if;
    end if;
    insert into public.crias (finca_id, parto_id, animal_id, sexo, peso_nacer_kg, vivo)
    values (p_finca, v_parto, v_animal, v_sexo::public.sexo_animal, nullif(v_cria ->> 'peso', '')::numeric,
            coalesce((v_cria ->> 'vivo')::boolean, true));
  end loop;

  return jsonb_build_object('parto_id', v_parto, 'repetido', false, 'sin_crear', to_jsonb(v_sin));
end;
$$;
revoke execute on function public.registrar_parto(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_parto(uuid, jsonb, jsonb) to authenticated;
