import { nombreTipo } from "@/lib/animal";
import { ETIQUETA_MOTIVO_BAJA, ETIQUETA_TIPO_BAJA } from "@/lib/bajas";
import { COLUMNAS_ANIMAL, NOTA_TRUNCADO, cargarAnimales, col, hrefAnimal, pasaEspecie, tituloAnimal, valoresAnimal } from "@/lib/reportes/base";
import { traerTodo } from "@/lib/consultas";
import type { AnimalBase, ContextoReporte } from "@/lib/reportes/base";
import { suma } from "@/lib/reportes/calculos";
import { cifra } from "@/lib/reportes/formato";
import type { FilaReporte, Indicador, ResultadoReporte, TonoFila } from "@/lib/reportes/tipos";
import type { Baja } from "@/lib/tipos";

export type SalidaBase = Pick<Baja, "id" | "animal_id" | "tipo" | "motivo" | "fecha" | "destino" | "comprador" | "peso_kg" | "valor" | "cobrado_en" | "guia_movilizacion">;

export type DatosSalidas = {
  tipo: string;
  /** Si la persona ve las cuentas de la finca: solo entonces se muestran los valores. */
  conValores: boolean;
  salidas: SalidaBase[];
  animales: Map<string, AnimalBase>;
  especie: (a: AnimalBase) => boolean;
  truncado: boolean;
};

const TONO: Record<Baja["tipo"], TonoFila> = { venta: "ok", muerte: "alerta", sacrificio: "neutro", perdida: "alerta" };

/** Cada animal que salió del hato en el periodo, con el motivo, a quién fue y (si la persona ve las cuentas) cuánto valió. */
export function construirSalidas(d: DatosSalidas): ResultadoReporte {
  const delPeriodo = d.salidas.filter((s) => {
    const a = d.animales.get(s.animal_id);
    return a ? d.especie(a) : true;
  });
  const cuenta = (t: Baja["tipo"]) => delPeriodo.filter((s) => s.tipo === t).length;

  const filas: FilaReporte[] = delPeriodo
    .filter((s) => d.tipo === "todos" || s.tipo === d.tipo)
    .map((s) => {
      const a = d.animales.get(s.animal_id);
      return {
        id: s.id,
        titulo: a ? tituloAnimal(a) : "Animal eliminado",
        href: a ? hrefAnimal(a.id) : undefined,
        tono: TONO[s.tipo],
        valores: {
          ...(a ? valoresAnimal(a) : { arete: null, nombre: null }),
          tipo_animal: a ? nombreTipo(a.especie, a.sexo) : null,
          fecha: s.fecha,
          salida: ETIQUETA_TIPO_BAJA[s.tipo],
          motivo: s.motivo ? ETIQUETA_MOTIVO_BAJA[s.motivo] : null,
          destino: s.comprador || s.destino || null,
          peso: s.peso_kg,
          valor: s.valor,
          cobro: s.tipo === "venta" && s.valor ? (s.cobrado_en ? "Cobrado" : "Por cobrar") : null,
          guia: s.guia_movilizacion,
        },
      };
    });

  const indicadores: Indicador[] = [
    { etiqueta: "Salidas", valor: cifra(delPeriodo.length) },
    { etiqueta: "Ventas", valor: cifra(cuenta("venta")) },
    { etiqueta: "Muertes", valor: cifra(cuenta("muerte")), alerta: cuenta("muerte") > 0 },
    { etiqueta: "Sacrificios", valor: cifra(cuenta("sacrificio")) },
    { etiqueta: "Pérdidas", valor: cifra(cuenta("perdida")), alerta: cuenta("perdida") > 0 },
  ];
  if (d.conValores) {
    const vendido = suma(delPeriodo.filter((s) => s.tipo === "venta").map((s) => Number(s.valor ?? 0)));
    indicadores.push({ etiqueta: "Valor vendido", valor: `$ ${cifra(vendido)}` });
  }

  return {
    columnas: [
      ...COLUMNAS_ANIMAL,
      col.texto("tipo_animal", "Animal", 12),
      col.fecha("fecha", "Fecha"),
      col.texto("salida", "Salida", 14, { insignia: true }),
      col.texto("motivo", "Motivo", 22),
      col.texto("destino", "Comprador o destino", 24),
      col.decimal("peso", "Peso (kg)", 12),
      ...(d.conValores ? [col.pesos("valor", "Valor"), col.texto("cobro", "Cobro", 12)] : []),
      col.texto("guia", "Guía de movilización", 20),
    ],
    filas,
    indicadores,
    notas: d.truncado ? [NOTA_TRUNCADO] : [],
  };
}

export async function informeSalidas(c: ContextoReporte): Promise<ResultadoReporte> {
  const [animales, salidas] = await Promise.all([
    cargarAnimales(c),
    traerTodo<SalidaBase>((d, h) => {
      let q = c.supabase
        .from("bajas")
        .select("id, animal_id, tipo, motivo, fecha, destino, comprador, peso_kg, valor, cobrado_en, guia_movilizacion")
        .eq("finca_id", c.fincaId);
      if (c.rango.desde) q = q.gte("fecha", c.rango.desde);
      if (c.rango.hasta) q = q.lte("fecha", c.rango.hasta);
      return q.order("fecha", { ascending: false }).order("id").range(d, h);
    }),
  ]);
  return construirSalidas({
    tipo: c.filtros.tipo ?? "todos",
    conValores: c.puede("contabilidad"),
    salidas: salidas.filas,
    animales: animales.porId,
    especie: (a) => pasaEspecie(c, a.especie),
    truncado: salidas.truncado || animales.truncado,
  });
}
