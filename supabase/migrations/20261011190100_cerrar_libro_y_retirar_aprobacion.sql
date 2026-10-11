-- Cierra el libro a las fincas (solo superadmin) y retira el flujo de aprobación, ya sustituido por traer_animales_libro.
-- Idempotente: parte de esto ya se aplicó a mano en el SQL Editor.
drop policy if exists libro_genealogico_select on public.libro_genealogico;
create policy libro_genealogico_select on public.libro_genealogico for select to authenticated
  using ((select private.es_admin_plataforma()));

drop function if exists public.solicitar_reclamo(uuid, text, text, text);
drop function if exists public.aprobar_reclamo(uuid);
drop function if exists public.rechazar_reclamo(uuid, text);
drop function if exists public.traer_animales_libro(uuid, text);  -- versión sin microchip, ya revocada
