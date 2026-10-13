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
3. Corrales, monta, FAMACHA, ceba, premios, simulador de cruzas → más tablas, más usuarios activos. *(Hato)*
4. Costos y reportes en Excel por cualquier fecha, costo por animal/lote → consultas pesadas y valor financiero alto. *(Profesional)*
5. Varias fincas, equipos grandes, soportes (PDF/foto) y acompañamiento → más almacenamiento y más atención humana. *(Hacienda)*

## 2. Planes

| Plan | Mensual | Anual (por mes) | Servicios |
|---|---|---|---|
| **Cría** | US$ 8 | US$ 6,40 | Hato y ficha con foto y genealogía, endogamia, leche (ordeño y calidad), sanidad con periodos de retiro, servicios y partos, traer animales del libro |
| **Hato** (recomendado) | US$ 15 | US$ 12 | Todo Cría + equipo con roles (ordeñador, veterinario, contador), corrales y potreros, temporada de monta, programas sanitarios con FAMACHA y pediluvio, carne y ceba, premios y ferias, simulador de cruzas, gastos y costo por litro |
| **Profesional** | US$ 30 | US$ 24 | Todo Hato + reportes de costos en Excel por fechas, costo por animal, lote y especie, controles de calidad con constancia, soportes de gastos |
| **Hacienda** | US$ 60 | US$ 48 | Todo Profesional + varias fincas en una sola cuenta, soporte prioritario, acompañamiento para cargar la información inicial |

Todos: animales sin límite, cabras y ovejas, celular y computador.

**Referencia de valor:** una finca de 20 cabras en ordeño mueve del orden de 3 millones de pesos al mes en leche; Cría cuesta alrededor del 1 %.
Una finca con equipo, corrales, ceba y gastos se mueve en el rango de Hato. Los precios son una propuesta: validar con 5 a 10 criadores antes de fijarlos.

## 3. Cómo se aplican (implementado)

- **Plan de cada finca:** `fincas.plan` (`cria`, `hato`, `profesional`, `hacienda`). Las fincas que ya existían quedaron en Hacienda; una finca nueva empieza en **Cría**
  (hasta que haya cobro automático, Cría se activa al registrarse). El plan **no se puede cambiar a mano**: un disparador lo impide.
- **Módulos (lo cierra la base):** `private.puede_ver` y `puede_escribir` exigen además que el plan incluya el módulo (`private.modulo_rango`): desde **Hato**, corrales,
  carne, premios y ferias, y contabilidad (gastos). Cría tiene hato, genealogía, leche, sanidad y reproducción.
- **Equipo con roles:** desde Hato (disparador sobre `invitaciones`; la pantalla de Equipo muestra el candado).
- **Varias fincas:** solo con Hacienda (disparador sobre `fincas`; una finca nueva hereda el plan; «Agregar otra finca» lleva a mejorar si no aplica).
- **Servicios dentro de un módulo (los cierra el servidor y la pantalla, `lib/planes.ts#SERVICIOS_PLAN`):** reportes y Excel de costos, costo por animal/lote/especie,
  controles de calidad con constancia y soportes de gastos desde **Profesional**. Quien pida uno sin plan ve `RequierePlan` con el botón de mejorar.
- **Mejorar mi plan:** `/mas/plan` (menú lateral y «Más», solo propietario y solo si hay un plan superior). Muestra solo planes **hacia adelante** y lo que se suma;
  `solicitar_mejora_plan` guarda la solicitud (una pendiente por finca) y la base vuelve a comprobar que sea un plan superior.
- **Activar (superadmin):** `/admin/planes` lista las solicitudes pendientes y «Activar» llama a `admin_asignar_plan(correo, plan)`, que cambia el plan de todas las
  fincas de ese propietario y cierra la solicitud. También se puede con SQL: `select public.admin_asignar_plan('correo', 'hato');`.
- **Cuando haya pasarela de pago:** reemplazar el botón «Mejorar a …» por el pago y llamar a la misma activación al confirmarse (webhook).
