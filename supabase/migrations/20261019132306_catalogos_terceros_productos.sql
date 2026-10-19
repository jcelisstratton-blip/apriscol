-- Catálogos de la finca para que registrar una compra o una venta sea ELEGIR de una lista, no escribir:
--  · finca_terceros: a quién se le compra (proveedor) o a quién se le vende (comprador). Se crean una vez y se eligen siempre.
--  · finca_productos: lo que se compra (concentrado, vacunas, aretes…) y lo que se vende (leche, carne, queso, abono…), con su unidad, su
--    rubro o línea y el último precio. Cada finca nace con su lista sembrada (`private.productos_sembrar`) y la puede ajustar.
-- Los textos libres que ya existían (proveedor de un gasto, comprador de un despacho o de una baja) se convierten en terceros y se enlazan.

-- ───────────────────────── Terceros ─────────────────────────
create table public.finca_terceros (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  tipo text not null default 'ambos' check (tipo in ('proveedor', 'comprador', 'ambos')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id)
);
create unique index finca_terceros_nombre_uk on public.finca_terceros (finca_id, lower(btrim(nombre)));
create trigger finca_terceros_updated_at before update on public.finca_terceros for each row execute function private.set_updated_at();

-- ───────────────────────── Productos ─────────────────────────
create table public.finca_productos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  -- Identifica un producto sembrado (para no sembrarlo dos veces); nulo en los que crea la finca.
  clave text,
  tipo text not null check (tipo in ('compra', 'venta')),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  -- Compra: el rubro de gasto al que pertenece. Venta: la línea de ingreso.
  rubro text check (rubro in (
    'concentrado', 'forraje', 'sales_suplementos', 'leche_maternizada',
    'vacunas_desparasitantes', 'tratamientos', 'pruebas_laboratorio', 'podologia', 'bioseguridad',
    'material_reproductivo', 'asistencia_veterinaria', 'identificacion', 'fletes',
    'arriendo', 'servicios_publicos', 'combustible', 'mantenimiento', 'otros')),
  linea text check (linea in ('leche', 'animales', 'carne', 'derivados', 'subproductos', 'otros')),
  unidad text check (unidad is null or char_length(btrim(unidad)) between 1 and 20),
  -- El último precio con que se compró o se vendió: se propone la próxima vez.
  precio_habitual numeric(14, 2) check (precio_habitual is null or (precio_habitual >= 0 and precio_habitual <= 100000000000)),
  -- Los que se registran solos desde otro módulo (la leche despachada, un animal vendido): no se ofrecen en el formulario de ventas.
  automatico boolean not null default false,
  activo boolean not null default true,
  orden smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint finca_productos_tipo_ck check ((tipo = 'compra' and rubro is not null and linea is null) or (tipo = 'venta' and linea is not null and rubro is null))
);
create unique index finca_productos_clave_uk on public.finca_productos (finca_id, clave) where clave is not null;
create unique index finca_productos_nombre_uk on public.finca_productos (finca_id, tipo, lower(btrim(nombre)));
create trigger finca_productos_updated_at before update on public.finca_productos for each row execute function private.set_updated_at();

-- La lista con la que nace cada finca. Idempotente: se puede volver a correr para sembrar productos nuevos sin tocar los que ya existen.
create function private.productos_sembrar(p_finca uuid) returns void
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
    ('yogur_lacteos', 'venta', 'Yogur y otros lácteos', null, 'derivados', 'kg', false, 31),
    ('abono', 'venta', 'Abono (estiércol)', null, 'subproductos', 'bultos', false, 40),
    ('lana', 'venta', 'Lana', null, 'subproductos', 'kg', false, 41),
    ('pieles', 'venta', 'Pieles', null, 'subproductos', 'unidades', false, 42),
    ('otra_venta', 'venta', 'Otra venta', null, 'otros', 'unidades', false, 90)
  ) as v(clave, tipo, nombre, rubro, linea, unidad, automatico, orden)
  on conflict do nothing;
$$;
revoke execute on function private.productos_sembrar(uuid) from public, anon, authenticated;

create function private.finca_productos_nueva() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.productos_sembrar(new.id);
  return new;
end;
$$;
create trigger fincas_productos_after_insert after insert on public.fincas for each row execute function private.finca_productos_nueva();

-- Las fincas que ya existen.
select private.productos_sembrar(id) from public.fincas;

-- ───────────────────────── A quién y qué: columnas en lo que ya existía ─────────────────────────
alter table public.gastos
  add column tercero_id uuid,
  add column producto_id uuid,
  add constraint gastos_tercero_fk foreign key (tercero_id, finca_id) references public.finca_terceros (id, finca_id) on delete restrict,
  add constraint gastos_producto_fk foreign key (producto_id, finca_id) references public.finca_productos (id, finca_id) on delete restrict;

-- Despachos de leche y bajas por venta: quién compró y si ya se cobró (`cobrado_en` nulo = por cobrar; `cobro_vence` = cuándo se espera el pago).
alter table public.despachos_leche
  add column tercero_id uuid,
  add column cobrado_en date,
  add column cobro_vence date,
  add constraint despachos_tercero_fk foreign key (tercero_id, finca_id) references public.finca_terceros (id, finca_id) on delete restrict;
alter table public.bajas
  add column tercero_id uuid,
  add column cobrado_en date,
  add column cobro_vence date,
  add constraint bajas_tercero_fk foreign key (tercero_id, finca_id) references public.finca_terceros (id, finca_id) on delete restrict;

-- Cuándo se compró un animal (para contar su compra como costo en su fecha). Opcional: sin fecha se usa el día en que se registró.
alter table public.animales add column fecha_compra date check (fecha_compra is null or fecha_compra >= date '1990-01-01');

-- ───────────────────────── Lo ya escrito a mano pasa a ser un tercero elegible ─────────────────────────
with nombres as (
  select finca_id, btrim(proveedor) as n, 'proveedor'::text as t from public.gastos where proveedor is not null and btrim(proveedor) <> ''
  union all
  select finca_id, btrim(comprador), 'comprador' from public.despachos_leche where comprador is not null and btrim(comprador) <> ''
  union all
  select finca_id, btrim(comprador), 'comprador' from public.bajas where comprador is not null and btrim(comprador) <> ''
), agrupados as (
  select finca_id, min(n) as nombre, case when count(distinct t) > 1 then 'ambos' else min(t) end as tipo
  from nombres group by finca_id, lower(n)
)
insert into public.finca_terceros (finca_id, nombre, tipo) select finca_id, nombre, tipo from agrupados;

update public.gastos g set tercero_id = t.id from public.finca_terceros t
 where t.finca_id = g.finca_id and lower(btrim(t.nombre)) = lower(btrim(g.proveedor)) and g.proveedor is not null;
update public.despachos_leche d set tercero_id = t.id from public.finca_terceros t
 where t.finca_id = d.finca_id and lower(btrim(t.nombre)) = lower(btrim(d.comprador)) and d.comprador is not null;
update public.bajas b set tercero_id = t.id from public.finca_terceros t
 where t.finca_id = b.finca_id and lower(btrim(t.nombre)) = lower(btrim(b.comprador)) and b.comprador is not null;

-- Lo vendido antes de que existiera «por cobrar» se da por cobrado en su fecha.
update public.despachos_leche set cobrado_en = fecha where valor_total is not null and valor_total > 0 and cobrado_en is null;
update public.bajas set cobrado_en = fecha where valor is not null and valor > 0 and cobrado_en is null;

-- ───────────────────────── Permisos (RLS) ─────────────────────────
-- Los catálogos son de la finca: los leen todos los miembros (un ordeñador elige el comprador de un despacho) y los cambia quien registra
-- compras, ventas, leche o carne. Nada se borra: lo que ya no se usa se desactiva (los registros viejos lo siguen mostrando).
alter table public.finca_terceros enable row level security;
alter table public.finca_productos enable row level security;
revoke all on public.finca_terceros, public.finca_productos from anon, authenticated;
grant select, insert, update on public.finca_terceros, public.finca_productos to authenticated;

create policy finca_terceros_select on public.finca_terceros for select to authenticated
  using ((select private.es_miembro(finca_id)));
create policy finca_terceros_insert on public.finca_terceros for insert to authenticated
  with check ((select private.puede_escribir(finca_id, 'contabilidad')) or (select private.puede_escribir(finca_id, 'leche')) or (select private.puede_escribir(finca_id, 'carne')));
create policy finca_terceros_update on public.finca_terceros for update to authenticated
  using ((select private.puede_escribir(finca_id, 'contabilidad')) or (select private.puede_escribir(finca_id, 'leche')) or (select private.puede_escribir(finca_id, 'carne')))
  with check ((select private.puede_escribir(finca_id, 'contabilidad')) or (select private.puede_escribir(finca_id, 'leche')) or (select private.puede_escribir(finca_id, 'carne')));

create policy finca_productos_select on public.finca_productos for select to authenticated
  using ((select private.es_miembro(finca_id)));
create policy finca_productos_insert on public.finca_productos for insert to authenticated
  with check ((select private.puede_escribir(finca_id, 'contabilidad')));
create policy finca_productos_update on public.finca_productos for update to authenticated
  using ((select private.puede_escribir(finca_id, 'contabilidad'))) with check ((select private.puede_escribir(finca_id, 'contabilidad')));

-- Un ordeñador o quien registra una baja actualiza el precio habitual de la leche o del animal al guardar su registro; eso lo hace la función
-- (la política de arriba solo deja a contabilidad cambiar un producto directamente).
create function public.recordar_precio_producto(p_finca uuid, p_producto uuid, p_precio numeric) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (private.puede_escribir(p_finca, 'contabilidad') or private.puede_escribir(p_finca, 'leche') or private.puede_escribir(p_finca, 'carne') or private.puede_escribir(p_finca, 'hato')) then
    raise exception 'No tienes permiso para esto en esta finca.' using errcode = 'insufficient_privilege';
  end if;
  if p_precio is null or p_precio < 0 or p_precio > 100000000000 then
    raise exception 'El precio no es válido.' using errcode = 'check_violation';
  end if;
  update public.finca_productos set precio_habitual = p_precio where id = p_producto and finca_id = p_finca;
end;
$$;
revoke execute on function public.recordar_precio_producto(uuid, uuid, numeric) from public, anon;
grant execute on function public.recordar_precio_producto(uuid, uuid, numeric) to authenticated;
