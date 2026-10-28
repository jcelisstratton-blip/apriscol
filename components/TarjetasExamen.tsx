import { Aviso } from "@/components/Aviso";
import { Insignia } from "@/components/Insignia";
import { Tarjeta } from "@/components/Tarjeta";
import {
  AYUDA_MUESTRA,
  AYUDA_OOQUISTES,
  DETALLE_MUESTRA,
  ETIQUETA_MOMENTO,
  ETIQUETA_MUESTRA,
  ETIQUETA_OTRO_PARASITO,
  ETIQUETA_TECNICA,
  interpretarHpg,
  textoResultado,
  type OtroParasito,
} from "@/lib/coprologico";
import { formatoFecha } from "@/lib/fechas";
import type { ExamenCoprologico } from "@/lib/tipos";

type Datos = Pick<ExamenCoprologico, "fecha" | "momento" | "tecnica" | "hpg" | "opg" | "otros_parasitos" | "laboratorio" | "observaciones" | "tipo_muestra" | "tomada_por">;

const corta = { day: "numeric", month: "short", year: "numeric" } as const;

/**
 * Las dos mitades de un examen coprológico: **«Prueba recogida»** (cómo se tomó la muestra —limpia, directo del animal, o contaminada, del piso—, quién la tomó, cuándo,
 * con qué técnica y en qué laboratorio) y **«Resultado obtenido»** (huevos y ooquistes por gramo, su nivel y qué hacer). La misma pareja se ve en la ficha del animal,
 * en la lista de Sanidad y en el detalle del examen. `compacta` es la versión de las listas; la completa lleva las explicaciones.
 */
export function TarjetasExamen({ x, compacta = false }: { x: Datos; compacta?: boolean }) {
  const contaminada = x.tipo_muestra === "contaminada";
  const lectura = x.hpg !== null && x.momento === "diagnostico" && !contaminada ? interpretarHpg(x.hpg) : null;
  const recogida = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {x.tipo_muestra ? <Insignia tono={contaminada ? "alerta" : "ok"}>{ETIQUETA_MUESTRA[x.tipo_muestra]}</Insignia> : <Insignia tono="neutro">Muestra sin registrar</Insignia>}
        {x.momento !== "diagnostico" ? <Insignia>{ETIQUETA_MOMENTO[x.momento]}</Insignia> : null}
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        {x.tipo_muestra ? <Fila e="Cómo">{DETALLE_MUESTRA[x.tipo_muestra]}</Fila> : null}
        <Fila e="Tomada por">{x.tomada_por ?? "No registrado"}</Fila>
        <Fila e="Fecha">{formatoFecha(x.fecha, corta)}</Fila>
        <Fila e="Técnica">{ETIQUETA_TECNICA[x.tecnica]}</Fila>
        {x.laboratorio ? <Fila e="Laboratorio">{x.laboratorio}</Fila> : null}
      </dl>
      {!compacta && x.tipo_muestra ? <p className="mt-2 text-sm text-humo">{AYUDA_MUESTRA[x.tipo_muestra]}</p> : null}
    </>
  );
  const resultado = (
    <>
      <p className="font-display text-xl font-semibold tabular-nums">{textoResultado(x) || "Sin resultado"}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {lectura ? <Insignia tono={lectura.tono}>{lectura.texto}</Insignia> : null}
        {contaminada ? <Insignia tono="aviso">Solo orientación</Insignia> : null}
      </div>
      {x.otros_parasitos.length > 0 ? <p className="mt-2 text-sm">Otros parásitos: {x.otros_parasitos.map((o) => ETIQUETA_OTRO_PARASITO[o as OtroParasito] ?? o).join(", ")}</p> : null}
      {contaminada ? (
        <p className="mt-2 text-sm text-humo">Una muestra del piso no dice con certeza de qué animal es: úsala como orientación del corral, no para tratar a un animal.</p>
      ) : lectura && !compacta ? (
        <div className="mt-2">
          <Aviso tipo={lectura.tono === "alerta" || lectura.tono === "aviso" ? "atencion" : "info"}>
            <span className="font-semibold">Qué hacer: </span>
            {lectura.accion}
          </Aviso>
        </div>
      ) : lectura ? (
        <p className="mt-2 text-sm text-humo">{lectura.accion}</p>
      ) : null}
      {!compacta && x.opg !== null ? <p className="mt-2 text-sm text-humo">{AYUDA_OOQUISTES}</p> : null}
      {x.observaciones ? <p className="mt-2 whitespace-pre-wrap border-t border-arena pt-2 text-sm [overflow-wrap:anywhere]">{x.observaciones}</p> : null}
    </>
  );

  if (compacta) {
    return (
      <div className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2">
        <section aria-label="Prueba recogida" className="min-w-0 rounded-2xl bg-lana px-3 py-2.5">
          <p className="mb-1.5 text-sm font-bold">Prueba recogida</p>
          {recogida}
        </section>
        <section aria-label="Resultado obtenido" className="min-w-0 rounded-2xl bg-lana px-3 py-2.5">
          <p className="mb-1.5 text-sm font-bold">Resultado obtenido</p>
          {resultado}
        </section>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <Tarjeta titulo="Prueba recogida">{recogida}</Tarjeta>
      <Tarjeta titulo="Resultado obtenido">{resultado}</Tarjeta>
    </div>
  );
}

function Fila({ e, children }: { e: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-humo">{e}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
