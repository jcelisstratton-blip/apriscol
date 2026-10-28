-- Novedades con destino: «Comprar» va al administrador (y al propietario) y «Aplicar dosis» al veterinario (y al propietario). El ordeñador crea las dos; el veterinario solo las de comprar;
-- el administrador y el propietario no crean novedades, las atienden.
create or replace function private.puede_escribir(p_finca uuid, p_modulo public.modulo_app) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then p_modulo <> 'novedades'
      when 'administrador' then p_modulo <> 'novedades'
      when 'ordenador' then p_modulo in ('leche', 'novedades')
      when 'veterinario' then p_modulo in ('sanidad', 'reproduccion', 'corrales', 'novedades')
      when 'contador' then p_modulo = 'contabilidad'
      else false
    end, false)
  and coalesce(private.plan_rango(private.plan_de(p_finca)), 0) >= private.modulo_rango(p_modulo)
  and coalesce(private.estado_plan(p_finca), 'vigente') in ('vigente', 'por_vencer');
$$;

create or replace function private.fincas_atienden_compras() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.finca_id from public.finca_miembros m
  where m.user_id = (select auth.uid()) and m.rol in ('propietario', 'administrador') and private.puede_ver(m.finca_id, 'novedades');
$$;
create or replace function private.fincas_atienden_aplicaciones() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.finca_id from public.finca_miembros m
  where m.user_id = (select auth.uid()) and m.rol in ('propietario', 'veterinario') and private.puede_ver(m.finca_id, 'novedades');
$$;
create or replace function private.puede_crear_novedad(p_finca uuid, p_tipo text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.puede_escribir(p_finca, 'novedades')
     and case private.rol_en(p_finca)
           when 'ordenador' then p_tipo in ('compra', 'aplicacion')
           when 'veterinario' then p_tipo = 'compra'
           else false
         end;
$$;
revoke execute on function private.fincas_atienden_compras(), private.fincas_atienden_aplicaciones(), private.puede_crear_novedad(uuid, text) from public, anon;
grant execute on function private.fincas_atienden_compras(), private.fincas_atienden_aplicaciones(), private.puede_crear_novedad(uuid, text) to authenticated;
