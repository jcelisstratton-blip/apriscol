-- Cierra el libro a las fincas (solo superadmin) y retira el flujo de aprobación, ya sustituido por traer_animales_libro.
drop policy libro_genealogico_select on public.libro_genealogico;
create policy libro_genealogico_select on public.libro_genealogico for select to authenticated
  using ((select private.es_admin_plataforma()));

drop function public.solicitar_reclamo(uuid, text, text, text);
drop function public.aprobar_reclamo(uuid);
drop function public.rechazar_reclamo(uuid, text);
