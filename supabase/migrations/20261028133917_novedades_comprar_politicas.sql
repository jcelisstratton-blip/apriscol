-- Quién ve, crea y atiende cada novedad: las de compra, el administrador y el propietario; las de aplicar, el veterinario y el propietario; cada quien ve además las suyas.
alter policy novedades_select on public.novedades
  using (finca_id in (select private.fincas_ver('novedades'::public.modulo_app))
         and (created_by = (select auth.uid())
              or (tipo = 'compra' and finca_id in (select private.fincas_atienden_compras()))
              or (tipo <> 'compra' and finca_id in (select private.fincas_atienden_aplicaciones()))));
alter policy novedades_insert on public.novedades
  with check ((select private.puede_crear_novedad(finca_id, tipo)) and created_by = (select auth.uid()));
alter policy novedades_update on public.novedades
  using ((tipo = 'compra' and finca_id in (select private.fincas_atienden_compras()))
         or (tipo <> 'compra' and finca_id in (select private.fincas_atienden_aplicaciones())))
  with check ((tipo = 'compra' and finca_id in (select private.fincas_atienden_compras()))
              or (tipo <> 'compra' and finca_id in (select private.fincas_atienden_aplicaciones())));
