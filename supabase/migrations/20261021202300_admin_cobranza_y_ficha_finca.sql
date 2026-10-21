-- Administración: cobranza y ficha de finca (solo lectura; el superadmin las consulta, nada se escribe).
--  · `admin_cobranza()`: lo necesario para cobrar (finca, propietario con su teléfono, plan, vigencia, estado y días que faltan). Sustituye a `admin_vigencias`
--    en el panel; esta se deja como está (retrocompatible) y no se vuelve a usar.
--  · `admin_ficha_finca(finca)`: una finca a fondo en un solo jsonb (propietario, uso, pagos, solicitudes y bitácora de esa finca).

create function public.admin_cobranza()
returns table (finca_id uuid, nombre text, propietario_email text, propietario_nombre text, telefono text, plan text, plan_vence_en date, estado text,
               dias_restantes integer, numero_finca integer, cuenta_pruebas boolean, ultimo_pago_en timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_hoy constant date := (now() at time zone 'America/Bogota')::date;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  return query
  select f.id, f.nombre::text, coalesce(u.email::text, ''), coalesce(p.nombre::text, ''), coalesce(p.telefono::text, ''), f.plan::text, f.plan_vence_en,
         private.estado_plan(f.id),
         case when f.plan_vence_en is null then null else f.plan_vence_en - v_hoy end,
         (select count(*)::integer from public.fincas f2
            join public.finca_miembros m2 on m2.finca_id = f2.id and m2.user_id = o.user_id and m2.rol = 'propietario'
           where (f2.created_at, f2.id) <= (f.created_at, f.id)),
         coalesce(p.exenta_vigencia, false),
         (select max(g.created_at) from public.pagos g where g.finca_id = f.id and g.anulado_en is null)
    from public.fincas f
    left join lateral (select m.user_id from public.finca_miembros m where m.finca_id = f.id and m.rol = 'propietario' order by m.created_at limit 1) o on true
    left join auth.users u on u.id = o.user_id
    left join public.perfiles p on p.id = o.user_id
   order by f.plan_vence_en nulls last, f.created_at
   limit 1000;
end;
$$;
revoke execute on function public.admin_cobranza() from public, anon;
grant execute on function public.admin_cobranza() to authenticated;

create function public.admin_ficha_finca(p_finca uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_f public.fincas%rowtype;
  v_dueno uuid;
  v_res jsonb;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede ver esto.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_f from public.fincas f where f.id = p_finca;
  if not found then
    return null;
  end if;
  select m.user_id into v_dueno from public.finca_miembros m where m.finca_id = p_finca and m.rol = 'propietario' order by m.created_at limit 1;

  select jsonb_build_object(
    'finca', jsonb_build_object(
      'id', v_f.id, 'nombre', v_f.nombre, 'departamento', v_f.departamento, 'municipio', v_f.municipio, 'vereda', v_f.vereda,
      'creada_en', v_f.created_at, 'activada_en', v_f.activada_en, 'plan', v_f.plan, 'plan_vence_en', v_f.plan_vence_en,
      'estado', private.estado_plan(v_f.id),
      'numero_finca', (select count(*)::integer from public.fincas f2
                         join public.finca_miembros m2 on m2.finca_id = f2.id and m2.user_id = v_dueno and m2.rol = 'propietario'
                        where (f2.created_at, f2.id) <= (v_f.created_at, v_f.id))),
    'propietario', (select jsonb_build_object(
        'email', coalesce(u.email::text, ''), 'nombre', coalesce(p.nombre::text, ''), 'telefono', coalesce(p.telefono::text, ''),
        'ultimo_ingreso', u.last_sign_in_at, 'registrado_en', u.created_at, 'cuenta_pruebas', coalesce(p.exenta_vigencia, false))
      from auth.users u left join public.perfiles p on p.id = u.id where u.id = v_dueno),
    'uso', jsonb_build_object(
      'animales_activos', (select count(*) from public.animales a where a.finca_id = p_finca and a.estado = 'activo' and a.deleted_at is null),
      'miembros', (select count(*) from public.finca_miembros m where m.finca_id = p_finca)),
    'pagos', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select g.id, g.finca_id, g.finca_nombre, g.propietario_email, g.plan, g.plan_antes, g.periodo, g.monto_usd, g.monto_cop, g.referencia, g.vence_despues,
               g.confirmado_por_email, g.created_at, g.anulado_en, g.anulado_por_email, g.motivo_anulacion,
               (g.anulado_en is null and not exists (
                  select 1 from public.pagos g2 where g2.finca_id = g.finca_id and g2.anulado_en is null and (g2.created_at, g2.id) > (g.created_at, g.id))) as se_puede_anular
          from public.pagos g where g.finca_id = p_finca order by g.created_at desc limit 20) x), '[]'::jsonb),
    'solicitudes', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select s.plan_actual, s.plan_nuevo, s.periodo, s.estado, s.created_at
          from public.solicitudes_plan s where s.finca_id = p_finca order by s.created_at desc limit 10) x), '[]'::jsonb),
    'bitacora', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select a.id, a.actor_email, a.accion, a.detalle, a.created_at
          from public.auditoria_admin a where a.finca_id = p_finca order by a.created_at desc, a.id desc limit 20) x), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;
revoke execute on function public.admin_ficha_finca(uuid) from public, anon;
grant execute on function public.admin_ficha_finca(uuid) to authenticated;
