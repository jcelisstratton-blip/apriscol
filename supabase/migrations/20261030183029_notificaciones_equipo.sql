-- Avisos por Telegram: el propietario y el administrador de cada finca fijan los de su equipo.
-- Retrocompatible: solo agrega funciones. Las del superadministrador (admin_notificaciones, admin_guardar_notificaciones) siguen igual.
-- Quién cambia qué: propietario y administrador cambian si recibe el resumen, la hora, los días y el nivel. El máximo diario, las alertas,
-- el resumen semanal y el silencio los sigue fijando el superadministrador (esta función no los toca).

create function private.gestiona_avisos(p_finca uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.es_admin_plataforma() or coalesce(private.rol_en(p_finca) in ('propietario', 'administrador'), false);
$$;

-- El equipo de la finca con su conexión y sus avisos, para quien la gestiona.
create function public.equipo_notificaciones(p_finca uuid)
returns table (user_id uuid, nombre text, email text, rol text, vinculo text, vinculado_en timestamptz, activo boolean, resumen boolean, resumen_hora time, dias smallint[], nivel_minimo text, alertas boolean, semanal boolean, silencio_desde time, silencio_hasta time, max_diarios smallint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.gestiona_avisos(p_finca) then
    raise exception 'Solo el propietario o el administrador pueden ver los avisos del equipo.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select m.user_id, pf.nombre, u.email::text, m.rol::text, coalesce(v.estado, 'pendiente'), v.vinculado_en,
           coalesce(p.activo, false), coalesce(p.resumen, true), coalesce(p.resumen_hora, time '06:30'), coalesce(p.dias, array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
           coalesce(p.nivel_minimo, 'ambar'), coalesce(p.alertas, true), coalesce(p.semanal, false), coalesce(p.silencio_desde, time '20:00'), coalesce(p.silencio_hasta, time '05:00'), coalesce(p.max_diarios, 8::smallint)
      from public.finca_miembros m
      join auth.users u on u.id = m.user_id
      left join public.perfiles pf on pf.id = m.user_id
      left join public.telegram_vinculos v on v.finca_id = m.finca_id and v.user_id = m.user_id
      left join public.notificacion_preferencias p on p.finca_id = m.finca_id and p.user_id = m.user_id
     where m.finca_id = p_finca
     order by pf.nombre nulls last, u.email;
end
$$;

-- Fija lo que recibe una persona de la finca. Un administrador no cambia los avisos del propietario.
create function public.guardar_notificaciones_equipo(p_finca uuid, p_user uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_rol public.rol_finca;
  v_dias smallint[];
begin
  if not private.gestiona_avisos(p_finca) then
    raise exception 'Solo el propietario o el administrador pueden cambiar los avisos del equipo.' using errcode = 'insufficient_privilege';
  end if;
  select m.rol into v_rol from public.finca_miembros m where m.finca_id = p_finca and m.user_id = p_user;
  if v_rol is null then
    raise exception 'Esa persona no pertenece a la finca.';
  end if;
  if v_rol = 'propietario' and not (private.es_admin_plataforma() or private.rol_en(p_finca) = 'propietario') then
    raise exception 'Los avisos del propietario solo los cambia él.' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(array_agg(d::smallint order by d), array[1, 2, 3, 4, 5, 6, 7]::smallint[]) into v_dias
    from (select distinct jsonb_array_elements_text(coalesce(p_datos -> 'dias', '[1,2,3,4,5,6,7]'::jsonb))::int d) x;
  insert into public.notificacion_preferencias (finca_id, user_id, activo, resumen, resumen_hora, dias, nivel_minimo, updated_by)
  values (
    p_finca, p_user,
    coalesce((p_datos ->> 'activo')::boolean, false), coalesce((p_datos ->> 'resumen')::boolean, true),
    coalesce((p_datos ->> 'resumen_hora')::time, time '06:30'), v_dias, coalesce(p_datos ->> 'nivel_minimo', 'ambar'), (select auth.uid()))
  on conflict (finca_id, user_id) do update set
    activo = excluded.activo, resumen = excluded.resumen, resumen_hora = excluded.resumen_hora, dias = excluded.dias,
    nivel_minimo = excluded.nivel_minimo, updated_by = excluded.updated_by;
end
$$;

revoke execute on function public.equipo_notificaciones(uuid) from public, anon;
revoke execute on function public.guardar_notificaciones_equipo(uuid, uuid, jsonb) from public, anon;
grant execute on function public.equipo_notificaciones(uuid) to authenticated;
grant execute on function public.guardar_notificaciones_equipo(uuid, uuid, jsonb) to authenticated;
