"use client";

import { useActionState, useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Segmentado } from "@/components/Segmentado";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { crearAnimal } from "@/app/(app)/hato/actions";
import { hoyBogota } from "@/lib/fechas";
import type { Especie, Raza, SexoAnimal, Vocacion } from "@/lib/tipos";

type Ref = { id: string; numero_arete: string; nombre: string | null };

/** Colores más usados en el libro genealógico: un toque los escribe; el campo sigue siendo libre. */
const COLORES = ["Blanco", "Chamoisée", "Negro", "Crema", "Café", "Broken", "Pinto"];

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="border-b border-arena pb-1.5 font-display text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

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
  const [color, setColor] = useState("");
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
    <form action={enviar} className="space-y-8">
      <input type="hidden" name="client_request_id" value={solicitud} />

      <Seccion titulo="Identificación">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {especies.length > 1 ? (
            <div className="min-w-0 space-y-2">
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

          <div className="min-w-0 space-y-2">
            <span className="block text-sm font-semibold">Sexo</span>
            <Segmentado
              etiqueta="Sexo"
              nombre="sexo"
              valor={sexo}
              onCambio={setSexo}
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

          <Campo etiqueta="Microchip" ayuda="Opcional. El número del chip, si lo tiene.">
            {(id) => <input id={id} name="chip" maxLength={40} autoComplete="off" inputMode="text" enterKeyHint="next" className={CLASE_INPUT} />}
          </Campo>

          <Campo etiqueta="Nombre" ayuda="Opcional.">
            {(id) => <input id={id} name="nombre" maxLength={60} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Cómo es">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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

          <div className="min-w-0 space-y-2">
            <Campo etiqueta="Color" ayuda="Opcional. Toca uno o escríbelo.">
              {(id) => (
                <input id={id} name="color" value={color} onChange={(e) => setColor(e.target.value)} maxLength={60} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. Blanco, chamoisée" />
              )}
            </Campo>
            <FilaDesplazable>
              {COLORES.map((c) => (
                <Chip key={c} activo={color.trim().toLowerCase() === c.toLowerCase()} onClick={() => setColor(c)}>
                  {c}
                </Chip>
              ))}
            </FilaDesplazable>
          </div>

          <Campo etiqueta="Marcas" ayuda="Opcional. Chapeta, muesca, collar o tatuaje con que lo identificas.">
            {(id) => <input id={id} name="marcas" maxLength={120} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. Chapeta 32, muesca oreja derecha" />}
          </Campo>

          <Campo etiqueta="Rasgos" ayuda="Opcional. Señas particulares que lo distinguen.">
            {(id) => <input id={id} name="rasgos" maxLength={200} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. Mamelas, cara negra, estrella blanca" />}
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Nacimiento y origen">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <Campo etiqueta="Fecha de nacimiento">
              {(id) => <input id={id} name="fecha_nacimiento" type="date" max={hoy} className={CLASE_INPUT} />}
            </Campo>
            <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
              <input type="checkbox" name="fecha_nacimiento_aprox" className="size-5 accent-[var(--musgo)]" />
              Es una fecha aproximada
            </label>
          </div>

          <div className="min-w-0 space-y-2">
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

          {origen === "nacido_en_finca" ? (
            <Campo etiqueta="Peso al nacer" ayuda="Opcional. En kilos, por ejemplo 3,2.">
              {(id) => <input id={id} name="peso_nacer_kg" inputMode="decimal" autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. 3,2" />}
            </Campo>
          ) : null}
        </div>
      </Seccion>

      <Seccion titulo="Producción">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
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
        </div>
      </Seccion>

      <Seccion titulo="Genealogía">
        <p className="-mt-2 text-[0.8125rem] text-humo">Con padre y madre registrados calculamos la endogamia de cada cría.</p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
        </div>
        <details className="group">
          <summary className="min-h-11 cursor-pointer list-none py-2.5 text-[0.9375rem] font-semibold text-musgo">
            Padres que no están en mi hato
          </summary>
          <div className="grid grid-cols-1 gap-5 pt-2 lg:grid-cols-2">
            <Campo etiqueta="Padre externo" ayuda="Nombre o código, por ejemplo de una pajilla de semen.">
              {(id) => <input id={id} name="padre_externo" maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Madre externa">
              {(id) => <input id={id} name="madre_externa" maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          </div>
        </details>
      </Seccion>

      <Seccion titulo="Notas">
        <Campo etiqueta="Notas" ayuda="Opcional. Cualquier cosa que quieras recordar de este animal.">
          {(id) => <textarea id={id} name="notas" rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
      </Seccion>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}

      <Boton type="submit" pendiente={pendiente} cargando="Guardando animal…">
        Guardar animal
      </Boton>
    </form>
  );
}
