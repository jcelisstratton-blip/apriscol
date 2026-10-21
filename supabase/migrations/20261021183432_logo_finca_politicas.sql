-- Logos de fincas: carpeta de la finca por su uuid (<finca_id>/<uuid>.<ext>), como `fotos-animales` y `premios`.
-- Ver: cualquier miembro de la finca. Subir y borrar: solo quien gestiona la finca (propietario o administrador).
-- `anon` no tiene acceso. No hay política de listado ni de actualización.
create policy logos_fincas_ver on storage.objects for select to authenticated
  using (bucket_id = 'logos-fincas' and (select private.es_miembro(private.carpeta_finca(name))));

create policy logos_fincas_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos-fincas'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    and (select private.puede_gestionar(private.carpeta_finca(name)))
  );

create policy logos_fincas_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'logos-fincas' and (select private.puede_gestionar(private.carpeta_finca(name))));
