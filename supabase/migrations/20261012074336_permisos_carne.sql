-- Carne: el propietario y el administrador la manejan; el veterinario y el contador pueden verla (peso, retiros, rendimiento).
-- Escribir sigue siendo solo de propietario/administrador: las funciones niegan por defecto.
create or replace function private.puede_ver(p_finca uuid, p_modulo public.modulo_app)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    case private.rol_en(p_finca)
      when 'propietario' then true
      when 'administrador' then true
      when 'ordenador' then p_modulo in ('hato', 'leche')
      when 'veterinario' then p_modulo in ('hato', 'genealogia', 'sanidad', 'reproduccion', 'leche', 'carne')
      when 'contador' then p_modulo in ('hato', 'leche', 'carne', 'contabilidad')
      else false
    end, false);
$$;
