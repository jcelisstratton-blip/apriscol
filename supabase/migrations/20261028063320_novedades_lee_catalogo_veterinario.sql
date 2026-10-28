-- Quien envía novedades elige el producto de la lista del catálogo veterinario: puede leerlo (solo lectura; escribir sigue siendo de Sanidad).
create policy productos_veterinarios_select_novedades on public.productos_veterinarios for select to authenticated
  using (finca_id in (select private.fincas_ver('novedades'::public.modulo_app)));
