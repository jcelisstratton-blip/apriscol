# Planes y precios de Apriscol

Los planes viven en `lib/planes.ts` (una sola fuente: la presentación de `/login` y `/registro` los pinta con `components/presentacion/Planes.tsx`).
**Se cobra por los servicios que incluye cada plan, nunca por número de animales** (decisión del dueño del producto). Precios en **dólares (US$) por mes** (mientras se define la pasarela de pago; la referencia original en pesos era $29.900 / $59.900 / $119.900 / $249.900); pagando por año, 20 % menos (redondeado a la centena). **No hay plan gratuito.**

> Estado: los planes **ya se aplican** (ver «Cómo se aplican»), pero **todavía no hay cobro automático**: no hay pasarela de pago. El propietario pide la mejora
> y el superadmin la activa cuando confirma el pago. No hay topes por animales.

## 1. Valoración de costos (de menor a mayor)

**Costo fijo mensual de operar la plataforma** (precios de lista que conocemos; verificar antes de decidir; TRM de referencia ≈ 4.000 COP/USD):

| Pieza | USD/mes aprox. |
|---|---|
| Supabase Pro (base de datos, autenticación y archivos, `ca-central-1`) | 25 |
| Vercel Pro (1 persona) | 20 |
| Correo transaccional propio (SMTP, pendiente) | 0 – 20 |
| Dominio `apriscol.shop` | ~1,5 |
| **Total** | **≈ 45 – 65 → entre $180.000 y $260.000 COP** |

**Costo variable por finca:** casi nulo. Una finca ocupa unos pocos MB de base de datos; las fotos se reducen en el navegador antes de subir
(unos cientos de KB cada una), y Supabase Pro incluye 100 GB de archivos. Lo que más pesa por finca es el **almacenamiento de fotos y soportes**,
y después los cálculos pesados (endogamia sobre la genealogía y reportes de costos). A la escala actual es del orden de unos pocos miles de pesos al mes por finca.

**Conclusión:** el costo no es lo que fija el precio (la infraestructura se paga con ~5 clientes del plan Hato); lo fija el **valor** que recibe
el criador y lo que puede pagar. Dato real del libro genealógico: 6.632 animales entre 368 titulares ≈ **18 animales por criador**, así que la mayoría
es un aprisco pequeño y el plan de entrada tiene que ser muy accesible; como los animales no se cobran, crecer el hato no encarece la cuenta.

**Valor de cada capacidad (de menor a mayor costo de servir y de valor para el criador):**
1. Hato y ficha del animal, leche, sanidad básica → uso diario, poco peso técnico. *(Cría)*
2. Endogamia y genealogía → cálculo recursivo, pero gran valor y diferenciador. *(Cría)*
3. Equipo con roles, corrales, monta, FAMACHA, premios, simulador de cruzas → más tablas, más usuarios activos. *(Hato)*
4. Cuentas (compras, ventas, por cobrar), personal y nómina, carne y ceba, costos y reportes en Excel, costo por animal/lote, controles de calidad, soportes (PDF/foto) → consultas pesadas y valor financiero alto. *(Profesional)*
5. Soporte prioritario y acompañamiento → más atención humana. *(Hacienda)*

## 2. Planes

| Plan | Mensual | Anual (por mes) | Servicios |
|---|---|---|---|
| **Cría** | US$ 10 | US$ 8 | Hato y ficha con foto y genealogía, endogamia, leche (ordeño y calidad), sanidad con periodos de retiro, servicios y partos, traer animales del libro |
| **Hato** (recomendado) | US$ 18 | US$ 14 | Todo Cría + equipo con roles (ordeñador, veterinario, contador), corrales y potreros, temporada de monta, programas sanitarios con FAMACHA y pediluvio, premios y ferias, simulador de cruzas |
| **Profesional** | US$ 36 | US$ 29 | Todo Hato + compras, ventas y por cobrar, personal y nómina, carne y ceba, costo por litro, por animal, lote y especie, reportes de costos en Excel por fechas, controles de calidad con constancia, soportes de gastos |
| **Hacienda** | US$ 72 | US$ 58 | Todo Profesional + soporte prioritario y acompañamiento para cargar la información inicial |

**Precios siempre en dólares enteros.** Anual: 20 % menos. **Cada finca tiene su plan** y paga por separado; desde la **segunda finca** de un propietario, su plan tiene **10 % menos**
(la primera finca es la más antigua). Los descuentos se aplican uno tras otro y el resultado se redondea al dólar (`precioMes(plan, anual, numeroFinca)`):

| Plan | Mensual, 2.ª finca en adelante | Anual, 2.ª finca en adelante |
|---|---|---|
| Cría | US$ 9 | US$ 7 |
| Hato | US$ 16 | US$ 13 |
| Profesional | US$ 32 | US$ 26 |
| Hacienda | US$ 65 | US$ 52 |

Los precios en US$ son los de la referencia inicial (8 / 15 / 30 / 60) **subidos 20 %**, con Cría redondeado a US$ 10 para no usar fracciones. La fuente es `lib/planes.ts`.

Todos: animales sin límite, cabras y ovejas, celular y computador.

**Referencia de valor:** una finca de 20 cabras en ordeño mueve del orden de 3 millones de pesos al mes en leche; Cría cuesta alrededor del 1 % (a COP ≈ 4.000 por dólar).
Una finca con equipo, corrales, ceba y gastos se mueve en el rango de Hato. Los precios son una propuesta: validar con 5 a 10 criadores antes de fijarlos.

## 3. Cómo se aplican (implementado)

- **Plan de cada finca:** `fincas.plan` (`cria`, `hato`, `profesional`, `hacienda`). Las fincas que ya existían quedaron en Hacienda; **toda finca nueva empieza en Cría**, sin importar
  el plan de las demás (hasta que haya cobro automático, Cría se activa al registrarse). El plan **no se puede cambiar a mano**: un disparador lo impide.
- **Módulos (lo cierra la base):** `private.puede_ver` y `puede_escribir` exigen además que el plan incluya el módulo (`private.modulo_rango`): desde **Hato**, corrales,
  premios y ferias; desde **Profesional**, carne y contabilidad (compras, ventas, personal y costos). Cría tiene hato, genealogía, leche, sanidad y reproducción.
- **Equipo con roles:** desde Hato (disparador sobre `invitaciones`; la pantalla de Equipo muestra el candado).
- **Varias fincas:** sin tope y con cualquier plan: cada una paga el suyo («Agregar otra finca» lleva a crear una finca nueva, que empieza en Cría).
- **Servicios dentro de un módulo (los cierra el servidor y la pantalla, `lib/planes.ts#SERVICIOS_PLAN`):** reportes y Excel de costos, costo por animal/lote/especie,
  controles de calidad con constancia y soportes de gastos desde **Profesional**. Quien pida uno sin plan ve `RequierePlan` con el botón de mejorar.
- **Mejorar mi plan:** `/mas/plan` (menú lateral y «Más», solo propietario y solo si hay un plan superior). Muestra solo planes **hacia adelante** y lo que se suma;
  `solicitar_mejora_plan` guarda la solicitud (una pendiente por finca) y la base vuelve a comprobar que sea un plan superior.
- **Activar (superadmin):** `/admin/planes` lista las solicitudes pendientes (con el número de finca y el precio que corresponde) y «Activar» llama a
  `admin_asignar_plan_finca(finca, plan)`, que cambia el plan de **esa finca** y cierra su solicitud. Si es la primera finca de una persona referida, nace la comisión de referidos.
  `admin_asignar_plan(correo, plan)` (todas las fincas del propietario) queda solo por compatibilidad y no la usa la app.
- **Cuando haya pasarela de pago:** reemplazar el botón «Mejorar a …» por el pago y llamar a la misma activación al confirmarse (webhook).

## 4. Vigencia: qué pasa cuando el plan vence (implementado)

- **Regla:** `fincas.plan_vence_en` es el último día pagado. Faltando 7 días o menos, aviso. Pasada la fecha, **7 días en solo lectura** (se consulta y se descarga, no se registra). Después, **bloqueo**: la app solo muestra
  `/plan-vencido` con el valor del plan, «Renovar un mes / un año» y la descarga de los datos. **Descargar los datos nunca se bloquea y se puede hacer todas las veces que se quiera.**
- **Sin fecha = sin vencimiento:** las fincas que ya existían quedan así hasta que el superadmin les fije la fecha (`/admin/planes` → «Vigencia de los planes»). Una finca nueva nace sin fecha (periodo de prueba: por decidir).
- **Renovar:** el propietario pide la renovación (`solicitar_renovacion_plan`) y el superadmin confirma el pago con `admin_activar_plan_finca(finca, plan, periodo)`: activa el plan y corre la fecha un mes o un año
  **desde el vencimiento actual si todavía no pasó, o desde hoy si ya pasó** (renovar a tiempo no pierde días). La fecha la cambia solo el equipo (disparador sobre `plan_vence_en`).
- **Cuando haya pasarela de pago:** el webhook llama a la misma `admin_activar_plan_finca` al confirmarse el pago.
