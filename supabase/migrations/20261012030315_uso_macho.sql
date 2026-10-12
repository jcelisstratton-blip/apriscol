-- Para qué es un macho: reproductor (semental) o carne (engorde). Vacío = por definir.
-- Solo aplica a machos; en las hembras la aptitud (leche, carne, ambas) sigue en `vocacion`.
-- (`vocacion` de un macho no se usa: se guarda como «carne» solo porque la columna no admite vacío.)
alter table public.animales add column uso_macho text;
alter table public.animales add constraint animales_uso_macho_ck
  check (uso_macho is null or (sexo = 'macho' and uso_macho in ('reproductor', 'carne')));
