import { diasHasta } from "@/lib/fechas";
import type { DiagnosticoGestacion, IndicadorPalpacion, MetodoDiagnostico, ResultadoDiagnostico, ViabilidadFetal } from "@/lib/tipos";

/** Lo que llega para un diagnóstico de gestación (ficha con señal o registro sin señal). */
export type EntradaDiagnostico = {
  fecha: string;
  metodo: MetodoDiagnostico;
  resultado: ResultadoDiagnostico;
  dias_gestacion?: number | null;
  num_fetos?: number | null;
  viabilidad_fetal?: ViabilidadFetal | null;
  indicador_palpacion?: IndicadorPalpacion | null;
  condicion_corporal?: number | null;
  prueba_nombre?: string | null;
  prueba_resultado?: string | null;
};

export type DatosPorMetodo = Pick<DiagnosticoGestacion, "dias_gestacion" | "num_fetos" | "viabilidad_fetal" | "indicador_palpacion" | "condicion_corporal" | "prueba_nombre" | "prueba_resultado">;

/**
 * Las reglas de un diagnóstico de gestación, en un solo lugar: las usan la ficha (`leerDiagnostico`) y el registro sin señal
 * (`guardarDiagnosticoCampo`). Cada método pide y guarda solo lo suyo: ecografía, palpación u otra prueba. `servicioFecha` es la del servicio
 * al que cuelga (lo elige el servidor).
 */
export function reglasDiagnostico(d: EntradaDiagnostico, servicioFecha: string | null): { error: string } | { propios: DatosPorMetodo } {
  if (servicioFecha && d.fecha < servicioFecha) return { error: "El diagnóstico no puede ser anterior al servicio." };
  const sinEco = { dias_gestacion: null, num_fetos: null, viabilidad_fetal: null };
  const sinPalpacion = { indicador_palpacion: null, condicion_corporal: null };
  const sinPrueba = { prueba_nombre: null, prueba_resultado: null };

  if (d.metodo === "ecografia") {
    // Una hembra vacía no tiene nada que estimar: la ecografía solo guarda sus datos si se vio algo.
    if (d.resultado === "vacia") return { propios: { ...sinEco, ...sinPalpacion, ...sinPrueba } };
    if (d.resultado === "gestante") {
      if (d.dias_gestacion == null) return { error: "Indica los días de gestación que calculó el ecografista." };
      if (d.num_fetos == null) return { error: "Elige cuántos fetos se ven." };
      if (!d.viabilidad_fetal) return { error: "Indica si el feto tiene latido." };
      if (d.viabilidad_fetal === "sin_actividad") return { error: "Sin actividad fetal no se confirma una gestación: elige «Dudoso» para repetir la ecografía o «Vacía»." };
    }
    if (d.dias_gestacion != null && servicioFecha && d.dias_gestacion > diasHasta(d.fecha, servicioFecha) + 10) {
      return { error: `La ecografía calcula ${d.dias_gestacion} días de gestación, pero el servicio fue hace ${diasHasta(d.fecha, servicioFecha)} días.` };
    }
    return { propios: { dias_gestacion: d.dias_gestacion ?? null, num_fetos: d.num_fetos ?? null, viabilidad_fetal: d.viabilidad_fetal ?? null, ...sinPalpacion, ...sinPrueba } };
  }
  if (d.metodo === "palpacion") {
    if (!d.indicador_palpacion) return { error: "Elige el indicador de la palpación." };
    if (d.indicador_palpacion === "retorno_celo" && d.resultado === "gestante") return { error: "Si volvió a celo no quedó gestante: elige «Vacía» o «Dudoso»." };
    if (d.resultado === "vacia" && d.condicion_corporal == null) return { error: "Indica la condición corporal: sirve para decidir si la hembra vuelve al lote de reproducción." };
    return { propios: { ...sinEco, indicador_palpacion: d.indicador_palpacion, condicion_corporal: d.condicion_corporal ?? null, ...sinPrueba } };
  }
  if (!d.prueba_nombre) return { error: "Escribe el nombre de la prueba o del kit que se usó." };
  if (!d.prueba_resultado) return { error: "Escribe el resultado de la prueba o su valor de referencia." };
  return { propios: { ...sinEco, ...sinPalpacion, prueba_nombre: d.prueba_nombre, prueba_resultado: d.prueba_resultado } };
}
