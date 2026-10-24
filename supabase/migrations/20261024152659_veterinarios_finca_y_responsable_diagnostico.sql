-- Veterinarios de la finca para elegir quién hizo un procedimiento, y quién hizo cada diagnóstico.
--  · `veterinarios_finca(p_finca)`: los veterinarios activos del equipo (Personal con perfil «veterinario»), solo nombre y tarjeta profesional. La tabla `personal`
--    es del módulo de contabilidad (tiene sueldos) y un veterinario o un ordeñador no puede leerla: esta función entrega apenas lo necesario a quien registra
--    reproducción, y nada más (ni sueldo, ni teléfono, ni correo).
--  · `diagnosticos_gestacion.responsable`: quién hizo el diagnóstico (el nombre se copia en el registro, como en servicios y partos).

alter table public.diagnosticos_gestacion
  add column responsable text check (responsable is null or char_length(btrim(responsable)) between 1 and 120);

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
    where p.finca_id = p_finca and p.activo and p.rol = 'veterinario'
    order by lower(p.nombre);
end;
$$;
revoke execute on function public.veterinarios_finca(uuid) from public, anon;
grant execute on function public.veterinarios_finca(uuid) to authenticated;
