-- Quién elimina una novedad ajena: solo el administrador (las de Comprar, que es lo que ve). Cada quien sigue eliminando las suyas (novedades_delete_autor).
create or replace function private.fincas_borran_novedades() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.finca_id from public.finca_miembros m
  where m.user_id = (select auth.uid()) and m.rol = 'administrador' and private.puede_ver(m.finca_id, 'novedades');
$$;
revoke execute on function private.fincas_borran_novedades() from public, anon;
grant execute on function private.fincas_borran_novedades() to authenticated;

alter policy novedades_delete on public.novedades
  using (finca_id in (select private.fincas_borran_novedades()));
