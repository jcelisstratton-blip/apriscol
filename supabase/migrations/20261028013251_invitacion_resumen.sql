-- La pantalla de la invitación decía «Vas a entrar con <correo de la sesión>» aunque la invitación fuera para otro correo, porque quien la abre
-- no puede leer `invitaciones` (RLS: solo quien gestiona la finca). Esta función entrega solo lo necesario para mostrar a quién va dirigida,
-- con el token (un uuid secreto) como llave y solo a quien tiene sesión. Solo agrega una función: retrocompatible.
create or replace function public.invitacion_resumen(p_token uuid)
returns table (email text, rol public.rol_finca, finca_nombre text)
language sql stable security definer
set search_path = ''
as $$
  select i.email, i.rol, f.nombre
  from public.invitaciones i
  join public.fincas f on f.id = i.finca_id
  where i.token = p_token
    and i.aceptada_en is null
    and i.expira_en > now()
    and (select auth.uid()) is not null;
$$;

revoke execute on function public.invitacion_resumen(uuid) from public, anon;
grant execute on function public.invitacion_resumen(uuid) to authenticated;
