-- Logo de la finca (opcional): la ruta del archivo en Storage y el bucket donde vive.
-- La ruta siempre es <finca_id>/<uuid>.<jpg|png|webp>: el propio CHECK impide apuntar a la carpeta de otra finca.
alter table public.fincas add column logo_path text;
alter table public.fincas add constraint fincas_logo_path_ck check (
  logo_path is null
  or logo_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
);

-- Bucket privado, 1 MB (el navegador reduce el logo a 512 px), solo imágenes rasterizadas: nunca SVG (puede llevar código).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('logos-fincas', 'logos-fincas', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
