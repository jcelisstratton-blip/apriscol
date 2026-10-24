import type { Supuestos } from "@/lib/proyeccion/supuestos";

/**
 * El simulador del hato: mes a mes, con las cohortes de crías, el hato reproductor, la leche, el alimento y el dinero.
 * Es una función pura (mismos números de entrada, mismo resultado): corre igual en el servidor, en el navegador y en las pruebas.
 *
 * La regla que no se rompe: en cada mes, animales al final = animales al inicio + nacimientos − muertes − ventas (incluido el descarte).
 * El paso de una hembra de reemplazo al hato reproductor es un traslado, no cambia el total.
 */

export const DIAS_MES = 30.4;

/** El hato de hoy, ya contado por categoría (lo arma `cargar.ts` con los animales activos). */
export type Inicio = {
  /** Hembras reproductoras. */
  vientres: number;
  /** Machos que ya se sabe que son reproductores (uso «reproductor»). */
  sementales: number;
  /** Machos adultos sin uso definido: solo los que hagan falta se cuentan como sementales; el resto se toma como carne. */
  machosSinUso?: number;
  /** Hembras reproductoras que hoy están en lactancia. */
  lactantes: number;
  /** Los animales jóvenes por edad en meses: los machos se venderán y las hembras se dejan de reemplazo. */
  cohortes: { edad: number; machos: number; hembras: number }[];
  /** Hembras gestantes por mes en que paren (posición 0 = este mes). Las servidas sin diagnóstico van en `servidasPorMes`. */
  gestantesPorMes: number[];
  servidasPorMes: number[];
};

/** La época del año: de qué mes calendario es «hoy» y qué meses son de lluvia (los demás se toman como secos). Sin meses de lluvia no hay efecto. */
export type Estacion = { mesHoy: number; mesesLluvia: number[] };

export type Mes = {
  /** 1 = el mes que viene. */
  n: number;
  /** Es un mes de época seca (según los meses de lluvia de los Ajustes). */
  seco: boolean;
  // Hato (al final del mes)
  vientres: number;
  sementales: number;
  crias: number;
  levante: number;
  total: number;
  // Movimientos del mes
  partos: number;
  nacimientos: number;
  muertes: number;
  ventasAnimales: number;
  /** Del total vendido, las reproductoras de descarte y las hembras de reemplazo que sobraron. */
  ventasAdultas: number;
  kgVendidos: number;
  /** Hembras de reemplazo que pasaron al hato reproductor. */
  entradasVientres: number;
  // Leche
  lactantes: number;
  litros: number;
  // Alimento (toneladas de materia seca en el mes)
  msTotal: number;
  msLevanteYCrias: number;
  msLactancia: number;
  // Dinero
  ingresosCarne: number;
  ingresosLeche: number;
  costoAlimento: number;
  costoAlimentoCeba: number;
  costoAlimentoLactancia: number;
  costoAnimales: number;
  costoFijos: number;
  ingresos: number;
  costos: number;
  flujo: number;
};

export type Aviso = { tipo: "capacidad" | "reemplazo" | "caja" | "partos"; mes: number | null; detalle: string };

export type Proyeccion = {
  meses: Mes[];
  inicio: { vientres: number; sementales: number; crias: number; levante: number; total: number; lactantes: number };
  avisos: Aviso[];
  /** Si las preñeces registradas bastan para proyectar los primeros partos o se usa la tasa de la finca desde el primer mes. */
  partosDesdeRegistro: boolean;
};

type Cohorte = { edad: number; m: number; hv: number; hr: number };

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Meses de gestación que se usan para saber hasta cuándo valen los partos ya registrados. */
export function mesesGestacion(gestacionDias: number) {
  return Math.max(1, Math.ceil(gestacionDias / DIAS_MES));
}

/** Cuántos de los machos de hoy se cuentan como sementales y cuántos se toman como animales de carne (1 semental por cada `hembrasPorSemental` reproductoras). */
export function repartirMachos(inicio: Pick<Inicio, "vientres" | "sementales" | "machosSinUso">, hembrasPorSemental: number): { sementales: number; paraVenta: number } {
  const sinUso = inicio.machosSinUso ?? 0;
  const faltan = Math.max(0, Math.ceil(inicio.vientres / Math.max(1, hembrasPorSemental)) - inicio.sementales);
  const toman = Math.min(sinUso, faltan);
  return { sementales: inicio.sementales + toman, paraVenta: sinUso - toman };
}

export function simular(inicio: Inicio, s: Supuestos, horizonte: number, gestacionDias = 150, estacion?: Estacion): Proyeccion {
  const G = mesesGestacion(gestacionDias);
  const destete = Math.max(1, Math.round(s.destete_meses));
  const edadVenta = Math.max(destete + 1, Math.round(s.edad_venta_meses));
  const edadEntrada = Math.max(edadVenta, Math.round(s.edad_entrada_vientres_meses));
  const lactanciaMeses = Math.max(1, Math.round(s.lactancia_meses));

  const pHembra = s.proporcion_hembras_pct / 100;
  const retencion = s.retencion_hembras_pct / 100;
  const supLact = Math.pow(1 - s.mortalidad_lactancia_pct / 100, 1 / destete);
  const supLev = Math.pow(1 - s.mortalidad_levante_pct / 100, 1 / Math.max(1, edadVenta - destete));
  const mortAdMes = 1 - Math.pow(1 - s.mortalidad_adultos_pct / 100, 1 / 12);
  const descarteMes = 1 - Math.pow(1 - s.descarte_vientres_pct / 100, 1 / 12);
  const tasaPartosMes = s.partos_por_hembra_anio / 12;
  const vientres0 = inicio.vientres;

  // ¿Alcanzan las preñeces registradas para proyectar los primeros partos? Si cubren menos de la cuarta parte de lo esperado, no se confía en ellas.
  const conocidosPorMes = Array.from({ length: G }, (_, i) => (inicio.gestantesPorMes[i] ?? 0) + (inicio.servidasPorMes[i] ?? 0) * (s.prenez_servidas_pct / 100));
  const esperadosVentana = vientres0 * tasaPartosMes * G;
  const partosDesdeRegistro = esperadosVentana > 0 && suma(conocidosPorMes) >= 0.25 * esperadosVentana;

  let cohortes: Cohorte[] = inicio.cohortes
    .filter((c) => c.machos + c.hembras > 0)
    .map((c) => ({ edad: Math.max(0, Math.round(c.edad)), m: c.machos, hv: 0, hr: c.hembras }));

  const { sementales, paraVenta } = repartirMachos(inicio, s.hembras_por_semental);
  // Los machos sin uso que no hacen falta como sementales salen a la venta en el primer mes.
  if (paraVenta > 0) cohortes.push({ edad: edadVenta - 1, m: paraVenta, hv: 0, hr: 0 });

  let V = vientres0;
  const partosPasados: number[] = [];
  const avisos: Aviso[] = [];
  const meses: Mes[] = [];

  const contarCohortes = (cs: Cohorte[]) => {
    let crias = 0;
    let levante = 0;
    for (const c of cs) {
      if (c.edad < destete) crias += c.m + c.hv + c.hr;
      else levante += c.m + c.hv + c.hr;
    }
    return { crias, levante };
  };
  const ini = contarCohortes(cohortes);
  const totalIni = V + sementales + ini.crias + ini.levante;

  for (let t = 1; t <= horizonte; t++) {
    // 1. Partos del mes
    const partos = partosDesdeRegistro && t <= G ? conocidosPorMes[t - 1] ?? 0 : V * tasaPartosMes;
    const nacimientos = partos * s.prolificidad;
    partosPasados.push(partos);

    // 2. Envejecer a las cohortes (las crías nacidas este mes entran después) y aplicar la mortalidad del mes
    let muertes = 0;
    for (const c of cohortes) {
      c.edad += 1;
      const sup = c.edad <= destete ? supLact : supLev;
      const antes = c.m + c.hv + c.hr;
      c.m *= sup;
      c.hv *= sup;
      c.hr *= sup;
      muertes += antes - (c.m + c.hv + c.hr);
    }

    // 3. Ventas de ceba y paso de las hembras de reemplazo al hato reproductor
    let vendidosCeba = 0;
    let ventasAdultas = 0;
    const restantes: Cohorte[] = [];
    let listasReemplazo = 0;
    for (const c of cohortes) {
      if (c.edad >= edadVenta) {
        vendidosCeba += c.m + c.hv;
        c.m = 0;
        c.hv = 0;
      }
      if (c.edad >= edadEntrada) {
        listasReemplazo += c.hr;
        c.hr = 0;
      }
      if (c.m + c.hv + c.hr > 1e-9) restantes.push(c);
    }
    cohortes = restantes;

    // 4. El hato reproductor: muertes, descarte y entradas
    const muertesAd = V * mortAdMes;
    const descartes = V * descarteMes;
    muertes += muertesAd;
    V -= muertesAd + descartes;
    const objetivo = vientres0 * Math.pow(1 + s.crecimiento_hato_pct / 100, t / 12);
    const entran = Math.min(listasReemplazo, Math.max(0, objetivo - V));
    const sobrantes = listasReemplazo - entran;
    V += entran;
    ventasAdultas += descartes + sobrantes;

    // 5. Las crías nacidas este mes
    if (nacimientos > 0) {
      const hembras = nacimientos * pHembra;
      cohortes.push({ edad: 0, m: nacimientos - hembras, hv: hembras * (1 - retencion), hr: hembras * retencion });
    }

    // 6. Hato al final del mes
    const { crias, levante } = contarCohortes(cohortes);
    const total = V + sementales + crias + levante;
    const ventasAnimales = vendidosCeba + ventasAdultas;

    // 7. Leche: las que parieron en los últimos meses de lactancia, más las que hoy están lactando y se van secando
    const recientes = suma(partosPasados.slice(-lactanciaMeses));
    const heredadas = inicio.lactantes * Math.max(0, 1 - t / lactanciaMeses);
    const lactantes = Math.min(V, recientes + heredadas);
    const seco = Boolean(estacion && estacion.mesesLluvia.length > 0 && !estacion.mesesLluvia.includes(((estacion.mesHoy - 1 + t) % 12) + 1));
    const litros = lactantes * (s.hembras_ordenadas_pct / 100) * s.litros_dia * DIAS_MES * (seco ? 1 - s.seca_litros_pct / 100 : 1);

    // 8. Alimento (kg de materia seca por mes) y dinero
    const msVientresSecos = V * s.ms_vientre_seco;
    const msExtraLactancia = lactantes * Math.max(0, s.ms_vientre_lactando - s.ms_vientre_seco);
    const msCeba = crias * s.ms_cria + levante * s.ms_levante;
    const msDia = msVientresSecos + msExtraLactancia + msCeba + sementales * s.ms_semental;
    const msMes = msDia * DIAS_MES;
    const kgVendidos = vendidosCeba * s.peso_venta_kg + descartes * s.peso_descarte_kg + sobrantes * s.peso_descarte_kg;
    const ingresosCarne =
      vendidosCeba * s.peso_venta_kg * s.precio_kg_vivo +
      descartes * s.peso_descarte_kg * s.precio_kg_vivo * (1 - s.castigo_descarte_pct / 100) +
      sobrantes * s.peso_descarte_kg * s.precio_kg_vivo;
    const ingresosLeche = litros * s.precio_litro;
    const precioMs = s.costo_kg_ms * (seco ? 1 + s.seca_costo_alimento_pct / 100 : 1);
    const costoAlimento = msMes * precioMs;
    const costoAlimentoCeba = msCeba * DIAS_MES * precioMs;
    const costoAlimentoLactancia = msExtraLactancia * DIAS_MES * precioMs;
    const costoAnimales = total * s.costo_animal_mes;
    const costoFijos = s.costos_fijos_mes;
    const ingresos = ingresosCarne + ingresosLeche;
    const costos = costoAlimento + costoAnimales + costoFijos;

    meses.push({
      n: t,
      seco,
      vientres: V,
      sementales,
      crias,
      levante,
      total,
      partos,
      nacimientos,
      muertes,
      ventasAnimales,
      ventasAdultas,
      kgVendidos,
      entradasVientres: entran,
      lactantes,
      litros,
      msTotal: msMes / 1000,
      msLevanteYCrias: (msCeba * DIAS_MES) / 1000,
      msLactancia: (msExtraLactancia * DIAS_MES) / 1000,
      ingresosCarne,
      ingresosLeche,
      costoAlimento,
      costoAlimentoCeba,
      costoAlimentoLactancia,
      costoAnimales,
      costoFijos,
      ingresos,
      costos,
      flujo: ingresos - costos,
    });
  }

  // Avisos
  const cap = s.capacidad_max_animales;
  if (cap > 0) {
    const primero = meses.find((m) => m.total > cap);
    if (primero) {
      const pico = meses.reduce((a, m) => (m.total > a.total ? m : a), meses[0]);
      avisos.push({ tipo: "capacidad", mes: primero.n, detalle: `Desde el mes ${primero.n} hay más animales (${Math.round(primero.total)}) de los que caben (${Math.round(cap)}); el pico llega a ${Math.round(pico.total)} en el mes ${pico.n}.` });
    }
  }
  const objetivoFinal = vientres0 * Math.pow(1 + s.crecimiento_hato_pct / 100, horizonte / 12);
  const ultimo = meses[meses.length - 1];
  if (ultimo && vientres0 > 0 && ultimo.vientres < objetivoFinal * 0.95) {
    avisos.push({ tipo: "reemplazo", mes: null, detalle: `Las hembras de reemplazo no alcanzan: las reproductoras bajan de ${Math.round(vientres0)} a ${Math.round(ultimo.vientres)} en vez de llegar a ${Math.round(objetivoFinal)}. Sube el porcentaje de hembras que dejas de reemplazo.` });
  }
  const negativo = meses.filter((m) => m.flujo < 0).length;
  if (negativo > 0) avisos.push({ tipo: "caja", mes: meses.find((m) => m.flujo < 0)?.n ?? null, detalle: `En ${negativo} de los ${horizonte} meses los costos superan a los ingresos.` });
  if (!partosDesdeRegistro && vientres0 > 0) {
    avisos.push({ tipo: "partos", mes: null, detalle: "Hay pocas preñeces registradas, así que los partos de los primeros meses se calculan con la tasa de partos de tu finca y no con las fechas previstas." });
  }

  return {
    meses,
    inicio: { vientres: vientres0, sementales, crias: ini.crias, levante: ini.levante, total: totalIni, lactantes: inicio.lactantes },
    avisos,
    partosDesdeRegistro,
  };
}

/** Un bloque de meses sumado (un año, o el horizonte entero) para el resumen. */
export type Bloque = {
  etiqueta: string;
  desde: number;
  hasta: number;
  nacimientos: number;
  muertes: number;
  ventasAnimales: number;
  kgVendidos: number;
  litros: number;
  msTotal: number;
  ingresosCarne: number;
  ingresosLeche: number;
  costoAlimento: number;
  costoAlimentoCeba: number;
  costoAlimentoLactancia: number;
  costoAnimales: number;
  costoFijos: number;
  ingresos: number;
  costos: number;
  flujo: number;
  /** Hato al final del bloque. */
  vientres: number;
  total: number;
};

export function porAnio(p: Proyeccion): Bloque[] {
  const bloques: Bloque[] = [];
  for (let desde = 1; desde <= p.meses.length; desde += 12) {
    const hasta = Math.min(p.meses.length, desde + 11);
    const m = p.meses.slice(desde - 1, hasta);
    const s = (f: (x: Mes) => number) => suma(m.map(f));
    bloques.push({
      etiqueta: bloques.length === 0 ? "Primer año" : bloques.length === 1 ? "Segundo año" : "Tercer año",
      desde,
      hasta,
      nacimientos: s((x) => x.nacimientos),
      muertes: s((x) => x.muertes),
      ventasAnimales: s((x) => x.ventasAnimales),
      kgVendidos: s((x) => x.kgVendidos),
      litros: s((x) => x.litros),
      msTotal: s((x) => x.msTotal),
      ingresosCarne: s((x) => x.ingresosCarne),
      ingresosLeche: s((x) => x.ingresosLeche),
      costoAlimento: s((x) => x.costoAlimento),
      costoAlimentoCeba: s((x) => x.costoAlimentoCeba),
      costoAlimentoLactancia: s((x) => x.costoAlimentoLactancia),
      costoAnimales: s((x) => x.costoAnimales),
      costoFijos: s((x) => x.costoFijos),
      ingresos: s((x) => x.ingresos),
      costos: s((x) => x.costos),
      flujo: s((x) => x.flujo),
      vientres: m[m.length - 1].vientres,
      total: m[m.length - 1].total,
    });
  }
  return bloques;
}

/** Cierra la ecuación de balance de cada mes; devuelve la mayor diferencia (debe ser ~0). Es la prueba de que el simulador no inventa ni pierde animales. */
export function descuadreBalance(p: Proyeccion): number {
  let previo = p.inicio.total;
  let peor = 0;
  for (const m of p.meses) {
    const esperado = previo + m.nacimientos - m.muertes - m.ventasAnimales;
    peor = Math.max(peor, Math.abs(esperado - m.total));
    previo = m.total;
  }
  return peor;
}
