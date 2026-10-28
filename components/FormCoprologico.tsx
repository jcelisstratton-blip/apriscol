"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { AsistidoPor } from "@/components/AsistidoPor";
import { Insignia } from "@/components/Insignia";
import { Selector } from "@/components/Selector";
import { SelectorAnimal } from "@/components/SelectorAnimal";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { ESCENA_MUESTRA } from "@/lib/escenas-listas-sanidad";
import type { VeterinarioRef } from "@/lib/veterinarios";
import { crearCoprologico, editarCoprologico } from "@/app/(app)/sanidad/actions";
import {
  AYUDA_MUESTRA,
  AYUDA_OOQUISTES,
  DETALLE_MUESTRA,
  ETIQUETA_MUESTRA,
  TIPOS_MUESTRA,
  type TipoMuestra,
  AYUDA_TECNICA,
  ETIQUETA_MOMENTO,
  ETIQUETA_OTRO_PARASITO,
  ETIQUETA_TECNICA,
  OTROS_PARASITOS,
  TECNICAS_COPROLOGICO,
  interpretarHpg,
  type MomentoCoprologico,
  type OtroParasito,
  type TecnicaCoprologico,
} from "@/lib/coprologico";
import { leerNumero } from "@/lib/numeros";
import type { ExamenCoprologico } from "@/lib/tipos";

const entero = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/**
 * Registrar el examen coprológico de un animal (viene fijo desde su ficha) o corregir uno. Si se llega desde una desparasitación (`evento`), es uno de los
 * dos de la prueba de eficacia: antes o después de aplicarla.
 */
export function FormCoprologico({
  animalId: animalFijo,
  fincaId,
  hoy,
  examen,
  evento,
  momentoInicial,
  veterinarios,
  puedeAgregarVeterinario,
}: {
  /** El animal, si ya viene elegido (desde su ficha o su desparasitación). Si no, se elige en el formulario. */
  animalId?: string;
  /** Hace falta para elegir el animal cuando no viene fijo. */
  fincaId?: string;
  hoy: string;
  examen?: ExamenCoprologico;
  /** La desparasitación a la que pertenece el examen (prueba de eficacia). */
  evento?: { id: string; titulo: string };
  momentoInicial?: Exclude<MomentoCoprologico, "diagnostico">;
  /** Los veterinarios del equipo: quien toma la muestra suele ser uno de ellos. */
  veterinarios: VeterinarioRef[];
  puedeAgregarVeterinario: boolean;
}) {
  const editando = Boolean(examen);
  const [elegido, setElegido] = useState<{ id: string; numero_arete: string; nombre: string | null } | null>(null);
  const animalId = animalFijo ?? elegido?.id ?? "";
  const [estado, enviar, pendiente] = useActionState(editando ? editarCoprologico : crearCoprologico, undefined);
  const [, iniciar] = useTransition();
  const [tecnica, setTecnica] = useState<TecnicaCoprologico>(examen?.tecnica ?? "mcmaster");
  const [momento, setMomento] = useState<MomentoCoprologico>(examen?.momento ?? (evento ? (momentoInicial ?? "antes") : "diagnostico"));
  const [muestra, setMuestra] = useState<TipoMuestra | "">(examen?.tipo_muestra ?? "");
  const [hpg, setHpg] = useState(entero(examen?.hpg));
  const [opg, setOpg] = useState(entero(examen?.opg));
  const [otros, setOtros] = useState<OtroParasito[]>((examen?.otros_parasitos ?? []) as OtroParasito[]);

  const eventoId = evento?.id ?? examen?.evento_id ?? "";
  const hpgNum = hpg.trim() ? leerNumero(hpg) : null;
  const lectura = hpgNum !== null && hpgNum >= 0 && momento === "diagnostico" ? interpretarHpg(hpgNum) : null;

  // Se envía con onSubmit (no con `action`): si hay un error, lo que la persona escribió no se borra.
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    iniciar(() => enviar(datos));
  };
  const volver = eventoId ? `/sanidad/evento/${eventoId}` : animalFijo ? `/hato/${animalFijo}#sanidad` : "/sanidad?vista=coprologicos";

  return (
    <form onSubmit={alEnviar} className="space-y-5">
      <input type="hidden" name="animal_id" value={animalId} />
      {examen ? <input type="hidden" name="examen_id" value={examen.id} /> : null}
      {eventoId ? <input type="hidden" name="evento_id" value={eventoId} /> : null}
      <input type="hidden" name="momento" value={momento} />
      {otros.map((o) => (
        <input key={o} type="hidden" name="otros_parasitos" value={o} />
      ))}

      {eventoId ? (
        <div className="space-y-2">
          <Aviso tipo="info">
            Prueba de eficacia de: <span className="font-semibold">{evento?.titulo ?? "la desparasitación"}</span>. Se cuenta un examen antes de desparasitar y otro 10 a 14 días después.
          </Aviso>
          <FilaDesplazable>
            {(["antes", "despues"] as const).map((m) => (
              <Chip key={m} activo={momento === m} onClick={() => setMomento(m)}>
                {ETIQUETA_MOMENTO[m]}
              </Chip>
            ))}
          </FilaDesplazable>
        </div>
      ) : null}

      {!animalFijo && fincaId ? (
        <Campo etiqueta="Animal" ayuda="A quién se le tomó la muestra. Si fue de varios, anótalo en observaciones y registra el examen del más representativo.">
          {(idc) => <SelectorAnimal id={idc} nombre="animal_id_elegido" fincaId={fincaId} titulo="¿De qué animal es la muestra?" valor={elegido} onCambio={setElegido} vacio="Elegir animal" soloActivos />}
        </Campo>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-semibold" id="muestra-titulo">Prueba recogida: ¿cómo se tomó la muestra?</p>
        <input type="hidden" name="tipo_muestra" value={muestra} />
        <SelectorTarjetas<TipoMuestra>
          id="muestra-opciones"
          valor={muestra}
          onCambio={(v) => v && setMuestra(v)}
          titulo="¿Cómo se tomó la muestra?"
          opciones={TIPOS_MUESTRA.map((t) => ({ valor: t, etiqueta: ETIQUETA_MUESTRA[t], detalle: DETALLE_MUESTRA[t], escena: ESCENA_MUESTRA[t] }))}
        />
        {muestra ? <Aviso tipo={muestra === "contaminada" ? "atencion" : "info"}>{AYUDA_MUESTRA[muestra]}</Aviso> : null}
        {muestra === "contaminada" && momento !== "diagnostico" ? <Aviso tipo="error">La prueba de eficacia necesita muestras limpias, tomadas directamente del animal.</Aviso> : null}
      </div>

      <AsistidoPor nombre="tomada_por" etiqueta="¿Quién tomó la muestra?" ayuda="El veterinario de la finca u otra persona." veterinarios={veterinarios} puedeAgregar={puedeAgregarVeterinario} inicial={examen?.tomada_por} requerido={!editando} />

      <Campo etiqueta="Fecha de la muestra">
        {(id) => <input id={id} name="fecha" type="date" defaultValue={examen?.fecha ?? hoy} max={hoy} required className={CLASE_INPUT} />}
      </Campo>

      <Campo etiqueta="Técnica" ayuda={AYUDA_TECNICA[tecnica]}>
        {(id) => (
          <Selector id={id} nombre="tecnica" valor={tecnica} onCambio={(v) => v && setTecnica(v as TecnicaCoprologico)} titulo="¿Qué técnica se usó?" opciones={TECNICAS_COPROLOGICO.map((t) => ({ valor: t, etiqueta: ETIQUETA_TECNICA[t], detalle: AYUDA_TECNICA[t] }))} />
        )}
      </Campo>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <Campo etiqueta="Huevos por gramo (HPG)" ayuda="Huevos de gusanos de estómago e intestino (estrongilos).">
          {(id) => <input id={id} name="hpg" value={hpg} onChange={(e) => setHpg(e.target.value)} inputMode="numeric" autoComplete="off" disabled={tecnica === "flotacion"} className={CLASE_INPUT} placeholder="Ej. 1.200" />}
        </Campo>
        <Campo etiqueta="Ooquistes por gramo (OPG)" ayuda="Coccidios. Opcional.">
          {(id) => <input id={id} name="opg" value={opg} onChange={(e) => setOpg(e.target.value)} inputMode="numeric" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 5.000" />}
        </Campo>
      </div>

      {lectura ? (
        <div aria-live="polite" className="space-y-2 rounded-2xl bg-papel p-3 ring-1 ring-arena">
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono={lectura.tono}>{lectura.texto}</Insignia>
          </div>
          <Aviso tipo={lectura.tono === "alerta" || lectura.tono === "aviso" ? "atencion" : "info"}>
            <span className="font-semibold">Qué hacer: </span>
            {lectura.accion}
          </Aviso>
        </div>
      ) : null}
      {opg.trim() ? <p className="text-sm text-humo">{AYUDA_OOQUISTES}</p> : null}

      <div className="space-y-2">
        <p className="text-sm font-semibold">¿Se vio otro parásito? (opcional)</p>
        <FilaDesplazable>
          {OTROS_PARASITOS.map((o) => (
            <Chip key={o} activo={otros.includes(o)} onClick={() => setOtros(otros.includes(o) ? otros.filter((x) => x !== o) : [...otros, o])}>
              {ETIQUETA_OTRO_PARASITO[o]}
            </Chip>
          ))}
        </FilaDesplazable>
      </div>

      <Campo etiqueta="Laboratorio o quién lo leyó" ayuda="Opcional.">
        {(id) => <input id={id} name="laboratorio" defaultValue={examen?.laboratorio ?? ""} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
      </Campo>
      <Campo etiqueta="Observaciones" ayuda="Opcional: diarrea, condición corporal, si es una muestra de varios animales…">
        {(id) => <textarea id={id} name="observaciones" defaultValue={examen?.observaciones ?? ""} rows={2} maxLength={300} className={`${CLASE_INPUT} py-3`} />}
      </Campo>

      {!animalId ? <Aviso tipo="atencion">Elige el animal para guardar.</Aviso> : !hpg.trim() && !opg.trim() ? <Aviso tipo="atencion">Escribe al menos un resultado (HPG u OPG) para guardar.</Aviso> : null}
      {estado?.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="space-y-2">
        <Boton type="submit" pendiente={pendiente} cargando="Guardando…" disabled={(!hpg.trim() && !opg.trim()) || !animalId || (!editando && !muestra) || (muestra === "contaminada" && momento !== "diagnostico")}>
          {editando ? "Guardar cambios" : "Guardar examen"}
        </Boton>
        <Link href={volver} className={clasesBoton("fantasma")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
