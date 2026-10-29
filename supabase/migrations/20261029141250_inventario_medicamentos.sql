-- Inventario de medicamentos y vacunas (primera entrega del inventario de bodega).
-- Lo que se guarda son solo los CONTEOS de la persona: la apertura (cuánto hay hoy de cada producto, con su lote) y los ajustes (mermas, vencidos, correcciones).
-- El stock se CALCULA: conteos + compras (gastos con producto veterinario × contenido de la presentación) − aplicaciones (dosis × animales × días) desde la fecha de apertura.
-- Así editar o eliminar una compra o una aplicación corrige el stock solo, y no hay dos fuentes de verdad.

-- 1. El módulo: desde el plan Intermedio (como «nutricion», alimentación e inventarios). Espejo: lib/planes.ts#moduloEnPlan.
create or replace function private.modulo_rango(p_modulo public.modulo_app)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_modulo in ('carne', 'contabilidad', 'proyecciones') then 3
    when p_modulo in ('corrales', 'ferias', 'nutricion', 'ambiente', 'inventario') then 2
    else 1
  end;
$$;

-- 2. Quién ve y quién escribe: propietario y administrador gestionan; el veterinario ve (lo que necesita para aplicar). Espejo: lib/permisos.ts.
create or replace function private.puede_ver(p_finca uuid, p_modulo public.modulo_app) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo in ('hato', 'leche', 'novedades')
      when 'veterinario' then p_modulo in ('hato', 'genealogia', 'sanidad', 'reproduccion', 'leche', 'carne', 'corrales', 'novedades', 'inventario')
      when 'contador' then p_modulo in ('hato', 'leche', 'carne', 'contabilidad')
      else false
    end, false)
  and coalesce(private.plan_rango(private.plan_de(p_finca)), 0) >= private.modulo_rango(p_modulo);
$$;

-- 3. Cómo se cuenta cada producto: en la unidad de su dosis (ml, dosis, tableta…). La presentación dice cuánto trae una (ej. frasco = 100 ml).
alter table public.productos_veterinarios
  add column presentacion text check (presentacion is null or char_length(btrim(presentacion)) between 1 and 30),
  add column contenido_presentacion numeric(12, 2) check (contenido_presentacion is null or (contenido_presentacion > 0 and contenido_presentacion <= 1000000)),
  add column stock_minimo numeric(12, 2) check (stock_minimo is null or (stock_minimo >= 0 and stock_minimo <= 100000000));

-- 4. Los conteos. «apertura»: lo que hay al empezar (cantidad ≥ 0, una vez por producto y lote). «ajuste»: suma o resta con signo (conteo físico, vencido, pérdida…).
create table public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references public.fincas (id) on delete cascade,
  producto_vet_id uuid not null,
  tipo text not null check (tipo in ('apertura', 'ajuste')),
  fecha date not null,
  cantidad numeric(14, 2) not null check (cantidad between -100000000 and 100000000),
  lote text check (lote is null or char_length(btrim(lote)) between 1 and 60),
  vencimiento date,
  motivo text check (motivo is null or motivo in ('conteo', 'vencido', 'perdida', 'dano', 'otro')),
  observaciones text check (observaciones is null or char_length(observaciones) <= 300),
  client_request_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, finca_id),
  constraint inventario_mov_producto_fk foreign key (producto_vet_id, finca_id) references public.productos_veterinarios (id, finca_id) on delete cascade,
  constraint inventario_mov_cantidad_ck check ((tipo = 'apertura' and cantidad >= 0 and motivo is null) or (tipo = 'ajuste' and cantidad <> 0 and motivo is not null))
);
create unique index inventario_apertura_uk on public.inventario_movimientos (finca_id, producto_vet_id, coalesce(lote, '')) where tipo = 'apertura';
create unique index inventario_mov_client_req_uk on public.inventario_movimientos (finca_id, client_request_id) where client_request_id is not null;
create index inventario_mov_producto_idx on public.inventario_movimientos (finca_id, producto_vet_id, fecha desc);
create trigger inventario_movimientos_updated_at before update on public.inventario_movimientos
  for each row execute function private.set_updated_at();

select private.crear_politicas_finca('inventario_movimientos', 'inventario');
grant select, insert, update, delete on public.inventario_movimientos to authenticated;

-- 5. El cálculo, por producto y lote. Solo cuenta lo que pasa desde la fecha de apertura de cada producto. Interno: lo llaman las dos funciones de abajo.
create or replace function private.inventario_calculo(p_finca uuid)
returns table (producto_id uuid, lote text, vencimiento date, stock numeric, desde date)
language sql stable security definer set search_path = ''
as $$
  with desde as (
    select m.producto_vet_id as producto_id, min(m.fecha) as desde
      from public.inventario_movimientos m
     where m.finca_id = p_finca and m.tipo = 'apertura'
     group by 1),
  conteos as (
    select m.producto_vet_id as producto_id, m.lote, max(m.vencimiento) as vencimiento, sum(m.cantidad) as cant
      from public.inventario_movimientos m
     where m.finca_id = p_finca
     group by 1, 2),
  compras as (
    select g.producto_vet_id as producto_id, g.lote_producto as lote, max(g.lote_vencimiento) as vencimiento,
           sum(coalesce(g.cantidad, 0) * coalesce(p.contenido_presentacion, 0)) as cant
      from public.gastos g
      join desde d on d.producto_id = g.producto_vet_id and g.fecha >= d.desde
      join public.productos_veterinarios p on p.id = g.producto_vet_id and p.finca_id = g.finca_id
     where g.finca_id = p_finca
     group by 1, 2),
  salidas as (
    select e.producto_id, e.lote_producto as lote,
           sum(e.dosis * coalesce(e.dias_tratamiento, 1) * (select count(*) from public.evento_sanitario_animales a where a.evento_id = e.id and a.finca_id = e.finca_id)) as cant
      from public.eventos_sanitarios e
      join desde d on d.producto_id = e.producto_id and e.fecha >= d.desde
     where e.finca_id = p_finca and e.dosis is not null
     group by 1, 2),
  todo as (
    select producto_id, lote, vencimiento, cant from conteos
    union all select producto_id, lote, vencimiento, cant from compras
    union all select producto_id, lote, null::date, -cant from salidas)
  select t.producto_id, t.lote, max(t.vencimiento), sum(t.cant), d.desde
    from todo t
    join desde d on d.producto_id = t.producto_id
   group by t.producto_id, t.lote, d.desde;
$$;
revoke execute on function private.inventario_calculo(uuid) from public, anon, authenticated;

-- 6. Lo que ve la pantalla. Corren con permisos propios porque quien aplica (el veterinario) debe ver el stock sin ver las compras (precios, proveedores).
create or replace function public.inventario_productos(p_finca uuid)
returns table (
  producto_id uuid, nombre text, tipo text, unidad text, presentacion text, contenido_presentacion numeric, stock_minimo numeric,
  desde date, stock numeric, vence_pronto date, compras_sin_calcular integer, aplicaciones_sin_dosis integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.puede_ver(p_finca, 'inventario') then
    raise exception 'No tienes permiso para ver el inventario de esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select p.id, p.nombre, p.tipo, p.unidad_dosis, p.presentacion, p.contenido_presentacion, p.stock_minimo,
           c.desde, c.stock, c.vence_pronto,
           case when c.desde is null then 0 else (
             select count(*)::integer from public.gastos g
              where g.finca_id = p.finca_id and g.producto_vet_id = p.id and g.fecha >= c.desde and (g.cantidad is null or p.contenido_presentacion is null)) end,
           case when c.desde is null then 0 else (
             select count(*)::integer from public.eventos_sanitarios e
              where e.finca_id = p.finca_id and e.producto_id = p.id and e.fecha >= c.desde and e.dosis is null) end
      from public.productos_veterinarios p
      left join (
        select k.producto_id, k.desde, sum(k.stock) as stock, min(k.vencimiento) filter (where k.stock > 0) as vence_pronto
          from private.inventario_calculo(p_finca) k
         group by k.producto_id, k.desde) c on c.producto_id = p.id
     where p.finca_id = p_finca and p.activo
     order by p.nombre;
end
$$;
revoke execute on function public.inventario_productos(uuid) from public, anon;
grant execute on function public.inventario_productos(uuid) to authenticated;

create or replace function public.inventario_lotes(p_finca uuid, p_producto uuid)
returns table (lote text, vencimiento date, stock numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.puede_ver(p_finca, 'inventario') then
    raise exception 'No tienes permiso para ver el inventario de esta finca.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select k.lote, k.vencimiento, k.stock
      from private.inventario_calculo(p_finca) k
     where k.producto_id = p_producto
     order by k.vencimiento nulls last, k.lote nulls last;
end
$$;
revoke execute on function public.inventario_lotes(uuid, uuid) from public, anon;
grant execute on function public.inventario_lotes(uuid, uuid) to authenticated;
