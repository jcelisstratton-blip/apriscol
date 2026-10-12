-- El umbral estricto es 1/32 = 0,03125 (la endogamia de un cruce en el que el padre y la madre comparten un bisabuelo). Con
-- cuatro decimales se guardaba como 0,0313 y un animal con 3,125 % quedaba «por debajo» de un umbral de 3,13 %. Se agrega un decimal.
alter table public.fincas alter column umbral_endogamia type numeric(6, 5);
update public.fincas set umbral_endogamia = 0.03125 where umbral_endogamia = 0.0313;
