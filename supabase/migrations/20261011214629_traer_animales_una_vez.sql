-- «Traer mis animales» es un paso único al crear la cuenta: se marca como resuelto al terminar o al omitirlo,
-- y de ahí en adelante los animales nuevos los registra el propietario a mano.

alter table public.perfiles add column libro_resuelto_en timestamptz;
-- Las cuentas que ya existían no vuelven a ver la opción.
update public.perfiles set libro_resuelto_en = now() where libro_resuelto_en is null;

-- Si alguien lo omitió por error, el superadmin le devuelve la opción.
create function public.admin_reabrir_traer_animales(p_email text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  if not private.es_admin_plataforma() then
    raise exception 'Solo el administrador de la plataforma puede hacer esto.' using errcode = 'insufficient_privilege';
  end if;
  update public.perfiles set libro_resuelto_en = null
  where id = (select id from auth.users where lower(email) = lower(btrim(p_email)));
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke execute on function public.admin_reabrir_traer_animales(text) from public, anon;
grant execute on function public.admin_reabrir_traer_animales(text) to authenticated;
