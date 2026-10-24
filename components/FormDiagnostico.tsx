"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { AsistidoPor } from "@/components/AsistidoPor";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { crearDiagnostico, editarDiagnostico } from "@/app/(app)/reproduccion/actions";
import { diasHasta, formatoFecha, sumarDias } from "@/lib/fechas";
import { VALORES_CC, textoCC } from "@/lib/empadronamiento";
import { ESCENA_FETOS, ESCENA_INDICADOR_PALPACION, ESCENA_METODO_DIAGNOSTICO, ESCENA_RESULTADO_DIAGNOSTICO, ESCENA_VIABILIDAD } from "@/lib/escenas-forms-b-reproduccion";
import {
  DETALLE_FETOS, DETALLE_INDICADOR, DETALLE_METODO, DETALLE_RESULTADO, DETALLE_VIABILIDAD, ETIQUETA_FETOS, ETIQUETA_INDICADOR, ETIQUETA_METODO, ETIQUETA_RESULTADO, ETIQUETA_VIABILIDAD,
  FETOS, INDICADORES_PALPACION, METODOS_DIAGNOSTICO, RESULTADOS_DIAGNOSTICO, ventanaRepetirDx, VIABILIDADES,
} from "@/lib/reproduccion";
import type { VeterinarioRef } from "@/lib/veterinarios";
import type { DiagnosticoGestacion, IndicadorPalpacion, MetodoDiagnostico, ResultadoDiagnostico, ViabilidadFetal } from "@/lib/tipos";

/**
 * Registrar o corregir un diagnóstico de gestación. Va siempre ligado a un servicio activo de la hembra (sin él no se puede guardar) y cada método pide lo
 * suyo: la ecografía, los días, los fetos y el latido; la palpación, el indicador y la condición corporal; otro método, la prueba y su resultado.
 */
export function FormDiagnostico({
  hembraId,
  hoy,
  servicio,
  gestacionDias,
  veterinarios,
  puedeAgregarVeterinario,
  diagnostico,
}: {
  hembraId: string;
  hoy: string;
  /** El servicio al que corresponde: el activo de la hembra al crear, o el que ya tenía al editar (puede faltar si se eliminó). */
  servicio?: { id: string; fecha: string } | null;
  /** Días de gestación de la especie en esta finca: con ellos se proyecta la fecha probable de parto. */
  gestacionDias: number;
  /** Los veterinarios del equipo: quien diagnostica suele ser uno de ellos. */
  veterinarios: VeterinarioRef[];
  puedeAgregarVeterinario: boolean;
  diagnostico?: DiagnosticoGestacion;
}) {
  const editando = Boolean(diagnostico);
  const [estado, enviar, pendiente] = useActionState(editando ? editarDiagnostico : crearDiagnostico, undefined);
  const [, iniciar] = useTransition();
  const [fecha, setFecha] = useState(diagnostico?.fecha ?? hoy);
  const [metodo, setMetodo] = useState<MetodoDiagnostico>(diagnostico?.metodo ?? "ecografia");
  const [resultado, setResultado] = useState<ResultadoDiagnostico>(diagnostico?.resultado ?? "gestante");
  const [fetos, setFetos] = useState<number | "">(diagnostico?.num_fetos ?? "");
  const [viabilidad, setViabilidad] = useState<ViabilidadFetal | "">(diagnostico?.viabilidad_fetal ?? "");
  const [indicador, setIndicador] = useState<IndicadorPalpacion | "">(diagnostico?.indicador_palpacion ?? "");
  const [cc, setCc] = useState<number | "">(diagnostico?.condicion_corporal ?? "");

  const diasDelServicio = servicio && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? diasHasta(fecha, servicio.fecha) : null;
  const ventana = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? ventanaRepetirDx(fecha) : null;

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="hembra_id" value={hembraId} />
      {diagnostico ? <input type="hidden" name="diagnostico_id" value={diagnostico.id} /> : null}

      {servicio ? (
        <Aviso tipo="info">Corresponde al servicio del {formatoFecha(servicio.fecha)}{diasDelServicio != null && diasDelServicio >= 0 ? ` (hace ${diasDelServicio} días)` : ""}.</Aviso>
      ) : (
        <Aviso tipo="atencion">El servicio de este diagnóstico ya no existe. Puedes corregir sus datos, pero no ligarlo a otro servicio.</Aviso>
      )}

      <Campo etiqueta="Fecha del diagnóstico">
        {(id) => <input id={id} name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} min={servicio?.fecha} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="¿Cómo se hizo?">
        {(id) => <SelectorTarjetas id={id} nombre="metodo" valor={metodo} onCambio={(v) => v && setMetodo(v)} titulo="¿Cómo se hizo?" opciones={METODOS_DIAGNOSTICO.map((m) => ({ valor: m, etiqueta: ETIQUETA_METODO[m], detalle: DETALLE_METODO[m], escena: ESCENA_METODO_DIAGNOSTICO[m] }))} />}
      </Campo>

      <Campo etiqueta="Resultado" ayuda="Si no se pudo saber, déjalo en «Dudoso» y repítelo después.">
        {(id) => <SelectorTarjetas id={id} nombre="resultado" valor={resultado} onCambio={(v) => v && setResultado(v)} titulo="Resultado" opciones={RESULTADOS_DIAGNOSTICO.map((r) => ({ valor: r, etiqueta: ETIQUETA_RESULTADO[r], detalle: DETALLE_RESULTADO[r], escena: ESCENA_RESULTADO_DIAGNOSTICO[r] }))} />}
      </Campo>

      {metodo === "ecografia" && resultado !== "vacia" ? (
        <>
          <Campo etiqueta="Días de gestación estimados" ayuda="Los que calculó el ecografista al ver el embrión o el feto.">
            {(id) => <input id={id} name="dias_gestacion" type="text" inputMode="numeric" defaultValue={diagnostico?.dias_gestacion ?? ""} maxLength={3} autoComplete="off" required={resultado === "gestante"} className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Fetos detectados" ayuda="Importa para alimentarla bien en el último tercio de la gestación.">
            {(id) => <SelectorTarjetas id={id} nombre="num_fetos" valor={fetos} onCambio={setFetos} titulo="¿Cuántos fetos se ven?" opciones={FETOS.map((n) => ({ valor: n, etiqueta: ETIQUETA_FETOS[n], detalle: DETALLE_FETOS[n], escena: ESCENA_FETOS[n] }))} />}
          </Campo>
          <Campo etiqueta="Viabilidad fetal">
            {(id) => <SelectorTarjetas id={id} nombre="viabilidad_fetal" valor={viabilidad} onCambio={setViabilidad} titulo="¿El feto tiene latido?" opciones={VIABILIDADES.map((v) => ({ valor: v, etiqueta: ETIQUETA_VIABILIDAD[v], detalle: DETALLE_VIABILIDAD[v], escena: ESCENA_VIABILIDAD[v] }))} />}
          </Campo>
        </>
      ) : null}

      {metodo === "palpacion" ? (
        <>
          <Campo etiqueta="Método o indicador">
            {(id) => <SelectorTarjetas id={id} nombre="indicador_palpacion" valor={indicador} onCambio={setIndicador} titulo="¿Qué indicó la preñez?" opciones={INDICADORES_PALPACION.map((i) => ({ valor: i, etiqueta: ETIQUETA_INDICADOR[i], detalle: DETALLE_INDICADOR[i], escena: ESCENA_INDICADOR_PALPACION[i] }))} />}
          </Campo>
          <Campo etiqueta="Condición corporal actual" ayuda={resultado === "vacia" ? "Obligatoria si está vacía: sirve para decidir si ya puede volver al lote de reproducción." : "Opcional."}>
            {(id) => <Selector id={id} nombre="condicion_corporal" valor={cc} onCambio={setCc} titulo="Condición corporal" placeholder="Sin anotar" permitirVacio opciones={VALORES_CC.map((v) => ({ valor: v, etiqueta: textoCC(v) }))} />}
          </Campo>
        </>
      ) : null}

      {metodo === "otro" ? (
        <>
          <Campo etiqueta="Prueba o kit utilizado" ayuda="Por ejemplo, progesterona en leche o en sangre.">
            {(id) => <input id={id} name="prueba_nombre" defaultValue={diagnostico?.prueba_nombre ?? ""} maxLength={80} autoComplete="off" required className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Resultado de la prueba" ayuda="El valor o el resultado analítico, con su referencia.">
            {(id) => <input id={id} name="prueba_resultado" defaultValue={diagnostico?.prueba_resultado ?? ""} maxLength={120} autoComplete="off" required className={CLASE_INPUT} />}
          </Campo>
        </>
      ) : null}

      <AsistidoPor nombre="responsable" ayuda="Opcional." veterinarios={veterinarios} puedeAgregar={puedeAgregarVeterinario} inicial={diagnostico?.responsable} />

      {resultado === "gestante" && servicio ? (
        <Aviso tipo="info">La hembra pasa a «Gestante» y el parto se espera hacia el {formatoFecha(sumarDias(servicio.fecha, gestacionDias))} ({gestacionDias} días desde el servicio).</Aviso>
      ) : null}
      {resultado === "vacia" ? <Aviso tipo="info">La hembra queda vacía y disponible para un nuevo servicio, sincronización o temporada de monta.</Aviso> : null}
      {resultado === "dudoso" && ventana ? (
        <Aviso tipo="info">La hembra sigue en observación. Conviene repetir la prueba entre el {formatoFecha(ventana.desde)} y el {formatoFecha(ventana.hasta)}; el panel te lo recordará.</Aviso>
      ) : null}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={diagnostico?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…">
          {editando ? "Guardar cambios" : "Guardar diagnóstico"}
        </Boton>
        <Link href={`/hato/${hembraId}#reproduccion`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
