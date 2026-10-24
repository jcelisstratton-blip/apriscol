import { nombreTipo } from "@/lib/animal";
import { edadTexto } from "@/lib/fechas";
import { ETIQUETA_ESTADO } from "@/lib/reproduccion";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, col, hrefAnimal, tituloAnimal, traerTodo, valoresAnimal } from "@/lib/reportes/base";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { EDAD_DESTETE_MESES, compararArete, diasDesde, mesesEntre, promedio } from "@/lib/reportes/calculos";
import { cifra } from "@/lib/reportes/formato";
import { cargarReproBase } from "@/lib/reportes/informes/repro-comun";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { PesoAnimal, ReproHembra } from "@/lib/tipos";

export type DatosVacias = {
  hoy: string;
  situacion: string;
  edadServicioMeses: number;
  ccMinima: number;
  repro: ReproHembra[];
  animales: Map<string, AnimalBase>;
  /** El último peso y condición corporal de cada animal; `null` si la persona no ve esos datos. */
  pesos: Map<string, Pick<PesoAnimal, "ultimo_peso_kg" | "condicion_corporal">> | null;
  truncado: boolean;
};

export type Aptitud = { apta: boolean; motivo: string | null };

/**
 * ¿Está lista para el próximo servicio? Necesita la edad mínima de la finca y, si tiene condición corporal anotada, la mínima también.
 * Una hembra que ya parió es adulta aunque no se sepa su fecha de nacimiento; sin parto y sin fecha no se puede asegurar.
 */
export function aptitudServicio(
  h: { meses: number | null; partos: number | null; cc: number | null },
  edadMinima: number,
  ccMinima: number,
): Aptitud {
  const yaPario = (h.partos ?? 0) > 0;
  if (!yaPario) {
    if (h.meses === null) return { apta: false, motivo: "Falta la fecha de nacimiento" };
    if (h.meses < edadMinima) return { apta: false, motivo: `Menor de ${edadMinima} meses` };
  }
  if (h.cc !== null && h.cc < ccMinima) return { apta: false, motivo: "Condición corporal baja" };
  return { apta: true, motivo: null };
}

/** Las hembras que están disponibles para servir: sin servicio vigente (vacías) o sin ningún dato reproductivo, con los días abiertos y si ya están en condiciones. */
export function construirVacias(d: DatosVacias): ResultadoReporte {
  const candidatas = d.repro
    .filter((r) => r.estado === "vacia" || r.estado === "sin_datos")
    .map((r) => ({ r, a: d.animales.get(r.animal_id)! }))
    .filter(({ a }) => a && a.estado === "activo")
    .map(({ r, a }) => {
      const meses = mesesEntre(a.fecha_nacimiento, d.hoy);
      const peso = d.pesos?.get(r.animal_id);
      const aptitud = aptitudServicio({ meses, partos: r.partos_totales, cc: peso?.condicion_corporal ?? null }, d.edadServicioMeses, d.ccMinima);
      const abiertos = r.ultimo_parto ? diasDesde(r.ultimo_parto, d.hoy) : null;
      return { r, a, meses, peso, aptitud, abiertos };
    })
    // Una cría que aún mama no es candidata a nada.
    .filter((x) => x.meses === null || x.meses >= EDAD_DESTETE_MESES || (x.r.partos_totales ?? 0) > 0);

  const pasa = (x: (typeof candidatas)[number]) =>
    d.situacion === "aptas" ? x.aptitud.apta : d.situacion === "vacia" ? x.r.estado === "vacia" : d.situacion === "sin_datos" ? x.r.estado === "sin_datos" : true;

  const visibles = candidatas
    .filter(pasa)
    .sort((x, y) => Number(y.aptitud.apta) - Number(x.aptitud.apta) || (y.abiertos ?? -1) - (x.abiertos ?? -1) || compararArete(x.a.numero_arete, y.a.numero_arete));

  const filas: FilaReporte[] = visibles.map(({ r, a, peso, aptitud, abiertos }) => ({
    id: a.id,
    titulo: tituloAnimal(a),
    href: hrefAnimal(a.id, "#reproduccion"),
    tono: (aptitud.apta ? "ok" : "aviso") satisfies TonoFila,
    valores: {
      ...valoresAnimal(a),
      tipo: nombreTipo(a.especie, a.sexo),
      edad: a.fecha_nacimiento ? edadTexto(a.fecha_nacimiento, d.hoy) : null,
      estado: ETIQUETA_ESTADO[r.estado],
      partos: r.partos_totales,
      ultimo_parto: r.ultimo_parto,
      dias_abiertos: abiertos,
      lactancia: r.en_lactancia ? "Sí" : "No",
      ...(d.pesos ? { peso: peso?.ultimo_peso_kg ?? null, cc: peso?.condicion_corporal ?? null } : {}),
      monta: r.empadronamiento_nombre,
      situacion: aptitud.apta ? "Lista para servicio" : (aptitud.motivo ?? ""),
    },
  }));

  const aptas = candidatas.filter((x) => x.aptitud.apta).length;
  const indicadores: Indicador[] = [
    { etiqueta: "Disponibles", valor: cifra(candidatas.length) },
    { etiqueta: "Listas para servicio", valor: cifra(aptas) },
    { etiqueta: "Vacías", valor: cifra(candidatas.filter((x) => x.r.estado === "vacia").length) },
    { etiqueta: "Sin datos", valor: cifra(candidatas.filter((x) => x.r.estado === "sin_datos").length) },
    { etiqueta: "En una temporada de monta", valor: cifra(candidatas.filter((x) => x.r.empadronamiento_id).length) },
  ];
  const prom = promedio(candidatas.flatMap((x) => (x.abiertos === null ? [] : [x.abiertos])));
  if (prom !== null) indicadores.push({ etiqueta: "Días abiertos (promedio)", valor: cifra(Math.round(prom)) });

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo", "Tipo", 12),
      col.texto("edad", "Edad", 14),
      col.texto("estado", "Estado", 12),
      col.entero("partos", "Partos", 10),
      col.fecha("ultimo_parto", "Último parto"),
      col.entero("dias_abiertos", "Días abiertos", 14),
      col.texto("lactancia", "En lactancia", 12),
      ...(d.pesos ? [col.decimal("peso", "Último peso (kg)", 14), col.decimal("cc", "Condición corporal", 14)] : []),
      col.texto("monta", "Temporada de monta", 22),
      col.texto("situacion", "Para el servicio", 26, { insignia: true }),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informeVacias(c: ContextoReporte): Promise<ResultadoReporte> {
  const base = await cargarReproBase(c);
  let pesos: DatosVacias["pesos"] = null;
  if (c.puede("carne")) {
    const { filas } = await traerTodo<Pick<PesoAnimal, "animal_id" | "ultimo_peso_kg" | "condicion_corporal">>((d, h) =>
      c.supabase.from("v_peso_animal").select("animal_id, ultimo_peso_kg, condicion_corporal").eq("finca_id", c.fincaId).order("animal_id").range(d, h),
    );
    pesos = new Map(filas.map((p) => [p.animal_id, p]));
  }
  return construirVacias({
    hoy: c.hoy,
    situacion: c.filtros.situacion ?? "todos",
    edadServicioMeses: c.ajustes.general.servicio_edad_min_meses,
    ccMinima: c.ajustes.general.servicio_cc_min,
    repro: base.repro,
    animales: base.animales,
    pesos,
    truncado: base.truncado,
  });
}

