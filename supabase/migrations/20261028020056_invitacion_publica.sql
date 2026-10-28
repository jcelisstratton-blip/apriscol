-- Quien recibe el enlace de una invitación y todavía no tiene cuenta no puede iniciar sesión (y la pantalla de entrada le pedía una contraseña que no existe).
-- Esta función deja ver, sin sesión, a quién va dirigida la invitación (correo, perfil y finca) para ofrecerle crear su cuenta con ese correo.
-- La llave es el token (un uuid secreto): solo lo conoce quien recibió el enlace. No devuelve nada si venció o ya se usó. Solo agrega una función.
create or replace function public.invitacion_publica(p_token uuid)
returns table (email text, rol public.rol_finca, finca_nombre text)
language sql stable security definer
set search_path = ''
as $$
  select i.email, i.rol, f.nombre
  from public.invitaciones i
  join public.fincas f on f.id = i.finca_id
  where i.token = p_token and i.aceptada_en is null and i.expira_en > now();
$$;

revoke execute on function public.invitacion_publica(uuid) from public;
grant execute on function public.invitacion_publica(uuid) to anon, authenticated;
