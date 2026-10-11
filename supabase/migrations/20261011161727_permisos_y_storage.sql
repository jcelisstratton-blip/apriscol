-- Permisos de la API de datos y buckets de Storage.
-- Convención: tabla nueva → GRANT explícito a authenticated (nunca a anon) + RLS con private.crear_politicas_finca().

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Catálogos: solo lectura.
revoke insert, update, delete on public.razas, public.parametros_especie from authenticated;
-- Las membresías y los módulos se crean solo por trigger / invitación, nunca por inserción directa.
revoke insert on public.finca_miembros, public.finca_modulos from authenticated;
revoke delete on public.finca_modulos from authenticated;
-- Perfiles: se crean por trigger y no se borran desde el cliente.
revoke insert, delete on public.perfiles from authenticated;

-- Storage: un bucket por tipo de uso, y dentro la carpeta de cada finca por su uuid (<finca_id>/...).
-- Sin políticas de escritura ni de listado para anon/authenticated: el servidor arma la ruta y firma la subida.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('fotos-animales', 'fotos-animales', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('soportes', 'soportes', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
