-- Nómina · Storage: la carpeta «nomina» del bucket de soportes (comprobante de seguridad social) y «gastos», que la política de subida no incluía.
-- Es aditiva: no se toca `soportes_subir` (calidad, carne, sanidad); una política nueva permite subir a «gastos» y «nomina» a quien maneja contabilidad.
-- Idempotente: si la política ya existe, no hace nada.

create or replace function private.modulo_soporte(p_ruta text)
returns public.modulo_app
language sql immutable set search_path = ''
as $$
  select case (storage.foldername(p_ruta))[2]
    when 'calidad' then 'leche'::public.modulo_app
    when 'carne' then 'carne'::public.modulo_app
    when 'sanidad' then 'sanidad'::public.modulo_app
    when 'gastos' then 'contabilidad'::public.modulo_app
    when 'nomina' then 'contabilidad'::public.modulo_app
  end;
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'soportes_subir_contabilidad') then
    create policy soportes_subir_contabilidad on storage.objects for insert to authenticated
      with check (
        bucket_id = 'soportes'
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(gastos|nomina)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$'
        and (select private.puede_escribir(private.carpeta_finca(name), private.modulo_soporte(name)))
      );
  end if;
end $$;
