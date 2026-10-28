-- Dar acceso a una persona que ya está en el equipo (o volver a darlo) y renovar invitaciones vencidas.
-- Hasta hoy la invitación solo se creaba junto con la persona (`registrar_persona`): al cancelarla o vencerse, la persona quedaba sin forma de
-- volver a invitarse, y una invitación vencida seguía ocupando su correo (índice único de pendientes) aunque la lista ya no la mostrara.
-- Son SECURITY DEFINER porque `invitaciones` no tiene política de UPDATE: validan dentro quién llama (propietario o administrador).

create or replace function public.invitar_persona(p_finca uuid, p_persona uuid, p_email text, p_rol text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_correo text := lower(nullif(btrim(p_email), ''));
  v_token uuid;
begin
  if not (private.puede_gestionar(p_finca) and private.puede_escribir(p_finca, 'contabilidad')) then
    raise exception 'Solo el propietario o un administrador puede dar acceso a una persona.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.personal where id = p_persona and finca_id = p_finca) then
    raise exception 'No encontramos a esa persona.' using errcode = 'P0002';
  end if;
  if v_correo is null or v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Escribe un correo válido.' using errcode = 'check_violation';
  end if;
  if p_rol is null or p_rol not in ('administrador', 'ordenador', 'veterinario', 'contador') then
    raise exception 'Elige el perfil de la persona.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.finca_miembros m join auth.users u on u.id = m.user_id where m.finca_id = p_finca and lower(u.email) = v_correo) then
    raise exception 'Esa persona ya tiene acceso a esta finca con ese correo.' using errcode = 'unique_violation';
  end if;

  -- Una invitación pendiente (aunque esté vencida) para ese correo se renueva en vez de chocar con el índice único.
  update public.invitaciones
     set expira_en = now() + interval '7 days', rol = p_rol::public.rol_finca, invitado_por = (select auth.uid())
   where finca_id = p_finca and email = v_correo and aceptada_en is null
  returning token into v_token;
  if v_token is null then
    insert into public.invitaciones (finca_id, email, rol, invitado_por)
    values (p_finca, v_correo, p_rol::public.rol_finca, (select auth.uid()))
    returning token into v_token;
  end if;

  update public.personal
     set correo = v_correo, rol = p_rol::public.rol_finca, es_veterinario = es_veterinario or p_rol = 'veterinario'
   where id = p_persona and finca_id = p_finca;
  return v_token;
end;
$$;

create or replace function public.renovar_invitacion(p_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_finca uuid;
  v_token uuid;
begin
  select finca_id into v_finca from public.invitaciones where id = p_id and aceptada_en is null;
  if v_finca is null then
    raise exception 'La invitación ya no existe o ya se aceptó.' using errcode = 'P0002';
  end if;
  if not private.puede_gestionar(v_finca) then
    raise exception 'Solo el propietario o un administrador puede renovar invitaciones.' using errcode = 'insufficient_privilege';
  end if;
  update public.invitaciones set expira_en = now() + interval '7 days' where id = p_id returning token into v_token;
  return v_token;
end;
$$;

revoke execute on function public.invitar_persona(uuid, uuid, text, text) from public, anon;
revoke execute on function public.renovar_invitacion(uuid) from public, anon;
grant execute on function public.invitar_persona(uuid, uuid, text, text) to authenticated;
grant execute on function public.renovar_invitacion(uuid) to authenticated;
