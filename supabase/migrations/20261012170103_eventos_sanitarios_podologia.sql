-- El tipo de evento «podologia» (recorte de pezuñas, pediluvio, gabatillo) se suma a los que admite eventos_sanitarios.
alter table public.eventos_sanitarios drop constraint eventos_sanitarios_tipo_check;
alter table public.eventos_sanitarios
  add constraint eventos_sanitarios_tipo_check check (tipo = any (array['vacunacion', 'desparasitacion', 'tratamiento', 'cirugia', 'podologia', 'otro']));
