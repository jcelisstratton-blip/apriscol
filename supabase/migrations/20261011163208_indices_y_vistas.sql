-- Índices de apoyo a RLS (todo filtro pasa por finca_id) y a las llaves foráneas que se consultan.
-- Las FK created_by → auth.users no se indexan a propósito: solo se recorren al borrar un usuario.

create index celos_finca_idx on public.celos (finca_id);
create index crias_finca_idx on public.crias (finca_id);
create index crias_animal_idx on public.crias (animal_id) where animal_id is not null;
create index diagnosticos_finca_idx on public.diagnosticos_gestacion (finca_id);
create index diagnosticos_servicio_idx on public.diagnosticos_gestacion (servicio_id) where servicio_id is not null;
create index evento_sanitario_animales_finca_idx on public.evento_sanitario_animales (finca_id);
create index pruebas_sanitarias_finca_idx on public.pruebas_sanitarias (finca_id);
create index servicios_finca_idx on public.servicios (finca_id, fecha desc);
create index servicios_macho_idx on public.servicios (macho_id) where macho_id is not null;
create index partos_servicio_idx on public.partos (servicio_id) where servicio_id is not null;
create index lactancias_parto_idx on public.lactancias (parto_id) where parto_id is not null;
create index ordenos_lactancia_idx on public.ordenos (lactancia_id) where lactancia_id is not null;
create index eventos_sanitarios_producto_idx on public.eventos_sanitarios (producto_id) where producto_id is not null;
create index animales_raza_idx on public.animales (raza_id) where raza_id is not null;
create index perfiles_finca_activa_idx on public.perfiles (finca_activa_id) where finca_activa_id is not null;

-- Las vistas son de solo lectura.
revoke insert, update, delete on public.v_servicios, public.v_produccion_diaria, public.v_lactancias_resumen
  from authenticated;
