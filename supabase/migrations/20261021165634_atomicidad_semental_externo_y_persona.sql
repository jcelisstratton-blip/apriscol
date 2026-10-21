-- Atomicidad (segunda entrega, parte A): agregar un semental de otro hato a una temporada y registrar a una persona con su
-- invitación son UNA sola transacción. Corren con los permisos de quien llama (RLS aplica) y comprueban el permiso además.

-- ───────── 3. Agregar un semental de otro hato a una temporada abierta ─────────
-- p_externo: chip, nombre, hato, propietario, telefono, razaId, nacimiento, desde, hasta, sanidad, condiciones (ya validados por la app).
create or replace function public.agregar_semental_externo(p_finca uuid, p_lote uuid, p_externo jsonb, p_num_hembras integer)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_especie public.especie;
  v_cerrado date;
  v_id uuid;
begin
  if not private.puede_escribir(p_finca, 'reproduccion') then
    raise exception 'No tienes permiso para agregar sementales en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  select especie, cerrado_en into v_especie, v_cerrado from public.empadronamientos where id = p_lote and finca_id = p_finca;
  if not found then
    raise exception 'No encontramos ese empadronamiento.' using errcode = 'no_data_found';
  end if;
  if v_cerrado is not null then
    raise exception 'Este empadronamiento ya está cerrado: es parte de la historia y no se cambia.' using errcode = 'restrict_violation';
  end if;
  insert into public.sementales_externos (
    finca_id, especie, chip, nombre, hato_origen, propietario, telefono, raza_id, fecha_nacimiento,
    prestamo_desde, prestamo_hasta, sanidad, condiciones
  ) values (
    p_finca, v_especie, btrim(p_externo ->> 'chip'), btrim(p_externo ->> 'nombre'), btrim(p_externo ->> 'hato'),
    nullif(btrim(p_externo ->> 'propietario'), ''), nullif(btrim(p_externo ->> 'telefono'), ''),
    (p_externo ->> 'razaId')::smallint, nullif(p_externo ->> 'nacimiento', '')::date,
    (p_externo ->> 'desde')::date, (p_externo ->> 'hasta')::date,
    nullif(btrim(p_externo ->> 'sanidad'), ''), nullif(btrim(p_externo ->> 'condiciones'), '')
  ) returning id into v_id;
  insert into public.empadronamiento_machos (finca_id, empadronamiento_id, macho_id, num_hembras, externo)
  values (p_finca, p_lote, v_id, p_num_hembras, true);
  return v_id;
end;
$$;
revoke execute on function public.agregar_semental_externo(uuid, uuid, jsonb, integer) from public, anon;
grant execute on function public.agregar_semental_externo(uuid, uuid, jsonb, integer) to authenticated;

-- ───────── 5. Registrar a una persona (Equipo) y, si va a tener acceso, su invitación ─────────
-- p_persona: nombre, cargo, vinculacion, forma_pago, valor_base, fecha_ingreso. Con p_email y p_rol se crea también la invitación
-- (y la persona guarda el correo y el rol). Devuelve {persona_id, token} (token nulo si no hay invitación).
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
  insert into public.personal (finca_id, nombre, cargo, vinculacion, forma_pago, valor_base, fecha_ingreso, correo, rol)
  values (
    p_finca, btrim(p_persona ->> 'nombre'), nullif(btrim(p_persona ->> 'cargo'), ''), p_persona ->> 'vinculacion',
    p_persona ->> 'forma_pago', (p_persona ->> 'valor_base')::numeric, nullif(p_persona ->> 'fecha_ingreso', '')::date,
    v_correo, case when v_correo is not null then p_rol::public.rol_finca end
  ) returning id into v_persona;
  if v_correo is not null then
    insert into public.invitaciones (finca_id, email, rol) values (p_finca, v_correo, p_rol::public.rol_finca) returning token into v_token;
  end if;
  return jsonb_build_object('persona_id', v_persona, 'token', v_token);
end;
$$;
revoke execute on function public.registrar_persona(uuid, jsonb, text, text) from public, anon;
grant execute on function public.registrar_persona(uuid, jsonb, text, text) to authenticated;
