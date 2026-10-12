-- Fotos de animales: carpeta de la finca por su uuid (<finca_id>/<uuid>.<ext>), igual que `premios`.
-- Ver y subir/reemplazar/borrar exige tener el módulo `hato` en esa finca. `anon` no tiene acceso.
create policy fotos_animales_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos-animales' and (select private.puede_ver(private.carpeta_finca(name), 'hato')));

create policy fotos_animales_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos-animales'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    and (select private.puede_escribir(private.carpeta_finca(name), 'hato'))
  );

create policy fotos_animales_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-animales' and (select private.puede_escribir(private.carpeta_finca(name), 'hato')));
