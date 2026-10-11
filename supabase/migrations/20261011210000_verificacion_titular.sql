-- Garantía de que cada propietario recibe solo sus animales: el documento ya no basta (una cédula no es un secreto).
-- Para traer animales hay que probar además que se conoce uno de ellos (su microchip), y se acota el daño de un abuso:
-- intentos limitados por persona y por titular, y un tope de documentos distintos por cuenta.

alter table public.intentos_reclamo add column titular_id uuid references public.libro_titulares (id) on delete cascade;
create index intentos_reclamo_titular_idx on public.intentos_reclamo (titular_id, created_at desc) where titular_id is not null;

create function public.traer_animales_libro(p_finca uuid, p_documento text, p_chip text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_digitos text := private.normalizar_documento(p_documento);
  v_chip text := regexp_replace(upper(coalesce(p_chip, '')), '[^A-Z0-9]', '', 'g');
  v_titular uuid; v_verificado boolean := false; v_total int; v_intentos int; v_sol uuid; v_res jsonb;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = 'insufficient_privilege';
  end if;
  if not private.puede_gestionar(p_finca) then
    raise exception 'Solo el propietario o un administrador de la finca puede traer animales.' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_digitos) < 5 then
    raise exception 'Escribe el número de documento completo.' using errcode = 'check_violation';
  end if;
  if char_length(v_chip) < 4 then
    raise exception 'Escribe el microchip de uno de tus animales.' using errcode = 'check_violation';
  end if;

  select count(*) into v_intentos from public.intentos_reclamo
  where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_intentos >= 10 then
    raise exception 'Demasiados intentos. Espera un rato antes de volver a probar.' using errcode = 'P0001';
  end if;

  -- Los NIT a veces se registran con o sin dígito de verificación.
  select id into v_titular from public.libro_titulares
  where entidad = 'ANCO'
    and documento_hash in (
      private.hash_documento(v_digitos),
      case when char_length(v_digitos) = 10 then private.hash_documento(left(v_digitos, 9)) end)
  limit 1;

  if v_titular is not null then
    select count(*) into v_intentos from public.intentos_reclamo
    where titular_id = v_titular and not encontrado and created_at > now() - interval '1 hour';
    if v_intentos >= 30 then
      raise exception 'Demasiados intentos con este documento. Inténtalo más tarde.' using errcode = 'P0001';
    end if;
    -- El microchip tiene que ser de un animal registrado a nombre de ese mismo titular.
    select exists (
      select 1 from public.libro_genealogico l
      where l.titular_id = v_titular and regexp_replace(upper(l.chip), '[^A-Z0-9]', '', 'g') = v_chip
    ) into v_verificado;
  end if;

  insert into public.intentos_reclamo (user_id, encontrado, titular_id) values (v_uid, v_verificado, v_titular);
  -- Misma respuesta si falla el documento o el microchip: no se revela cuál de los dos estaba bien.
  if not v_verificado then
    return jsonb_build_object('encontrado', false);
  end if;

  -- Tope de documentos distintos por cuenta (una persona, su empresa, su familia): más allá lo resuelve soporte.
  if not exists (select 1 from public.solicitudes_reclamo where solicitante_id = v_uid and titular_id = v_titular)
     and (select count(distinct titular_id) from public.solicitudes_reclamo where solicitante_id = v_uid) >= 3 then
    raise exception 'Tu cuenta ya trajo animales de 3 documentos distintos. Para traer otro, escríbenos.' using errcode = 'P0001';
  end if;

  select count(*) into v_total
  from public.libro_genealogico l
  where l.titular_id = v_titular
    and not exists (select 1 from public.animales a where a.libro_id = l.id and a.deleted_at is null);
  if v_total = 0 then
    return jsonb_build_object('encontrado', true, 'importados', 0);
  end if;

  insert into public.solicitudes_reclamo (finca_id, titular_id, solicitante_id, estado, animales_disponibles, resuelta_por, resuelta_en)
  values (p_finca, v_titular, v_uid, 'aprobada', v_total, v_uid, now())
  returning id into v_sol;

  v_res := private.traer_titular_a_finca(p_finca, v_titular);
  update public.solicitudes_reclamo set animales_importados = (v_res ->> 'importados')::int where id = v_sol;
  return jsonb_build_object('encontrado', true) || v_res;
end;
$$;

revoke execute on function public.traer_animales_libro(uuid, text, text) from public, anon;
grant execute on function public.traer_animales_libro(uuid, text, text) to authenticated;

-- La versión anterior (solo documento) deja de poder usarse; se elimina con la migración de limpieza pendiente.
revoke execute on function public.traer_animales_libro(uuid, text) from public, anon, authenticated;
