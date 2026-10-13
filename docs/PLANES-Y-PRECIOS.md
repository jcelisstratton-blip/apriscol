# Planes y precios de Apriscol

Los planes viven en `lib/planes.ts` (una sola fuente: la presentación de `/login` y `/registro` los pinta con `components/presentacion/Planes.tsx`).
Precios en **pesos colombianos por mes**; pagando por año, 20 % menos (redondeado a la centena). **No hay plan gratuito.**

> Estado: los planes son **oferta comercial en la presentación**. Todavía no hay cobro ni la aplicación aplica los límites (animales, fincas, usuarios);
> eso es una fase aparte (pasarela de pago + tope por plan + bloqueo de módulos).

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
es un aprisco pequeño y el plan de entrada tiene que ser muy accesible.

**Valor de cada capacidad (de menor a mayor costo de servir y de valor para el criador):**
1. Hato y ficha del animal, leche, sanidad básica → uso diario, poco peso técnico. *(Cría)*
2. Endogamia y genealogía → cálculo recursivo, pero gran valor y diferenciador. *(Cría)*
3. Corrales, monta, FAMACHA, ceba, premios, simulador de cruzas → más tablas, más usuarios activos. *(Hato)*
4. Costos y reportes en Excel por cualquier fecha, costo por animal/lote → consultas pesadas y valor financiero alto. *(Majada)*
5. Varias fincas, equipos grandes, soportes (PDF/foto) y acompañamiento → más almacenamiento y más atención humana. *(Hacienda)*

## 2. Planes

| Plan | Mensual | Anual (por mes) | Límites propuestos | Qué suma |
|---|---|---|---|---|
| **Cría** | $29.900 | $23.900 | 1 finca · 30 animales · 2 usuarios | Hato, genealogía, endogamia, leche, sanidad con retiros, partos, traer animales del libro |
| **Hato** (recomendado) | $59.900 | $47.900 | 1 finca · 100 animales · 4 usuarios | Corrales, monta, FAMACHA/pediluvio, ceba, premios, simulador, gastos y costo por litro |
| **Majada** | $119.900 | $95.900 | 3 fincas · 300 animales · 8 usuarios | Excel por fechas, costo por animal/lote, controles de calidad, soportes de gastos |
| **Hacienda** | $249.900 | $199.900 | 10 fincas · 1.000 animales · 20 usuarios | Soporte prioritario, acompañamiento para cargar la información inicial |

**Referencia de valor:** una finca de 20 cabras en ordeño mueve del orden de 3 millones de pesos al mes en leche; Cría cuesta alrededor del 1 %.
Una finca con corrales, ceba y costos se mueve en el rango de Hato. Los precios son una propuesta: validar con 5 a 10 criadores antes de fijarlos.
