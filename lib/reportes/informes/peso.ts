import { nombreTipo } from "@/lib/animal";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, cargarAnimales, col, hrefAnimal, pasaEspecie, tituloAnimal, valoresAnimal } from "@/lib/reportes/base";
import { traerTodo } from "@/lib/consultas";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { CC_ALTA, CC_BAJA, DIAS_SIN_PESAR, ETIQUETA_CATEGORIA, bandaCondicion, categoriaAnimal, compararArete, gananciaDiariaG, promedio } from "@/lib/reportes/calculos";
import { diasDesde } from "@/lib/fechas";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { PesoAnimal } from "@/lib/tipos";

export type DatosPeso = {
  hoy: string;
  alerta: string;
  edadServicioMeses: number;
  /** Ganancia diaria mínima de las crías y el levante (gramos por día), de los Ajustes. */
  gdpMinimaG: number;
  animales: AnimalBase[];
  pesos: Map<string, PesoAnimal>;
  truncado: boolean;
};

type Alerta = "cc_baja" | "cc_alta" | "sin_pesar" | "gdp_baja" | "sin_pesaje";
const TEXTO_ALERTA: Record<Alerta, string> = {
  cc_baja: "Condición corporal baja",
  cc_alta: "Condición corporal alta",
  sin_pesar: "Hace tiempo sin pesar",
  gdp_baja: "Crece poco",
  sin_pesaje: "Nunca se ha pesado",
};
const GRAVEDAD: Alerta[] = ["cc_baja", "gdp_baja", "sin_pesaje", "sin_pesar", "cc_alta"];

/** Cada animal activo con su último peso, cuánto gana por día y qué alertas tiene (flaco, engrasado, crece poco, hace tiempo sin pesar o nunca pesado). */
export function construirPeso(d: DatosPeso): ResultadoReporte {
  const todos = d.animales.map((a) => {
    const p = d.pesos.get(a.id);
    const categoria = categoriaAnimal(a, d.edadServicioMeses, d.hoy);
    const gdp = p ? gananciaDiariaG({ fecha: p.ultima_fecha, kg: Number(p.ultimo_peso_kg) }, p.anterior_fecha && p.anterior_peso_kg !== null ? { fecha: p.anterior_fecha, kg: Number(p.anterior_peso_kg) } : null) : null;
    const dias = p ? diasDesde(p.ultima_fecha, d.hoy) : null;
    const cc = p?.condicion_corporal ?? null;
    const alertas: Alerta[] = [];
    if (!p) alertas.push("sin_pesaje");
    else if (dias !== null && dias > DIAS_SIN_PESAR) alertas.push("sin_pesar");
    if (cc !== null && bandaCondicion(cc) === "baja") alertas.push("cc_baja");
    if (cc !== null && bandaCondicion(cc) === "alta") alertas.push("cc_alta");
    // La ganancia mínima es la de los que crecen: una hembra adulta no tiene por qué ganar peso cada día.
    if (gdp !== null && (categoria === "cria" || categoria === "levante") && gdp < d.gdpMinimaG) alertas.push("gdp_baja");
    alertas.sort((x, y) => GRAVEDAD.indexOf(x) - GRAVEDAD.indexOf(y));
    return { a, p, categoria, gdp, dias, cc, alertas };
  });

  const visibles = todos
    .filter((x) => d.alerta === "todos" || x.alertas.includes(d.alerta as Alerta))
    .sort((x, y) => (x.alertas.length ? GRAVEDAD.indexOf(x.alertas[0]) : 99) - (y.alertas.length ? GRAVEDAD.indexOf(y.alertas[0]) : 99) || compararArete(x.a.numero_arete, y.a.numero_arete));

  const filas: FilaReporte[] = visibles.map((x) => {
    const tono: TonoFila = x.alertas.length === 0 ? "ok" : x.alertas[0] === "cc_baja" || x.alertas[0] === "gdp_baja" ? "alerta" : "aviso";
    return {
      id: x.a.id,
      titulo: tituloAnimal(x.a),
      href: hrefAnimal(x.a.id, "#crecimiento"),
      tono,
      valores: {
        ...valoresAnimal(x.a),
        tipo: nombreTipo(x.a.especie, x.a.sexo),
        categoria: ETIQUETA_CATEGORIA[x.categoria],
        ultimo_peso: x.p ? Number(x.p.ultimo_peso_kg) : null,
        fecha_peso: x.p?.ultima_fecha ?? null,
        dias_sin_pesar: x.dias,
        gdp: x.gdp,
        cc: x.cc,
        fecha_cc: x.p?.fecha_condicion ?? null,
        pesajes: x.p?.pesajes ?? 0,
        alerta: x.alertas.length ? x.alertas.map((a) => TEXTO_ALERTA[a]).join(" · ") : "Al día",
      },
    };
  });

  const conPeso = todos.filter((x) => x.p);
  const cuenta = (a: Alerta) => todos.filter((x) => x.alertas.includes(a)).length;
  const pesoMedio = promedio(conPeso.map((x) => Number(x.p!.ultimo_peso_kg)));
  const ccMedia = promedio(todos.flatMap((x) => (x.cc === null ? [] : [x.cc])));
  const indicadores: Indicador[] = [
    { etiqueta: "Animales activos", valor: cifra(todos.length) },
    { etiqueta: "Con pesaje", valor: cifra(conPeso.length) },
    { etiqueta: "Peso promedio", valor: pesoMedio === null ? "—" : `${cifra(pesoMedio, 1)} kg` },
    { etiqueta: "Condición corporal promedio", valor: ccMedia === null ? "—" : cifra(ccMedia, 1), detalle: `Ideal entre ${String(CC_BAJA).replace(".", ",")} y ${String(CC_ALTA).replace(".", ",")}` },
    { etiqueta: "Flacos", valor: cifra(cuenta("cc_baja")), alerta: cuenta("cc_baja") > 0 },
    { etiqueta: "Crecen poco", valor: cifra(cuenta("gdp_baja")), alerta: cuenta("gdp_baja") > 0 },
    { etiqueta: `Sin pesar hace más de ${DIAS_SIN_PESAR} días`, valor: cifra(cuenta("sin_pesar")) },
    { etiqueta: "Nunca pesados", valor: cifra(cuenta("sin_pesaje")) },
  ];

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo", "Tipo", 12),
      col.texto("categoria", "Categoría", 16),
      col.decimal("ultimo_peso", "Último peso (kg)", 14),
      col.fecha("fecha_peso", "Fecha del peso"),
      col.entero("dias_sin_pesar", "Días sin pesar", 12),
      col.entero("gdp", "Ganancia diaria (g)", 14),
      col.decimal("cc", "Condición corporal", 14),
      col.fecha("fecha_cc", "Fecha de la condición"),
      col.entero("pesajes", "Pesajes", 9),
      col.texto("alerta", "Alertas", 30, { insignia: true }),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informePeso(c: ContextoReporte): Promise<ResultadoReporte> {
  const [animales, pesos] = await Promise.all([
    cargarAnimales(c),
    traerTodo<PesoAnimal>((d, h) => c.supabase.from("v_peso_animal").select("*").eq("finca_id", c.fincaId).order("animal_id").range(d, h)),
  ]);
  return construirPeso({
    hoy: c.hoy,
    alerta: c.filtros.alerta ?? "todos",
    edadServicioMeses: c.ajustes.general.servicio_edad_min_meses,
    gdpMinimaG: c.ajustes.general.gdp_minima_g,
    animales: animales.lista.filter((a) => a.estado === "activo" && pasaEspecie(c, a.especie)),
    pesos: new Map(pesos.filas.map((p) => [p.animal_id, p])),
    truncado: animales.truncado || pesos.truncado,
  });
}
