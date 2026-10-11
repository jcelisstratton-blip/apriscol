"use client";

import { useActionState, useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Segmentado } from "@/components/Segmentado";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { crearAnimal } from "@/app/(app)/hato/actions";
import { hoyBogota } from "@/lib/fechas";
import type { Especie, Raza, SexoAnimal, Vocacion } from "@/lib/tipos";

type Ref = { id: string; numero_arete: string; nombre: string | null };

export function FormAnimal({
  fincaId,
  especies,
  propositoFinca,
  razas,
  solicitud,
}: {
  fincaId: string;
  especies: Especie[];
  propositoFinca: Vocacion;
  razas: Raza[];
  solicitud: string;
}) {
  const [estado, enviar, pendiente] = useActionState(crearAnimal, undefined);
  const [especie, setEspecie] = useState<Especie>(especies[0] ?? "caprino");
  const [sexo, setSexo] = useState<SexoAnimal>("hembra");
  const [razaId, setRazaId] = useState<number | "">("");
  const [origen, setOrigen] = useState<"nacido_en_finca" | "comprado">("nacido_en_finca");
  const [vocacion, setVocacion] = useState<Vocacion>(propositoFinca);
  const [padre, setPadre] = useState<Ref | null>(null);
  const [madre, setMadre] = useState<Ref | null>(null);
  const hoy = hoyBogota();

  // `solicitud` es un identificador por apertura del formulario: si se toca dos veces «Guardar», la base ignora el duplicado.

  const opcionesRaza = useMemo(
    () => razas.filter((r) => r.especie === especie).map((r) => ({ valor: r.id, etiqueta: r.nombre })),
    [razas, especie],
  );

  const cambiarEspecie = (e: Especie) => {
    setEspecie(e);
    setRazaId("");
    setPadre(null);
    setMadre(null);
  };

  const etiquetasSexo = especie === "caprino" ? ["Cabra", "Cabro"] : ["Oveja", "Carnero"];

  return (
    <form action={enviar} className="space-y-5">
      <input type="hidden" name="client_request_id" value={solicitud} />

      {especies.length > 1 ? (
        <div className="space-y-2">
          <span className="block text-sm font-semibold">Especie</span>
          <Segmentado
            etiqueta="Especie"
            nombre="especie"
            valor={especie}
            onCambio={cambiarEspecie}
            opciones={[
              { valor: "caprino", etiqueta: "Caprino" },
              { valor: "ovino", etiqueta: "Ovino" },
            ]}
          />
        </div>
      ) : (
        <input type="hidden" name="especie" value={especie} />
      )}

      <div className="space-y-2">
        <span className="block text-sm font-semibold">Sexo</span>
        <Segmentado
          etiqueta="Sexo"
          nombre="sexo"
          valor={sexo}
          onCambio={(s) => {
            setSexo(s);
          }}
          opciones={[
            { valor: "hembra", etiqueta: etiquetasSexo[0] },
            { valor: "macho", etiqueta: etiquetasSexo[1] },
          ]}
        />
      </div>

      <Campo etiqueta="Número de arete" ayuda="Debe ser único en tu finca.">
        {(id) => (
          <input id={id} name="numero_arete" required maxLength={40} autoComplete="off" autoCapitalize="characters" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. 0123" />
        )}
      </Campo>

      <Campo etiqueta="Nombre" ayuda="Opcional.">
        {(id) => <input id={id} name="nombre" maxLength={60} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Raza">
        {(id) => (
          <Selector
            id={id}
            nombre="raza_id"
            valor={razaId}
            opciones={opcionesRaza}
            onCambio={(v) => setRazaId(v === "" ? "" : Number(v))}
            titulo="Raza"
            placeholder="Sin especificar"
            permitirVacio
          />
        )}
      </Campo>

      <Campo etiqueta="Fecha de nacimiento">
        {(id) => <input id={id} name="fecha_nacimiento" type="date" max={hoy} className={CLASE_INPUT} />}
      </Campo>
      <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
        <input type="checkbox" name="fecha_nacimiento_aprox" className="size-5 accent-[var(--musgo)]" />
        Es una fecha aproximada
      </label>

      <div className="space-y-2">
        <span className="block text-sm font-semibold">Origen</span>
        <Segmentado
          etiqueta="Origen"
          nombre="origen"
          valor={origen}
          onCambio={setOrigen}
          opciones={[
            { valor: "nacido_en_finca", etiqueta: "Nació aquí" },
            { valor: "comprado", etiqueta: "Comprado" },
          ]}
        />
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-semibold">Aptitud</span>
        <Segmentado
          etiqueta="Aptitud"
          nombre="vocacion"
          valor={vocacion}
          onCambio={setVocacion}
          opciones={[
            { valor: "leche", etiqueta: "Leche" },
            { valor: "carne", etiqueta: "Carne" },
            { valor: "doble", etiqueta: "Ambas" },
          ]}
        />
      </div>

      {sexo === "hembra" && vocacion !== "carne" ? (
        <Campo etiqueta="Fecha del último parto" ayuda="Si ya está en leche, así abrimos su lactancia y aparece en el ordeño.">
          {(id) => <input id={id} name="fecha_ultimo_parto" type="date" max={hoy} className={CLASE_INPUT} />}
        </Campo>
      ) : null}

      <fieldset className="space-y-4 rounded-3xl bg-papel p-4 ring-1 ring-arena">
        <legend className="px-1 text-sm font-bold">Genealogía</legend>
        <p className="-mt-1 text-[0.8125rem] text-humo">Con padre y madre registrados calculamos la endogamia de cada cría.</p>
        <Campo etiqueta="Padre">
          {(id) => (
            <SelectorAnimal id={id} nombre="padre_id" fincaId={fincaId} sexo="macho" especie={especie} titulo="Elegir el padre" valor={padre} onCambio={setPadre} />
          )}
        </Campo>
        <Campo etiqueta="Madre">
          {(id) => (
            <SelectorAnimal id={id} nombre="madre_id" fincaId={fincaId} sexo="hembra" especie={especie} titulo="Elegir la madre" valor={madre} onCambio={setMadre} />
          )}
        </Campo>
        <details className="group">
          <summary className="min-h-11 cursor-pointer list-none py-2.5 text-[0.9375rem] font-semibold text-musgo">
            Padres que no están en mi hato
          </summary>
          <div className="space-y-4 pt-2">
            <Campo etiqueta="Padre externo" ayuda="Nombre o código, por ejemplo de una pajilla de semen.">
              {(id) => <input id={id} name="padre_externo" maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Madre externa">
              {(id) => <input id={id} name="madre_externa" maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          </div>
        </details>
      </fieldset>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}

      <Boton type="submit" pendiente={pendiente} cargando="Guardando animal…">
        Guardar animal
      </Boton>
    </form>
  );
}
