-- Una novedad de compra no es de un animal: animal_id puede ser nulo. Se agrega el grupo y el producto de compra (del catálogo de Compras) y el tipo «compra».
alter table public.novedades alter column animal_id drop not null;
alter table public.novedades
  add column grupo_compra text check (grupo_compra is null or grupo_compra in ('alimentacion', 'sanidad', 'reproduccion', 'logistica', 'operacion')),
  add column compra_producto_id uuid,
  add column compra_producto_nombre text check (compra_producto_nombre is null or char_length(compra_producto_nombre) <= 120),
  add constraint novedades_compra_producto_fk foreign key (compra_producto_id, finca_id) references public.finca_productos (id, finca_id) on delete set null (compra_producto_id);

alter table public.novedades drop constraint novedades_tipo_check;
alter table public.novedades add constraint novedades_tipo_check check (tipo in ('compra', 'aplicacion', 'prueba', 'coprologico', 'famacha'));
alter table public.novedades drop constraint novedades_segun_tipo;
alter table public.novedades add constraint novedades_segun_tipo check (
  (tipo = 'compra' and grupo_compra is not null)
  or (tipo = 'aplicacion' and animal_id is not null and (tipo_evento is not null or categoria_producto is not null))
  or (tipo = 'prueba' and animal_id is not null and prueba is not null and resultado_prueba is not null)
  or (tipo = 'coprologico' and animal_id is not null and tipo_muestra is not null)
  or (tipo = 'famacha' and animal_id is not null and puntaje is not null));
