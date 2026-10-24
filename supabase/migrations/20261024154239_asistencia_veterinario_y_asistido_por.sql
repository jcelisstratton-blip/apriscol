-- Asistencia en procedimientos: quién asistió (el veterinario de la finca u otra persona) y alta rápida de un veterinario. Solo agrega y reemplaza funciones:
-- retrocompatible (lo que ya está desplegado sigue funcionando mientras Vercel termina).
--  · `personal.es_veterinario`: marca a quien se ofrece como veterinario de la finca, tenga o no acceso a la app (un veterinario externo no entra a la app).
--    Se rellena con quienes ya tienen el perfil «veterinario».
--  · `partos.asistido_por`: quién asistió el parto (asistido, cesárea o aborto; el parto normal no lo lleva). Reemplaza a `responsable_quirurgico`, que queda sin
--    uso hasta que el propietario la retire en una migración aparte (se copian sus datos aquí).
--  · `registrar_parto` escribe `asistido_por` (acepta también la clave anterior); `registrar_persona` guarda `es_veterinario`; `veterinarios_finca` lista por
--    esa marca; `agregar_veterinario` crea al veterinario desde el formulario del procedimiento (solo quien gestiona la finca y tiene personal en su plan).

alter table public.personal add column es_veterinario boolean not null default false;
update public.personal set es_veterinario = true where rol = 'veterinario';

alter table public.partos add column asistido_por text check (asistido_por is null or char_length(btrim(asistido_por)) between 1 and 120);
update public.partos set asistido_por = responsable_quirurgico where responsable_quirurgico is not null and asistido_por is null;

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
                               asistido_por, protocolo_posoperatorio, client_request_id)
    values (p_finca, v_madre, nullif(p_parto ->> 'servicio_id', '')::uuid, v_fecha, p_parto ->> 'tipo',
            jsonb_array_length(p_crias), nullif(btrim(p_parto ->> 'complicaciones'), ''), nullif(btrim(p_parto ->> 'observaciones'), ''),
            nullif(p_parto ->> 'causa_aborto', ''), nullif(btrim(coalesce(p_parto ->> 'asistido_por', p_parto ->> 'responsable_quirurgico')), ''),
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

create or replace function public.registrar_persona(p_finca uuid, p_persona jsonb, p_email text default null, p_rol text default null)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_persona uuid;
  v_token uuid;
  v_correo text := nullif(btrim(p_email), '');
begin
  if not (private.puede_gestionar(p_finca) and private.puede_escribir(p_finca, 'contabilidad')) then
    raise exception 'Solo el propietario o un administrador puede agregar personas.' using errcode = 'insufficient_privilege';
  end if;
  if v_correo is not null and nullif(p_rol, '') is null then
    raise exception 'Elige el perfil de la persona.' using errcode = 'check_violation';
  end if;
  insert into public.personal (
    finca_id, nombre, cargo, vinculacion, forma_pago, valor_base, fecha_ingreso, correo, rol,
    telefono, experiencia_anios, formacion, tarjeta_profesional, tipo_contador, especialidades, acreditaciones,
    turno_ordeno, tipo_ordeno, curso_manipulacion, curso_manipulacion_vence, labor_principal, es_veterinario
  ) values (
    p_finca, btrim(p_persona ->> 'nombre'), nullif(btrim(p_persona ->> 'cargo'), ''), p_persona ->> 'vinculacion',
    p_persona ->> 'forma_pago', (p_persona ->> 'valor_base')::numeric, nullif(p_persona ->> 'fecha_ingreso', '')::date,
    v_correo, case when v_correo is not null then p_rol::public.rol_finca end,
    nullif(btrim(p_persona ->> 'telefono'), ''), nullif(p_persona ->> 'experiencia_anios', '')::smallint, nullif(p_persona ->> 'formacion', ''),
    nullif(btrim(p_persona ->> 'tarjeta_profesional'), ''), nullif(p_persona ->> 'tipo_contador', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_persona -> 'especialidades', '[]'::jsonb))), '{}'::text[]),
    nullif(btrim(p_persona ->> 'acreditaciones'), ''),
    nullif(p_persona ->> 'turno_ordeno', ''), nullif(p_persona ->> 'tipo_ordeno', ''), nullif(p_persona ->> 'curso_manipulacion', '')::boolean,
    nullif(p_persona ->> 'curso_manipulacion_vence', '')::date, nullif(p_persona ->> 'labor_principal', ''),
    coalesce((p_persona ->> 'es_veterinario')::boolean, false) or p_rol = 'veterinario'
  ) returning id into v_persona;
  if v_correo is not null then
    insert into public.invitaciones (finca_id, email, rol) values (p_finca, v_correo, p_rol::public.rol_finca) returning token into v_token;
  end if;
  return jsonb_build_object('persona_id', v_persona, 'token', v_token);
end;
$$;
revoke execute on function public.registrar_persona(uuid, jsonb, text, text) from public, anon;
grant execute on function public.registrar_persona(uuid, jsonb, text, text) to authenticated;

create or replace function public.veterinarios_finca(p_finca uuid)
returns table (id uuid, nombre text, tarjeta_profesional text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (private.puede_ver(p_finca, 'reproduccion') or private.puede_ver(p_finca, 'sanidad')) then
    raise exception 'No tienes permiso para ver esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select p.id, p.nombre, p.tarjeta_profesional
    from public.personal p
    where p.finca_id = p_finca and p.activo and p.es_veterinario
    order by lower(p.nombre);
end;
$$;
revoke execute on function public.veterinarios_finca(uuid) from public, anon;
grant execute on function public.veterinarios_finca(uuid) to authenticated;

-- Alta rápida: el veterinario queda en el equipo como prestación de servicios, sin valor definido (se ajusta después en Equipo) y sin acceso a la app.
create or replace function public.agregar_veterinario(p_finca uuid, p_nombre text, p_tarjeta text, p_telefono text)
returns table (id uuid, nombre text, tarjeta_profesional text)
language plpgsql set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (private.puede_gestionar(p_finca) and private.puede_escribir(p_finca, 'contabilidad')) then
    raise exception 'Solo el propietario o un administrador puede agregar personas al equipo.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.personal (finca_id, nombre, cargo, vinculacion, forma_pago, valor_base, es_veterinario, tarjeta_profesional, telefono)
  values (p_finca, btrim(p_nombre), 'Veterinario', 'servicios', 'por_servicio', 0, true, nullif(btrim(p_tarjeta), ''), nullif(btrim(p_telefono), ''))
  returning personal.id into v_id;
  return query select p.id, p.nombre, p.tarjeta_profesional from public.personal p where p.id = v_id;
end;
$$;
revoke execute on function public.agregar_veterinario(uuid, text, text, text) from public, anon;
grant execute on function public.agregar_veterinario(uuid, text, text, text) to authenticated;
