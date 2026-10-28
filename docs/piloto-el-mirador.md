# Piloto «Aprisco Piloto El Mirador»

Finca ficticia (Donmatías, Antioquia) cargada en el proyecto de Supabase de Apriscol para mostrar el producto a cualquier productor y auditar el sistema con datos de un año completo (28 oct 2025 → 27 oct 2026). Los generadores están en `supabase/piloto/generador/` (versionados); los volcados `.sql` no se versionan (`.gitignore`).

## Qué contiene

| Área | Contenido |
|---|---|
| Hato | 268 registros (115 activos: cabras de leche, ovejas, machos de ceba), genealogía con casos de endogamia y cuarentena |
| Reproducción | servicios, diagnósticos, partos, lactancias, celos; temporada de monta abierta (2 sementales, 15 hembras) |
| Leche | 16.548 ordeños, 468 despachos en 3 canales, 12 análisis de tanque, 49 controles de calidad, 416 controles de frío (4 desvíos), mantenimiento de la sala |
| Sanidad | 87 eventos, 699 evaluaciones FAMACHA, 58 pruebas de laboratorio, 3 programas futuros |
| Carne y ceba | 673 pesajes, 3 lotes de ceba, 24 canales (rendimiento 49 %), ventas de carne por cortes y canal |
| Dinero | 242 compras, 164 ventas, 66 pagos de nómina, 3 escenarios de proyecciones, 2 ferias con 11 participaciones |
| Equipo | propietario + alias de administrador, veterinario y ordeñador |

## Resultado del año (coincide con `costos_indicadores` y `ventas_por_linea`)

Ingresos $261,4 millones (leche $105,4; derivados $80,9; animales $38,6; carne $36,5) · costos $196,9 millones (compras $107,9; nómina con prestaciones $77,6; animales comprados $11,5) · **resultado +$64,4 millones (24,6 %)**.

Supuestos de precios: leche a $15.000/L en venta directa (25 % del volumen) y $4.000–$5.000/L a industria y quesería; queso $154.000–$158.000/kg (7 L por kg + adicionales + 25 % de margen); carne en canal $50.000/kg y en cortes $90.000–$96.000/kg (rango de mercado $45.000–$135.000).

## Auditoría

**Integridad (sin hallazgos):** ningún ordeño de macho, fuera de lactancia o de animal dado de baja; ninguna leche en retiro sin descartar; ninguna hembra con dos lactancias abiertas; ninguna cría con padres de otra finca; lo despachado (15.189 L) no supera lo ordeñado válido (17.247 L); las cifras de las pantallas coinciden con las sumas directas.

**Seguridad (RLS, 6 usuarios simulados):** una persona ajena a la finca ve 0 filas y no puede insertar; el ordeñador y el veterinario no ven gastos, ventas ni nómina; administrador y propietario ven todo; `admin_resumen()` solo lo pasa el superadministrador.

**Rendimiento — corregido (PR 89, migración `20261027235856`):** las políticas de lectura evaluaban `puede_ver()` por fila (leer 16.548 ordeños: 3,2 s). Ahora usan `fincas_ver()` por conjunto (4 ms). Se añadieron 13 índices en llaves compuestas.

**Producto — corregido (PR 90):** Hato → Ceba mostraba como «Sin lote» a toda cría recién nacida porque el peso al nacer contaba como pesaje.

## Pendientes y límites conocidos

1. Los 12 análisis de calidad de leche tienen ruta de soporte pero **el PDF no existe** en el almacenamiento: abrirlo falla.
2. La curva de ordeño y los pesos son simulaciones (curva por raza y días en leche; crecimiento por edad): la ganancia diaria se ve pareja.
3. Quedan 56 funciones `SECURITY DEFINER` ejecutables por usuarios autenticados (aviso del asesor de Supabase). Las de administración rechazan a quien no es superadministrador; conviene revocar `execute` a `authenticated` en las que son solo de plataforma.
4. Una política de lectura (`controles_calidad`, alterna entre dos módulos) sigue con el patrón por fila; las políticas de escritura no se tocaron.
5. Lote de ceba vacío «Ceba cabritos 2026-3» (creado al probar); se quita con un `delete` en el Editor SQL.
6. Los ajustes posteriores de precios y nómina se aplicaron con `update` directo; si se regenera el piloto desde cero hay que repetirlos.
7. Opcional sin cargar: notas del piloto.

## Cuentas de prueba

Propietario del piloto y tres alias de la misma bandeja (`+admin`, `+vet`, `+ordeno`). Las contraseñas de los alias son aleatorias: se restablecen con «Olvidé mi contraseña». El inicio de sesión de los alias no se ha probado.

## Lista de revisión visual (360 y 320 px, luego computador)

Hoy (cobros y compras vencidas) · Hato (hembra, macho, dado de baja) · Leche (programa, despachos por canal, frío, calidad) · Sanidad y FAMACHA · Ceba (12 animales en el lote abierto) · Costos (Resumen +$64,4 millones, Compras con por pagar y vencida, Ventas, Reportes) · Proyecciones (3 escenarios, Comparar, Riesgos) · Reproducción → Empadronamiento · cada rol con su alias.
