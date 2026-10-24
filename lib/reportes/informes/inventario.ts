import { ETIQUETA_USO_MACHO, ETIQUETA_VOCACION, nombreTipo } from "@/lib/animal";
import { edadTexto } from "@/lib/fechas";
import { ETIQUETA_ESTADO, ETIQUETA_OBSERVACION, enObservacion } from "@/lib/reproduccion";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, cargarAnimales, col, hrefAnimal, pasaEspecie, tituloAnimal, valoresAnimal } from "@/lib/reportes/base";
import { traerTodo } from "@/lib/consultas";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { ETIQUETA_CATEGORIA, ORDEN_CATEGORIA, categoriaAnimal, compararArete } from "@/lib/reportes/calculos";
import type { Categoria } from "@/lib/reportes/calculos";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte } from "@/lib/reportes/tipos";
import type { ReproHembra } from "@/lib/tipos";

export type DatosInventario = {
  hoy: string;
  edadServicioMeses: number;
  categoria: string;
  /** Si la finca tiene las dos especies, se cuentan por separado arriba. */
  dosEspecies: boolean;
  /** Los animales activos que pasan el filtro de especie. */
  animales: AnimalBase[];
  razas: Map<number, string>;
  lotes: Map<string, string>;
  /** Corral o potrero actual de cada animal; `null` si la persona no ve Corrales. */
  corrales: Map<string, string> | null;
  /** Estado reproductivo de cada hembra; `null` si la persona no ve Reproducción. */
  repro: Map<string, ReproHembra> | null;
  truncado: boolean;
};

const textoRepro = (r: ReproHembra) => (enObservacion(r) ? ETIQUETA_OBSERVACION : ETIQUETA_ESTADO[r.estado]);

/** El inventario: cada animal activo con su categoría por edad, su raza, su propósito y, si la persona lo ve, su estado reproductivo y su corral. */
export function construirInventario(d: DatosInventario): ResultadoReporte {
  const conRepro = d.repro !== null;
  const conCorral = d.corrales !== null;

  const todos = d.animales.map((a) => ({ a, categoria: categoriaAnimal(a, d.edadServicioMeses, d.hoy) }));
  const conteo = (c: Categoria) => todos.filter((x) => x.categoria === c).length;

  const visibles = todos
    .filter((x) => d.categoria === "todos" || x.categoria === d.categoria)
    .sort((x, y) => ORDEN_CATEGORIA.indexOf(x.categoria) - ORDEN_CATEGORIA.indexOf(y.categoria) || compararArete(x.a.numero_arete, y.a.numero_arete));

  const filas: FilaReporte[] = visibles.map(({ a, categoria }) => {
    const r = d.repro?.get(a.id);
    return {
      id: a.id,
      titulo: tituloAnimal(a),
      href: hrefAnimal(a.id),
      tono: categoria === "sin_edad" ? "aviso" : "neutro",
      valores: {
        ...valoresAnimal(a),
        tipo: nombreTipo(a.especie, a.sexo),
        categoria: ETIQUETA_CATEGORIA[categoria],
        raza: a.raza_id ? (d.razas.get(a.raza_id) ?? null) : null,
        nacimiento: a.fecha_nacimiento,
        edad: a.fecha_nacimiento ? edadTexto(a.fecha_nacimiento, d.hoy) : null,
        proposito: a.sexo === "hembra" ? ETIQUETA_VOCACION[a.vocacion] : a.uso_macho ? ETIQUETA_USO_MACHO[a.uso_macho] : "Por definir",
        estado_repro: r ? textoRepro(r) : null,
        lactancia: r ? (r.en_lactancia ? "Sí" : "No") : null,
        lote: a.lote_id ? (d.lotes.get(a.lote_id) ?? null) : null,
        corral: d.corrales?.get(a.id) ?? null,
      },
    };
  });

  const indicadores: Indicador[] = [{ etiqueta: "Animales activos", valor: cifra(todos.length) }];
  if (d.dosEspecies) {
    indicadores.push({ etiqueta: "Cabras", valor: cifra(d.animales.filter((a) => a.especie === "caprino").length) }, { etiqueta: "Ovejas", valor: cifra(d.animales.filter((a) => a.especie === "ovino").length) });
  }
  indicadores.push(
    { etiqueta: "Hembras adultas", valor: cifra(conteo("hembra_adulta")) },
    { etiqueta: "Machos adultos", valor: cifra(conteo("macho_adulto")) },
    { etiqueta: "Levante", valor: cifra(conteo("levante")) },
    { etiqueta: "Crías", valor: cifra(conteo("cria")) },
  );
  if (conteo("sin_edad") > 0) indicadores.push({ etiqueta: "Sin fecha de nacimiento", valor: cifra(conteo("sin_edad")), alerta: true });

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo", "Tipo", 12),
      col.texto("categoria", "Categoría", 18, { insignia: true }),
      col.texto("raza", "Raza", 20),
      col.fecha("nacimiento", "Nacimiento"),
      col.texto("edad", "Edad", 14),
      col.texto("proposito", "Propósito", 18),
      ...(conRepro ? [col.texto("estado_repro", "Estado reproductivo", 20), col.texto("lactancia", "En lactancia", 12)] : []),
      col.texto("lote", "Lote", 18),
      ...(conCorral ? [col.texto("corral", "Corral o potrero", 20)] : []),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informeInventario(c: ContextoReporte): Promise<ResultadoReporte> {
  const { lista, truncado } = await cargarAnimales(c);
  const animales = lista.filter((a) => a.estado === "activo" && pasaEspecie(c, a.especie));

  const [razas, lotes, repro, corrales] = await Promise.all([
    c.supabase.from("razas").select("id, nombre").limit(1000),
    c.supabase.from("lotes").select("id, nombre").eq("finca_id", c.fincaId).limit(1000),
    c.puede("reproduccion")
      ? traerTodo<ReproHembra>((d, h) => c.supabase.from("v_repro_hembras").select("*").eq("finca_id", c.fincaId).order("animal_id").range(d, h))
      : Promise.resolve(null),
    c.puede("corrales") ? cargarCorrales(c) : Promise.resolve(null),
  ]);

  return construirInventario({
    hoy: c.hoy,
    edadServicioMeses: c.ajustes.general.servicio_edad_min_meses,
    categoria: c.filtros.categoria ?? "todos",
    dosEspecies: !c.filtros.especie || c.filtros.especie === "todos",
    animales,
    razas: new Map((razas.data ?? []).map((r) => [r.id, r.nombre])),
    lotes: new Map((lotes.data ?? []).map((l) => [l.id, l.nombre])),
    corrales,
    repro: repro ? new Map(repro.filas.map((r) => [r.animal_id, r])) : null,
    truncado,
  });
}

/** El corral o potrero donde está hoy cada animal (el movimiento abierto). */
export async function cargarCorrales(c: Pick<ContextoReporte, "supabase" | "fincaId">): Promise<Map<string, string>> {
  const [ubicaciones, movimientos] = await Promise.all([
    c.supabase.from("ubicaciones").select("id, nombre").eq("finca_id", c.fincaId).limit(1000),
    traerTodo<{ animal_id: string; ubicacion_id: string }>((d, h) =>
      c.supabase.from("movimientos_animales").select("animal_id, ubicacion_id").eq("finca_id", c.fincaId).is("hasta", null).order("animal_id").range(d, h),
    ),
  ]);
  const nombre = new Map((ubicaciones.data ?? []).map((u) => [u.id, u.nombre]));
  const porAnimal = new Map<string, string>();
  for (const m of movimientos.filas) {
    const n = nombre.get(m.ubicacion_id);
    if (n) porAnimal.set(m.animal_id, n);
  }
  return porAnimal;
}
