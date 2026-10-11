"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { FotoPremio } from "@/components/FotoPremio";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { crearParticipacion } from "@/app/(app)/ferias/actions";
import { ETIQUETA_RESULTADO, RESULTADOS } from "@/lib/ferias";
import { formatoFecha } from "@/lib/fechas";
import type { ResultadoFeria } from "@/lib/tipos";

type Ref = { id: string; numero_arete: string; nombre: string | null };
type FeriaOpcion = { id: string; nombre: string; fecha_inicio: string };

export function FormParticipacion({
  fincaId,
  ferias,
  feriaInicial,
  animalInicial,
  solicitud,
}: {
  fincaId: string;
  ferias: FeriaOpcion[];
  feriaInicial?: string;
  animalInicial: Ref | null;
  solicitud: string;
}) {
  const [estado, enviar, pendiente] = useActionState(crearParticipacion, undefined);
  const [feria, setFeria] = useState<string>(feriaInicial ?? "");
  const [animal, setAnimal] = useState<Ref | null>(animalInicial);
  const [resultado, setResultado] = useState<ResultadoFeria>("participacion");
  const [subiendo, setSubiendo] = useState(false);
  const huboPremio = resultado !== "participacion";

  return (
    <form action={enviar} className="space-y-5">
      <input type="hidden" name="client_request_id" value={solicitud} />

      <Campo etiqueta="Feria">
        {(id) => (
          <Selector
            id={id}
            nombre="feria_id"
            valor={feria}
            onCambio={(v) => setFeria(String(v))}
            titulo="¿En qué feria?"
            placeholder="Elegir feria"
            opciones={ferias.map((f) => ({ valor: f.id, etiqueta: f.nombre, detalle: formatoFecha(f.fecha_inicio) }))}
          />
        )}
      </Campo>

      <Campo etiqueta="Animal">
        {(id) => <SelectorAnimal id={id} nombre="animal_id" fincaId={fincaId} titulo="¿Qué animal concursó?" valor={animal} onCambio={setAnimal} />}
      </Campo>

      <Campo etiqueta="Categoría" ayuda="Tal como la publicó la feria.">
        {(id) => <input id={id} name="categoria" required maxLength={160} autoComplete="off" className={CLASE_INPUT} placeholder="Ej. Hembra joven en leche" />}
      </Campo>

      <Campo etiqueta="Resultado">
        {(id) => (
          <Selector
            id={id}
            nombre="resultado"
            valor={resultado}
            onCambio={(v) => v && setResultado(v)}
            titulo="Resultado del jurado"
            opciones={RESULTADOS.map((r) => ({ valor: r, etiqueta: ETIQUETA_RESULTADO[r] }))}
          />
        )}
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo etiqueta="Puesto" ayuda="Opcional.">
          {(id) => <input id={id} name="puesto" inputMode="numeric" pattern="[0-9]*" maxLength={2} autoComplete="off" className={CLASE_INPUT} placeholder="1" />}
        </Campo>
        <Campo etiqueta="Puntaje" ayuda="Opcional.">
          {(id) => <input id={id} name="puntaje" inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="92,5" />}
        </Campo>
      </div>

      {huboPremio ? (
        <>
          <Campo etiqueta="Premio recibido" ayuda="Trofeo, copa, banda, placa…">
            {(id) => <input id={id} name="premio_descripcion" maxLength={200} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Premio en dinero" ayuda="Opcional, en pesos.">
            {(id) => <input id={id} name="premio_en_dinero" inputMode="numeric" autoComplete="off" className={CLASE_INPUT} placeholder="0" />}
          </Campo>
          <div className="space-y-2">
            <span className="block text-sm font-semibold">Foto del premio</span>
            <FotoPremio nombre="foto_path" onEstado={setSubiendo} />
          </div>
        </>
      ) : null}

      <Campo etiqueta="Observaciones" ayuda="Opcional.">
        {(id) => <textarea id={id} name="observaciones" rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={subiendo || !feria || !animal}>
        {subiendo ? "Esperando la foto…" : "Guardar participación"}
      </Boton>
    </form>
  );
}
