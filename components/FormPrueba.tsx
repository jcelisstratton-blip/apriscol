"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Selector } from "@/components/Selector";
import { SubirSoporte } from "@/components/SubirSoporte";
import { crearPrueba, editarPrueba } from "@/app/(app)/sanidad/actions";
import { ETIQUETA_PRUEBA, ETIQUETA_RESULTADO_PRUEBA, RESULTADOS_PRUEBA, TIPOS_PRUEBA } from "@/lib/sanidad";
import type { PruebaSanitaria, ResultadoPrueba, TipoPrueba } from "@/lib/tipos";

/** Registrar una prueba diagnóstica de un animal (viene fijo desde su ficha) o corregir una ya registrada. */
export function FormPrueba({ animalId, hoy, prueba, solicitud }: { animalId: string; hoy: string; prueba?: PruebaSanitaria; solicitud?: string }) {
  const editando = Boolean(prueba);
  const [estado, enviar, pendiente] = useActionState(editando ? editarPrueba : crearPrueba, undefined);
  const [, iniciar] = useTransition();
  const [tipo, setTipo] = useState<TipoPrueba>(prueba?.prueba ?? "cae");
  const [resultado, setResultado] = useState<ResultadoPrueba>(prueba?.resultado ?? "pendiente");
  const [subiendo, setSubiendo] = useState(false);

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="animal_id" value={animalId} />
      {prueba ? <input type="hidden" name="prueba_id" value={prueba.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Campo etiqueta="Prueba">
        {(id) => (
          <Selector
            id={id}
            nombre="prueba"
            valor={tipo}
            onCambio={(v) => v && setTipo(v)}
            titulo="¿Qué prueba?"
            opciones={TIPOS_PRUEBA.map((t) => ({ valor: t, etiqueta: ETIQUETA_PRUEBA[t] }))}
          />
        )}
      </Campo>

      <Campo etiqueta="Fecha">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={prueba?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Resultado" ayuda="Si todavía no llega, déjalo en «Pendiente» y lo corriges después.">
        {(id) => (
          <Selector
            id={id}
            nombre="resultado"
            valor={resultado}
            onCambio={(v) => v && setResultado(v)}
            titulo="Resultado"
            opciones={RESULTADOS_PRUEBA.map((r) => ({ valor: r, etiqueta: ETIQUETA_RESULTADO_PRUEBA[r] }))}
          />
        )}
      </Campo>

      <Campo etiqueta="Laboratorio" ayuda="Opcional.">
        {(id) => <input id={id} name="laboratorio" defaultValue={prueba?.laboratorio ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Documento con el resultado</p>
        <p className="text-[0.8125rem] text-humo">Opcional. El informe del laboratorio o la foto de la prueba: queda guardado como respaldo.</p>
        <SubirSoporte nombre="soporte_path" carpeta="sanidad" etiqueta="Documento con el resultado" inicial={prueba?.soporte_path} onEstado={setSubiendo} />
      </div>

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" defaultValue={prueba?.observaciones ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={subiendo}>
          {editando ? "Guardar cambios" : "Guardar prueba"}
        </Boton>
        <Link href={`/hato/${animalId}#sanidad`} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
