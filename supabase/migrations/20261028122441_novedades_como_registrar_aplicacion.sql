-- La novedad de aplicación copia las opciones de «Registrar una aplicación»: qué se hizo (vacunación, desparasitación, tratamiento, podología, pediluvio, cirugía u otro), contra qué,
-- qué dosis, por qué, cómo caminaba y qué anestesia, todo por selección. La única entrada de texto es la observación. Quien la creó puede eliminarla.
alter table public.novedades
  add column tipo_evento text check (tipo_evento is null or tipo_evento in ('vacunacion', 'desparasitacion', 'tratamiento', 'podologia', 'pediluvio', 'cirugia', 'otro')),
  add column categoria text check (categoria is null or char_length(categoria) <= 40),
  add column etapa text check (etapa is null or etapa in ('primera', 'refuerzo', 'revacunacion')),
  add column motivo text check (motivo is null or char_length(motivo) <= 20),
  add column cojera smallint check (cojera is null or cojera between 0 and 3),
  add column anestesia text check (anestesia is null or char_length(anestesia) <= 20),
  add column observaciones text check (observaciones is null or char_length(observaciones) <= 300);

alter table public.novedades drop constraint novedades_segun_tipo;
alter table public.novedades add constraint novedades_segun_tipo check (
  (tipo = 'aplicacion' and (tipo_evento is not null or categoria_producto is not null))
  or (tipo = 'prueba' and prueba is not null and resultado_prueba is not null)
  or (tipo = 'coprologico' and tipo_muestra is not null)
  or (tipo = 'famacha' and puntaje is not null));

-- Quien creó una novedad puede eliminarla (además del propietario y el administrador).
create policy novedades_delete_autor on public.novedades for delete to authenticated
  using (created_by = (select auth.uid()));
