"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { FotoAnimal } from "@/components/FotoAnimal";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { crearAnimal, editarAnimal } from "@/app/(app)/hato/actions";
import { nombreTipo } from "@/lib/animal";
import { hoyBogota } from "@/lib/fechas";
import { ESCENA_ESPECIE, ESCENA_ORIGEN_ANIMAL, ESCENA_SEXO, ESCENA_USO_MACHO, ESCENA_VOCACION } from "@/lib/escenas-forms-b-hato";
import type { Especie, Raza, SexoAnimal, UsoMacho, Vocacion } from "@/lib/tipos";

type Ref = { id: string; numero_arete: string; nombre: string | null };

/** Los datos de un animal ya registrado, para corregirlos. */
export type AnimalEditable = {
  id: string;
  especie: Especie;
  sexo: SexoAnimal;
  numero_arete: string;
  chip: string | null;
  nombre: string | null;
  raza_id: number | null;
  color: string | null;
  marcas: string | null;
  rasgos: string | null;
  fecha_nacimiento: string | null;
  fecha_nacimiento_aprox: boolean;
  origen: "nacido_en_finca" | "comprado";
  peso_nacer_kg: number | null;
  valor_compra: number | null;
  vocacion: Vocacion;
  uso_macho: UsoMacho | null;
  padre: Ref | null;
  madre: Ref | null;
  padre_externo: string | null;
  madre_externa: string | null;
  notas: string | null;
  foto: { path: string; url: string } | null;
};

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
  animal,
  bloqueoIdentidad = null,
}: {
  fincaId: string;
  especies: Especie[];
  propositoFinca: Vocacion;
  razas: Raza[];
  /** Solo al crear: identifica la apertura del formulario para ignorar un doble toque. */
  solicitud?: string;
  /** Si viene, el formulario corrige este animal en lugar de crear uno nuevo. */
  animal?: AnimalEditable;
  /** En edición: por qué el sexo y la especie no se pueden cambiar (o `null` si se pueden). */
  bloqueoIdentidad?: string | null;
}) {
  const editando = Boolean(animal);
  const [estado, enviar, pendiente] = useActionState(editando ? editarAnimal : crearAnimal, undefined);
  const [, iniciar] = useTransition();
  const [especie, setEspecie] = useState<Especie>(animal?.especie ?? especies[0] ?? "caprino");
  const [sexo, setSexo] = useState<SexoAnimal>(animal?.sexo ?? "hembra");
  const [razaId, setRazaId] = useState<number | "">(animal?.raza_id ?? "");
  const [origen, setOrigen] = useState<"nacido_en_finca" | "comprado">(animal?.origen ?? "nacido_en_finca");
  const [vocacion, setVocacion] = useState<Vocacion>(animal?.vocacion ?? propositoFinca);
  const [usoMacho, setUsoMacho] = useState<UsoMacho | "por_definir">(animal?.uso_macho ?? "por_definir");
  const [padre, setPadre] = useState<Ref | null>(animal?.padre ?? null);
  const [madre, setMadre] = useState<Ref | null>(animal?.madre ?? null);
  const [color, setColor] = useState(animal?.color ?? "");
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const hoy = hoyBogota();
  const identidadBloqueada = editando && bloqueoIdentidad !== null;

  // Se envía con onSubmit (no con `action`): así, si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };

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
    <form onSubmit={alEnviar} className="space-y-8">
      {animal ? <input type="hidden" name="animal_id" value={animal.id} /> : <input type="hidden" name="client_request_id" value={solicitud ?? ""} />}

      <Seccion titulo="Foto">
        <div className="space-y-2 lg:max-w-md">
          <FotoAnimal nombre="foto_path" onEstado={setSubiendoFoto} inicial={animal?.foto ?? null} />
          <p className="text-[0.8125rem] text-humo">Opcional. Sirve para reconocerlo de un vistazo en el hato.</p>
        </div>
      </Seccion>

      <Seccion titulo="Identificación">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {identidadBloqueada && animal ? (
            <div className="min-w-0 space-y-1 lg:col-span-2">
              <input type="hidden" name="especie" value={animal.especie} />
              <input type="hidden" name="sexo" value={animal.sexo} />
              <span className="block text-sm font-semibold">Especie y sexo</span>
              <p className="font-semibold">{nombreTipo(animal.especie, animal.sexo)} · {animal.especie === "caprino" ? "Caprino" : "Ovino"}</p>
              <p className="text-[0.8125rem] text-humo">{bloqueoIdentidad}</p>
            </div>
          ) : null}
          {identidadBloqueada ? null : especies.length > 1 ? (
            <div className="min-w-0 space-y-2">
              <span className="block text-sm font-semibold">Especie</span>
              <SelectorTarjetas<Especie>
                nombre="especie"
                valor={especie}
                onCambio={(v) => v && cambiarEspecie(v)}
                titulo="Especie"
                opciones={[
                  { valor: "caprino", etiqueta: "Caprino", detalle: "Cabras y cabros", escena: ESCENA_ESPECIE.caprino },
                  { valor: "ovino", etiqueta: "Ovino", detalle: "Ovejas y carneros", escena: ESCENA_ESPECIE.ovino },
                ]}
              />
            </div>
          ) : (
            <input type="hidden" name="especie" value={especie} />
          )}

          {identidadBloqueada ? null : (
            <div className="min-w-0 space-y-2">
              <span className="block text-sm font-semibold">Sexo</span>
              <SelectorTarjetas<SexoAnimal>
                nombre="sexo"
                valor={sexo}
                onCambio={(v) => v && setSexo(v)}
                titulo="Sexo"
                opciones={[
                  { valor: "hembra", etiqueta: etiquetasSexo[0], escena: ESCENA_SEXO.hembra },
                  { valor: "macho", etiqueta: etiquetasSexo[1], escena: ESCENA_SEXO.macho },
                ]}
              />
            </div>
          )}

          <Campo etiqueta="Número de arete" ayuda="Debe ser único en tu finca.">
            {(id) => (
              <input id={id} name="numero_arete" defaultValue={animal?.numero_arete} required maxLength={40} autoComplete="off" autoCapitalize="characters" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. 0123" />
            )}
          </Campo>

          <Campo etiqueta="Microchip" ayuda="Opcional. El número del chip, si lo tiene.">
            {(id) => <input id={id} name="chip" defaultValue={animal?.chip ?? ""} maxLength={40} autoComplete="off" inputMode="text" enterKeyHint="next" className={CLASE_INPUT} />}
          </Campo>

          <Campo etiqueta="Nombre" ayuda="Opcional.">
            {(id) => <input id={id} name="nombre" defaultValue={animal?.nombre ?? ""} maxLength={60} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} />}
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
            {(id) => <input id={id} name="marcas" defaultValue={animal?.marcas ?? ""} maxLength={120} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. Chapeta 32, muesca oreja derecha" />}
          </Campo>

          <Campo etiqueta="Rasgos" ayuda="Opcional. Señas particulares que lo distinguen.">
            {(id) => <input id={id} name="rasgos" defaultValue={animal?.rasgos ?? ""} maxLength={200} autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. Mamelas, cara negra, estrella blanca" />}
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Nacimiento y origen">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <Campo etiqueta="Fecha de nacimiento">
              {(id) => <input id={id} name="fecha_nacimiento" type="date" defaultValue={animal?.fecha_nacimiento ?? ""} max={hoy} className={CLASE_INPUT} />}
            </Campo>
            <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
              <input type="checkbox" name="fecha_nacimiento_aprox" defaultChecked={animal?.fecha_nacimiento_aprox} className="size-5 accent-[var(--musgo)]" />
              Es una fecha aproximada
            </label>
          </div>

          <div className="min-w-0 space-y-2">
            <span className="block text-sm font-semibold">Origen</span>
            <SelectorTarjetas<"nacido_en_finca" | "comprado">
              nombre="origen"
              valor={origen}
              onCambio={(v) => v && setOrigen(v)}
              titulo="Origen"
              opciones={[
                { valor: "nacido_en_finca", etiqueta: "Nació aquí", escena: ESCENA_ORIGEN_ANIMAL.nacido_en_finca },
                { valor: "comprado", etiqueta: "Comprado", escena: ESCENA_ORIGEN_ANIMAL.comprado },
              ]}
            />
          </div>

          {origen === "nacido_en_finca" ? (
            <Campo etiqueta="Peso al nacer" ayuda="Opcional. En kilos, por ejemplo 3,2.">
              {(id) => <input id={id} name="peso_nacer_kg" defaultValue={animal?.peso_nacer_kg != null ? String(animal.peso_nacer_kg).replace(".", ",") : ""} inputMode="decimal" autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. 3,2" />}
            </Campo>
          ) : null}

          <Campo etiqueta={origen === "comprado" ? "Valor de compra" : "Valor de reposición"} ayuda={origen === "comprado" ? "Opcional. En pesos, lo que costó. Sirve para medir la pérdida si se descarta o muere." : "Opcional. En pesos, lo que costaría reponerlo. Sirve para medir la pérdida si se descarta o muere."}>
            {(id) => <input id={id} name="valor_compra" defaultValue={animal?.valor_compra != null ? String(animal.valor_compra) : ""} inputMode="decimal" autoComplete="off" enterKeyHint="next" className={CLASE_INPUT} placeholder="Ej. 800.000" />}
          </Campo>
        </div>
      </Seccion>

      {sexo === "hembra" ? (
        <Seccion titulo="Producción">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <span className="block text-sm font-semibold">Aptitud</span>
              <SelectorTarjetas<Vocacion>
                nombre="vocacion"
                valor={vocacion}
                onCambio={(v) => v && setVocacion(v)}
                titulo="Aptitud"
                opciones={[
                  { valor: "leche", etiqueta: "Leche", escena: ESCENA_VOCACION.leche },
                  { valor: "carne", etiqueta: "Carne", escena: ESCENA_VOCACION.carne },
                  { valor: "doble", etiqueta: "Ambas", escena: ESCENA_VOCACION.doble },
                ]}
              />
            </div>

            {!editando && vocacion !== "carne" ? (
              <Campo etiqueta="Fecha del último parto" ayuda="Si ya está en leche, así abrimos su lactancia y aparece en el ordeño.">
                {(id) => <input id={id} name="fecha_ultimo_parto" type="date" max={hoy} className={CLASE_INPUT} />}
              </Campo>
            ) : null}
          </div>
        </Seccion>
      ) : (
        // El macho no produce leche: no se pregunta aptitud ni último parto. Se le pregunta para qué es.
        // (`vocacion` se guarda como «carne» solo porque la columna no admite vacío; el dato real es `uso_macho`.)
        <Seccion titulo="Uso">
          <input type="hidden" name="vocacion" value="carne" />
          <div className="min-w-0 space-y-2 lg:max-w-md">
            <span className="block text-sm font-semibold">¿Para qué es este macho?</span>
            <SelectorTarjetas<UsoMacho | "por_definir">
              nombre="uso_macho"
              valor={usoMacho}
              onCambio={(v) => v && setUsoMacho(v)}
              titulo="Uso del macho"
              opciones={[
                { valor: "reproductor", etiqueta: "Reproductor", escena: ESCENA_USO_MACHO.reproductor },
                { valor: "carne", etiqueta: "Carne", escena: ESCENA_USO_MACHO.carne },
                { valor: "por_definir", etiqueta: "Por definir", escena: ESCENA_USO_MACHO.por_definir },
              ]}
            />
            <p className="text-[0.8125rem] text-humo">Reproductor es un semental para cubrir hembras. Carne es un animal de engorde. Puedes cambiarlo después.</p>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Genealogía">
        <p className="-mt-2 text-[0.8125rem] text-humo">Con padre y madre registrados calculamos la endogamia de cada cría.</p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Campo etiqueta="Padre">
            {(id) => (
              <SelectorAnimal id={id} nombre="padre_id" fincaId={fincaId} sexo="macho" especie={especie} titulo="Elegir el padre" valor={padre} onCambio={setPadre} excluir={animal?.id} incluirInactivos />
            )}
          </Campo>
          <Campo etiqueta="Madre">
            {(id) => (
              <SelectorAnimal id={id} nombre="madre_id" fincaId={fincaId} sexo="hembra" especie={especie} titulo="Elegir la madre" valor={madre} onCambio={setMadre} excluir={animal?.id} incluirInactivos />
            )}
          </Campo>
        </div>
        <details className="group" open={Boolean(animal?.padre_externo || animal?.madre_externa)}>
          <summary className="min-h-11 cursor-pointer list-none py-2.5 text-[0.9375rem] font-semibold text-musgo">
            Padres que no están en mi hato
          </summary>
          <div className="grid grid-cols-1 gap-5 pt-2 lg:grid-cols-2">
            <Campo etiqueta="Padre externo" ayuda="Nombre o código, por ejemplo de una pajilla de semen.">
              {(id) => <input id={id} name="padre_externo" defaultValue={animal?.padre_externo ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
            <Campo etiqueta="Madre externa">
              {(id) => <input id={id} name="madre_externa" defaultValue={animal?.madre_externa ?? ""} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
          </div>
        </details>
      </Seccion>

      <Seccion titulo="Notas">
        <Campo etiqueta="Notas" ayuda="Opcional. Cualquier cosa que quieras recordar de este animal.">
          {(id) => <textarea id={id} name="notas" defaultValue={animal?.notas ?? ""} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
        </Campo>
      </Seccion>

      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}

      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando={editando ? "Guardando cambios…" : "Guardando animal…"} disabled={subiendoFoto}>
          {subiendoFoto ? "Esperando la foto…" : editando ? "Guardar cambios" : "Guardar animal"}
        </Boton>
        {animal ? (
          <Link href={`/hato/${animal.id}`} className={clasesBoton("fantasma")}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
