-- «Empadronamiento» pasa a llamarse «empadre» en todo lo que lee una persona (en otros países «empadronamiento» es el censo de habitantes).
-- Esta migración cambia solo el TEXTO de los mensajes de error de las funciones y disparadores del empadre (`raise exception '…'`): ni los nombres de
-- tablas, columnas o funciones ni la lógica cambian. Reescribe la definición actual de cada función con `pg_get_functiondef`, así conserva sus permisos
-- y su configuración. Retrocompatible: la app solo muestra el mensaje.
do $$
declare
  f record;
  def text;
  nuevo text;
begin
  for f in
    select p.oid
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname in ('public', 'private') and p.prosrc ~* 'raise exception ''[^'']*empadronamiento'
  loop
    def := pg_get_functiondef(f.oid);
    -- Se repite hasta que no cambie nada (un mensaje puede nombrarlo más de una vez); la inicial en mayúscula se conserva.
    loop
      nuevo := regexp_replace(def, '([Rr]aise exception ''[^'']*?)Empadronamiento(s?)', '\1Empadre\2');
      nuevo := regexp_replace(nuevo, '([Rr]aise exception ''[^'']*?)empadronamiento(s?)', '\1empadre\2');
      exit when nuevo = def;
      def := nuevo;
    end loop;
    execute def;
  end loop;
end
$$;
