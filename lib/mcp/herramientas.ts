import { z } from "zod";
import { puedeVer } from "@/lib/permisos";
import { ETIQUETA_AREA, areasSemaforo, contarSenales, type AreaSemaforo, type Senal } from "@/lib/semaforos";
import type { Totales } from "@/lib/leche";
import { variacion } from "@/lib/leche";
import type { PlanId, RolFinca } from "@/lib/tipos";
import { ErrorHerramienta, type Herramienta } from "@/lib/mcp/protocolo";
import { alcanceDelPlan, areasFueraDelPlan, mensajeFueraDelPlan } from "@/lib/mcp/plan";

/** Quién consulta y desde qué finca. Lo arma el servidor con el token y la base: el asistente nunca elige la finca ni el rol. */
export type ContextoMcp = { fincaNombre: string; rol: RolFinca; plan: PlanId; hoy: string; moneda: string };

export type AnimalEncontrado = { etiqueta: string; tipo: string; estado: string; nacimiento: string | null };
export type LecheConsultada = { desde: string; hasta: string; dias: number; totales: Totales; previo: Totales | null };

/** Lo que las herramientas necesitan leer. Cada función corre bajo la sesión de la persona (RLS), así que solo devuelve lo que su rol puede ver. */
export type Datos = {
  senales: () => Promise<Senal[]>;
  buscarAnimales: (texto: string) => Promise<AnimalEncontrado[]>;
  leche: (dias: number) => Promise<LecheConsultada>;
};

const AREAS = Object.keys(ETIQUETA_AREA) as [AreaSemaforo, ...AreaSemaforo[]];
const redondear = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const json = (o: unknown) => JSON.stringify(o);

/** Una señal en forma compacta para el asistente: qué es, qué significa, qué hacer y los primeros casos. */
export function senalCompacta(s: Senal, casos: number) {
  return {
    area: ETIQUETA_AREA[s.area],
    titulo: s.titulo,
    nivel: s.nivel,
    resumen: s.resumen,
    que_significa: s.queSignifica,
    que_hacer: s.queHacer,
    casos_total: s.items.length,
    casos: s.items.slice(0, casos).map((i) => ({ nombre: i.etiqueta, nivel: i.nivel, detalle: i.detalle, que_hacer: i.queHacer ?? null })),
  };
}

export function herramientasPara(ctx: ContextoMcp, datos: Datos): Herramienta[] {
  const lista: Herramienta[] = [];
  const areas = areasSemaforo(ctx.rol, ctx.plan);

  if (areas.length > 0) {
    lista.push({
      nombre: "resumen_de_hoy",
      titulo: "Resumen de hoy",
      descripcion:
        "Qué pide atención hoy en la finca: cuántas señales hay en rojo (actuar hoy), ámbar (programar) y en orden, y las más urgentes con sus primeros casos. Es el mejor punto de partida. Solo muestra las áreas que le tocan al rol de la persona.",
      entrada: z.object({}),
      ejecutar: async () => {
        const todas = await datos.senales();
        const pendientes = todas.filter((s) => s.nivel !== "verde").sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "rojo" ? -1 : 1));
        const fuera = areasFueraDelPlan(ctx.rol, ctx.plan);
        return json({
          finca: ctx.fincaNombre,
          fecha: ctx.hoy,
          rol: ctx.rol,
          conteo: contarSenales(todas),
          pendientes: pendientes.map((s) => senalCompacta(s, 3)),
          ...(fuera.length > 0 ? { temas_no_incluidos_en_el_plan: alcanceDelPlan(ctx.rol, ctx.plan).temas_no_incluidos, aviso_para_el_asistente: "Si la persona pregunta por esos temas, explícale con amabilidad que su plan no los incluye, desde qué plan están y cómo mejorar (herramienta mi_plan). No inventes datos de ellos." } : {}),
        });
      },
    });
    lista.push({
      nombre: "semaforos",
      titulo: "Semáforos",
      descripcion:
        "Las señales de atención del hato con sus casos, qué significan y qué hacer. Filtra por área (reproducción, sanidad, leche, ceba, corrales, inventario, alimento, dinero) y por nivel. Las áreas disponibles dependen del rol de la persona.",
      entrada: z.object({
        area: z.enum(AREAS).optional().describe("Un área concreta; sin esto, todas las que le tocan al rol."),
        nivel: z.enum(["rojo", "ambar", "todos"]).default("todos").describe("«rojo» = actuar hoy, «ambar» = programar, «todos» incluye lo que está en orden."),
        casos_por_senal: z.number().int().min(1).max(50).default(10),
      }),
      ejecutar: async (a) => {
        const { area, nivel, casos_por_senal: casos } = a as { area?: AreaSemaforo; nivel: "rojo" | "ambar" | "todos"; casos_por_senal: number };
        if (area && !areas.includes(area)) {
          const fuera = areasFueraDelPlan(ctx.rol, ctx.plan).find((f) => f.area === area);
          if (fuera) throw new ErrorHerramienta(mensajeFueraDelPlan(fuera, ctx.plan, ctx.rol));
          throw new ErrorHerramienta(`El rol de esta persona no ve el área «${ETIQUETA_AREA[area]}». Áreas que sí puede consultar: ${areas.map((x) => ETIQUETA_AREA[x]).join(", ")}.`);
        }
        const filtradas = (await datos.senales()).filter((s) => (!area || s.area === area) && (nivel === "todos" || s.nivel === nivel));
        return json({ finca: ctx.fincaNombre, fecha: ctx.hoy, conteo: contarSenales(filtradas), senales: filtradas.map((s) => senalCompacta(s, casos)) });
      },
    });
  }

  if (puedeVer(ctx.rol, "hato", ctx.plan)) {
    lista.push({
      nombre: "buscar_animal",
      titulo: "Buscar un animal",
      descripcion: "Busca animales de la finca por nombre o por arete (parte del texto). Devuelve hasta 10 con su tipo (cabra, cabro, oveja, carnero), estado y fecha de nacimiento.",
      entrada: z.object({ texto: z.string().trim().min(1).max(40).describe("Nombre o arete, o parte de ellos.") }),
      ejecutar: async (a) => {
        const animales = await datos.buscarAnimales((a as { texto: string }).texto);
        return json({ coincidencias: animales.length, animales });
      },
    });
  }

  if (puedeVer(ctx.rol, "leche", ctx.plan)) {
    lista.push({
      nombre: "produccion_de_leche",
      titulo: "Producción de leche",
      descripcion: "Litros entregados al tanque en los últimos 7, 30, 90 o 365 días, con promedio por día de ordeño, mejor día, descartes y comparación contra el periodo anterior de igual largo.",
      entrada: z.object({ dias: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).default(30).describe("Últimos 7, 30, 90 o 365 días.") }),
      ejecutar: async (a) => {
        const r = await datos.leche((a as { dias: number }).dias);
        const v = r.previo ? variacion(r.totales.tanque, r.previo.tanque) : null;
        return json({
          desde: r.desde,
          hasta: r.hasta,
          litros_tanque: redondear(r.totales.tanque),
          litros_descartados: redondear(r.totales.descartados),
          dias_con_ordeno: r.totales.diasConOrdeno,
          promedio_litros_por_dia: redondear(r.totales.promedioDia),
          mejor_dia: r.totales.mejorDia ? { fecha: r.totales.mejorDia.fecha, litros: redondear(r.totales.mejorDia.litros) } : null,
          periodo_anterior_litros: r.previo ? redondear(r.previo.tanque) : null,
          cambio_frente_al_anterior_pct: v === null ? null : redondear(v * 100),
        });
      },
    });
  }

  lista.push({
    nombre: "mi_plan",
    titulo: "Mi plan",
    descripcion:
      "Qué temas de la finca puede consultar esta persona según el plan de la finca y su rol, qué temas no están incluidos y desde qué plan están. Úsala cuando la persona pregunte qué incluye su plan, por qué no puede ver algo, o cómo mejorarlo.",
    entrada: z.object({}),
    ejecutar: async () => json({ finca: ctx.fincaNombre, rol: ctx.rol, ...alcanceDelPlan(ctx.rol, ctx.plan) }),
  });

  return lista;
}
