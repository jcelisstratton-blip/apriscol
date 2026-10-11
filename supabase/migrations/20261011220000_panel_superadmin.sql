-- Panel del superadmin: visión global de la plataforma (solo lectura, solo para plataforma_admins).

create function public.admin_resumen() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'usuarios', (select count(*) from auth.users),
    'nuevos_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'sin_finca', (select count(*) from auth.users u where not exists (select 1 from public.finca_miembros m where m.user_id = u.id)),
    'fincas', (select count(*) from public.fincas),
    'animales_activos', (select count(*) from public.animales where deleted_at is null and estado = 'activo'),
    'libro_total', (select count(*) from public.libro_genealogico),
    'libro_en_fincas', (select count(distinct libro_id) from public.animales where libro_id is not null and deleted_at is null),
    'importaciones', (select count(*) from public.solicitudes_reclamo where estado = 'aprobada'),
    'litros_7d', (select coalesce(sum(litros), 0) from public.ordenos
                  where fecha >= (now() at time zone 'America/Bogota')::date - 7 and not descartada)
  );
end;
$$;

create function public.admin_listar_fincas()
returns table (
  id uuid, nombre text, departamento text, municipio text, propietario_email text, propietario_nombre text,
  animales_activos integer, miembros integer, creada_en timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select f.id, f.nombre::text, f.departamento::text, f.municipio::text,
         coalesce(u.email::text, ''), coalesce(p.nombre::text, ''),
         (select count(*)::integer from public.animales a where a.finca_id = f.id and a.deleted_at is null and a.estado = 'activo'),
         (select count(*)::integer from public.finca_miembros m where m.finca_id = f.id),
         f.created_at
  from public.fincas f
  left join lateral (
    select m.user_id from public.finca_miembros m where m.finca_id = f.id and m.rol = 'propietario' order by m.created_at limit 1
  ) o on true
  left join auth.users u on u.id = o.user_id
  left join public.perfiles p on p.id = o.user_id
  order by f.created_at desc
  limit 1000;
end;
$$;

revoke execute on function public.admin_resumen(), public.admin_listar_fincas() from public, anon;
grant execute on function public.admin_resumen(), public.admin_listar_fincas() to authenticated;
