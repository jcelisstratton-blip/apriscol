-- `empadronamiento_machos.macho_id` puede ser un animal del hato o un semental externo (`externo = true`): ya no es llave foránea a `animales`.
-- La existencia, la finca y la especie las comprueba el disparador `emp_machos_validar`.
alter table public.empadronamiento_machos drop constraint emp_machos_animal_fk;
