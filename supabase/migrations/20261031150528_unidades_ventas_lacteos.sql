-- Unidades de medida de lo que se vende: el yogur y las demás bebidas lácteas se miden en litros, no en kilogramos (la leche no se pesa), y los derivados sólidos
-- (cuajada, mantequilla…) quedan en un producto aparte, en kg. Retrocompatible: no borra nada y no toca lo que cada finca ya cambió.
--  · Las ventas ya registradas guardan su propia unidad (ventas.unidad), así que su historia no cambia.
--  · Solo se corrige el producto que todavía tiene el nombre y la unidad con que nació («Yogur y otros lácteos», kg) y solo si no existe ya uno con el nombre nuevo.

create or replace function private.productos_sembrar(p_finca uuid) returns void
language sql security definer set search_path = ''
as $$
  insert into public.finca_productos (finca_id, clave, tipo, nombre, rubro, linea, unidad, automatico, orden)
  select p_finca, v.clave, v.tipo, v.nombre, v.rubro, v.linea, v.unidad, v.automatico, v.orden
  from (values
    -- Compras · alimentación
    ('concentrado_lactancia', 'compra', 'Concentrado para lactancia', 'concentrado', null::text, 'bultos', false, 10),
    ('concentrado_engorde', 'compra', 'Concentrado para engorde', 'concentrado', null, 'bultos', false, 11),
    ('concentrado_crias', 'compra', 'Concentrado para crías', 'concentrado', null, 'bultos', false, 12),
    ('heno_paca', 'compra', 'Heno o paca de forraje', 'forraje', null, 'pacas', false, 13),
    ('ensilaje', 'compra', 'Ensilaje', 'forraje', null, 'kg', false, 14),
    ('sal_mineralizada', 'compra', 'Sal mineralizada', 'sales_suplementos', null, 'kg', false, 15),
    ('melaza', 'compra', 'Melaza', 'sales_suplementos', null, 'kg', false, 16),
    ('bloque_nutricional', 'compra', 'Bloque nutricional', 'sales_suplementos', null, 'unidades', false, 17),
    ('leche_maternizada', 'compra', 'Leche maternizada', 'leche_maternizada', null, 'kg', false, 18),
    -- Compras · sanidad
    ('vacuna_clostridial', 'compra', 'Vacuna clostridial', 'vacunas_desparasitantes', null, 'dosis', false, 20),
    ('vacuna_rabia', 'compra', 'Vacuna contra la rabia', 'vacunas_desparasitantes', null, 'dosis', false, 21),
    ('desparasitante', 'compra', 'Desparasitante', 'vacunas_desparasitantes', null, 'dosis', false, 22),
    ('antibiotico', 'compra', 'Antibiótico', 'tratamientos', null, 'dosis', false, 23),
    ('antiinflamatorio', 'compra', 'Antiinflamatorio', 'tratamientos', null, 'dosis', false, 24),
    ('vitaminas', 'compra', 'Vitaminas y reconstituyentes', 'tratamientos', null, 'dosis', false, 25),
    ('prueba_laboratorio', 'compra', 'Prueba de laboratorio', 'pruebas_laboratorio', null, 'unidades', false, 26),
    ('sulfato_pediluvio', 'compra', 'Sulfato de cobre o de zinc (pediluvio)', 'podologia', null, 'kg', false, 27),
    ('desinfectante', 'compra', 'Desinfectante', 'bioseguridad', null, 'litros', false, 28),
    -- Compras · reproducción
    ('pajillas', 'compra', 'Pajillas de semen', 'material_reproductivo', null, 'pajillas', false, 30),
    ('hormonas', 'compra', 'Hormonas de sincronización', 'material_reproductivo', null, 'dosis', false, 31),
    ('visita_veterinaria', 'compra', 'Visita del veterinario', 'asistencia_veterinaria', null, 'visitas', false, 32),
    -- Compras · identificación y transporte
    ('aretes', 'compra', 'Aretes', 'identificacion', null, 'aretes', false, 40),
    ('microchips', 'compra', 'Microchips', 'identificacion', null, 'unidades', false, 41),
    ('flete', 'compra', 'Flete o transporte', 'fletes', null, 'viajes', false, 42),
    -- Compras · operación
    ('arriendo', 'compra', 'Arriendo', 'arriendo', null, 'meses', false, 50),
    ('agua_energia', 'compra', 'Agua y energía', 'servicios_publicos', null, 'meses', false, 51),
    ('combustible', 'compra', 'Combustible', 'combustible', null, 'galones', false, 52),
    ('mantenimiento', 'compra', 'Mantenimiento y reparaciones', 'mantenimiento', null, 'unidades', false, 53),
    ('otro_gasto', 'compra', 'Otra compra o gasto', 'otros', null, 'unidades', false, 90),
    -- Ventas (las dos primeras y la tercera se registran solas desde Leche y desde la baja de un animal)
    ('leche_cruda', 'venta', 'Leche cruda', null, 'leche', 'litros', true, 10),
    ('animal_pie', 'venta', 'Animal en pie', null, 'animales', 'animales', true, 11),
    ('animal_sacrificado', 'venta', 'Animal sacrificado', null, 'carne', 'animales', true, 12),
    ('carne_canal', 'venta', 'Carne en canal', null, 'carne', 'kg', false, 20),
    ('carne_cortes', 'venta', 'Carne en cortes', null, 'carne', 'kg', false, 21),
    ('queso', 'venta', 'Queso', null, 'derivados', 'kg', false, 30),
    ('yogur_lacteos', 'venta', 'Yogur, kumis y otras bebidas lácteas', null, 'derivados', 'litros', false, 31),
    ('derivados_solidos', 'venta', 'Cuajada, mantequilla y otros derivados', null, 'derivados', 'kg', false, 32),
    ('abono', 'venta', 'Abono (estiércol)', null, 'subproductos', 'bultos', false, 40),
    ('lana', 'venta', 'Lana', null, 'subproductos', 'kg', false, 41),
    ('pieles', 'venta', 'Pieles', null, 'subproductos', 'unidades', false, 42),
    ('otra_venta', 'venta', 'Otra venta', null, 'otros', 'unidades', false, 90)
  ) as v(clave, tipo, nombre, rubro, linea, unidad, automatico, orden)
  on conflict do nothing;
$$;

update public.finca_productos p
   set nombre = 'Yogur, kumis y otras bebidas lácteas', unidad = 'litros'
 where p.clave = 'yogur_lacteos' and p.tipo = 'venta' and p.nombre = 'Yogur y otros lácteos' and p.unidad = 'kg'
   and not exists (select 1 from public.finca_productos x where x.finca_id = p.finca_id and x.tipo = 'venta' and lower(btrim(x.nombre)) = lower('Yogur, kumis y otras bebidas lácteas'));

-- Las fincas que ya existen reciben el producto nuevo (la siembra es idempotente y no toca lo que ya hay).
select private.productos_sembrar(id) from public.fincas;
