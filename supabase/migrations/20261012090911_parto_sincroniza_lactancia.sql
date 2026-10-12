-- Si se corrige la fecha de un parto, la lactancia que abrió (si abrió una) cambia con él: los días de lactancia salen de esa fecha.
create or replace function private.parto_sincroniza_lactancia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.fecha is distinct from old.fecha then
    update public.lactancias set fecha_parto = new.fecha where parto_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function private.parto_sincroniza_lactancia() from public, anon, authenticated;

create or replace trigger partos_sincroniza_lactancia
  after update of fecha on public.partos
  for each row execute function private.parto_sincroniza_lactancia();
