"use client";

import { useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Selector } from "@/components/Selector";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { useToast } from "@/components/Toast";
import { InsigniaCampo } from "@/components/campo/EstadoCampo";
import { esquemaAnimal, prepararAnimalNuevo } from "@/lib/animal-nuevo";
import { nombreTipo } from "@/lib/animal";
import { coberturaEfectiva, ETIQUETA_COBERTURA } from "@/lib/esquila";
import { ESCENA_COBERTURA, ESCENA_ESPECIE, ESCENA_ORIGEN_ANIMAL, ESCENA_SEXO, ESCENA_USO_MACHO, ESCENA_VOCACION } from "@/lib/escenas-forms-b-hato";
import { MENSAJE_GUARDADO_LOCAL, areteRepetido, etiquetaCampo, padresPosibles, type ReferenciaCampo, type RegistroCampo } from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";
import type { Cobertura, Especie, SexoAnimal, UsoMacho, Vocacion } from "@/lib/tipos";

/** Colores más usados en el libro genealógico (los mismos del formulario con señal). */
const COLORES = ["Blanco", "Chamoisée", "Negro", "Crema", "Café", "Broken", "Pinto"];

type Origen = "nacido_en_finca" | "comprado";

/** Los campos del formulario, con los mismos nombres que envía el formulario con señal (así el servidor los valida igual). */
type Campos = {
  especie: Especie;
  sexo: SexoAnimal;
  numero_arete: string;
  nombre: string;
  raza_id: string;
  fecha_nacimiento: string;
  fecha_nacimiento_aprox: boolean;
  origen: Origen;
  peso_nacer_kg: string;
  vocacion: Vocacion;
  uso_macho: UsoMacho | "por_definir";
  cobertura: Cobertura | "segun_raza";
  fecha_ultimo_parto: string;
  padre_id: string;
  madre_id: string;
  padre_externo: string;
  madre_externa: string;
  chip: string;
  color: string;
  marcas: string;
  rasgos: string;
  notas: string;
};

const vacios = (especie: Especie, proposito: Vocacion, previo?: Partial<Campos>): Campos => ({
  especie,
  sexo: "hembra",
  numero_arete: "",
  nombre: "",
  raza_id: "",
  fecha_nacimiento: "",
  fecha_nacimiento_aprox: false,
  origen: previo?.origen ?? "nacido_en_finca",
  peso_nacer_kg: "",
  vocacion: previo?.vocacion ?? proposito,
  uso_macho: "por_definir",
  cobertura: "segun_raza",
  fecha_ultimo_parto: "",
  padre_id: "",
  madre_id: "",
  padre_externo: "",
  madre_externa: "",
  chip: "",
  color: "",
  marcas: "",
  rasgos: "",
  notas: "",
});

/** Lo que viaja: texto, como un formulario (lo que no aplica al animal se manda vacío). */
function aTexto(c: Campos): Record<string, string> {
  const t: Record<string, string> = {};
  for (const [k, v] of Object.entries(c)) {
    if (k === "fecha_nacimiento_aprox") {
      if (v) t[k] = "on";
    } else if (typeof v === "string" && v.trim() !== "") t[k] = v.trim();
  }
  if (c.sexo === "macho") {
    t.vocacion = "carne";
    delete t.fecha_ultimo_parto;
  } else {
    delete t.uso_macho;
    if (c.vocacion === "carne") delete t.fecha_ultimo_parto;
  }
  if (c.origen === "comprado") delete t.peso_nacer_kg;
  if (c.especie !== "ovino") delete t.cobertura;
  return t;
}

const deTexto = (t: Record<string, string>, base: Campos): Campos => ({ ...base, ...t, fecha_nacimiento_aprox: t.fecha_nacimiento_aprox === "on" } as Campos);

/**
 * El animal nuevo sin señal: los mismos datos que el formulario con señal (salvo la foto y el valor de compra, que se agregan después en su ficha),
 * con las mismas reglas (`esquemaAnimal` + `prepararAnimalNuevo`). Avisa si el arete ya existe en la finca o en otro animal guardado aquí. Al
 * guardar, el formulario queda listo para el siguiente (conserva especie, origen y aptitud) y abajo se ve lo creado en este celular.
 */
export function AnimalCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const especies = referencia.especies.length > 0 ? referencia.especies : (["caprino"] as Especie[]);
  const [c, setC] = useState<Campos>(() => vacios(especies[0], referencia.proposito));
  const [editando, setEditando] = useState<RegistroCampo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const fincaId = referencia.finca.id;
  const poner = <K extends keyof Campos>(k: K, v: Campos[K]) => {
    setC((p) => ({ ...p, [k]: v }));
    setError(null);
  };

  const razas = useMemo(() => referencia.razas.filter((r) => r.especie === c.especie).map((r) => ({ valor: String(r.id), etiqueta: r.nombre })), [referencia.razas, c.especie]);
  const etiquetaPadre = (a: { arete: string; nombre: string | null; activo: boolean }) => `${etiquetaCampo(a)}${a.activo ? "" : " · ya salió"}`;
  const padres = useMemo(() => padresPosibles(referencia, c.especie, "macho").map((a) => ({ valor: a.id, etiqueta: etiquetaPadre(a) })), [referencia, c.especie]);
  const madres = useMemo(() => padresPosibles(referencia, c.especie, "hembra").map((a) => ({ valor: a.id, etiqueta: etiquetaPadre(a) })), [referencia, c.especie]);
  const coberturaRaza = coberturaEfectiva("ovino", null, referencia.razas.find((r) => String(r.id) === c.raza_id)?.cobertura ?? null);
  const etiquetasSexo = c.especie === "caprino" ? ["Cabra", "Cabro"] : ["Oveja", "Carnero"];
  const repetido = areteRepetido(c.numero_arete, referencia, registros, editando?.id);
  const creados = registros.filter((r) => r.tipo === "animal" && r.usuarioId === usuarioId && r.fincaId === fincaId).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

  const cambiarEspecie = (e: Especie) => setC((p) => ({ ...p, especie: e, raza_id: "", cobertura: "segun_raza", padre_id: "", madre_id: "" }));

  const guardar = async () => {
    if (repetido) return setError("Ya hay un animal con ese número de arete en tu finca.");
    const campos = aTexto(c);
    const datos = esquemaAnimal.safeParse(campos);
    if (!datos.success) return setError(datos.error.issues[0]?.message ?? "Revisa los datos.");
    if (datos.data.fecha_nacimiento && datos.data.fecha_nacimiento > hoy) return setError("La fecha de nacimiento no puede ser futura.");
    const listo = prepararAnimalNuevo(datos.data, especies);
    if ("error" in listo) return setError(listo.error);
    setGuardando(true);
    try {
      const id = editando?.id ?? crypto.randomUUID();
      await guardarEnCelular({
        id,
        creadoEn: editando?.creadoEn,
        tipo: "animal",
        usuarioId,
        fincaId,
        animalId: id,
        etiqueta: `${etiquetaCampo({ arete: datos.data.numero_arete, nombre: datos.data.nombre ?? null })} · ${nombreTipo(c.especie, c.sexo)}`,
        fecha: hoy,
        campos,
      });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? `${datos.data.numero_arete} guardado` : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    setEditando(null);
    setC(vacios(c.especie, referencia.proposito, c));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const corregir = (r: RegistroCampo) => {
    setEditando(r);
    setC(deTexto(r.campos ?? {}, vacios(especies[0], referencia.proposito)));
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!referencia.puede.hato) return <Aviso>Tu rol no registra animales en esta finca.</Aviso>;

  return (
    <div className="space-y-6">
      {editando ? (
        <Aviso tipo="atencion">
          Estás corrigiendo {editando.etiqueta}, que aún no se ha enviado.{" "}
          <button type="button" onClick={() => { setEditando(null); setC(vacios(especies[0], referencia.proposito)); }} className="font-semibold text-musgo underline underline-offset-4">Cancelar</button>
        </Aviso>
      ) : null}

      <section className="space-y-5">
        {especies.length > 1 ? (
          <SelectorTarjetas<Especie>
            titulo="Especie"
            valor={c.especie}
            onCambio={(v) => v && cambiarEspecie(v)}
            opciones={[
              { valor: "caprino", etiqueta: "Caprino", detalle: "Cabras y cabros", escena: ESCENA_ESPECIE.caprino },
              { valor: "ovino", etiqueta: "Ovino", detalle: "Ovejas y carneros", escena: ESCENA_ESPECIE.ovino },
            ]}
          />
        ) : null}
        <SelectorTarjetas<SexoAnimal>
          titulo="Sexo"
          valor={c.sexo}
          onCambio={(v) => v && poner("sexo", v)}
          opciones={[
            { valor: "hembra", etiqueta: etiquetasSexo[0], escena: ESCENA_SEXO.hembra },
            { valor: "macho", etiqueta: etiquetasSexo[1], escena: ESCENA_SEXO.macho },
          ]}
        />
        <Campo etiqueta="Número de arete" ayuda="Debe ser único en tu finca.">
          {(id) => <input id={id} value={c.numero_arete} onChange={(e) => poner("numero_arete", e.target.value)} maxLength={40} autoComplete="off" autoCapitalize="characters" className={CLASE_INPUT} placeholder="Ej. 0123" />}
        </Campo>
        {repetido ? <Aviso tipo="atencion">Ya hay un animal con ese arete en tu finca (o guardado en este celular).</Aviso> : null}
        <Campo etiqueta="Nombre" ayuda="Opcional.">
          {(id) => <input id={id} value={c.nombre} onChange={(e) => poner("nombre", e.target.value)} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
        </Campo>
        <Campo etiqueta="Raza">
          {(id) => <Selector id={id} titulo="Raza" valor={c.raza_id} opciones={razas} onCambio={(v) => poner("raza_id", String(v))} placeholder="Sin especificar" permitirVacio />}
        </Campo>
        {c.especie === "ovino" ? (
          <SelectorTarjetas<Cobertura | "segun_raza">
            titulo="¿Es de lana o de pelo?"
            valor={c.cobertura}
            onCambio={(v) => v && poner("cobertura", v)}
            opciones={[
              { valor: "segun_raza", etiqueta: "Según su raza", detalle: c.raza_id === "" ? "Elige la raza" : ETIQUETA_COBERTURA[coberturaRaza ?? "por_definir"], escena: ESCENA_COBERTURA.segun_raza },
              { valor: "lana", etiqueta: "De lana", detalle: "Se esquila", escena: ESCENA_COBERTURA.lana },
              { valor: "pelo", etiqueta: "De pelo", detalle: "No se esquila", escena: ESCENA_COBERTURA.pelo },
            ]}
          />
        ) : null}
      </section>

      <section className="space-y-5">
        <div className="space-y-1">
          <Campo etiqueta="Fecha de nacimiento">
            {(id) => <input id={id} type="date" value={c.fecha_nacimiento} max={hoy} onChange={(e) => poner("fecha_nacimiento", e.target.value)} className={CLASE_INPUT} />}
          </Campo>
          <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
            <input type="checkbox" checked={c.fecha_nacimiento_aprox} onChange={(e) => poner("fecha_nacimiento_aprox", e.target.checked)} className="size-5 accent-[var(--musgo)]" />
            Es una fecha aproximada
          </label>
        </div>
        <SelectorTarjetas<Origen>
          titulo="Origen"
          valor={c.origen}
          onCambio={(v) => v && poner("origen", v)}
          opciones={[
            { valor: "nacido_en_finca", etiqueta: "Nació aquí", escena: ESCENA_ORIGEN_ANIMAL.nacido_en_finca },
            { valor: "comprado", etiqueta: "Comprado", escena: ESCENA_ORIGEN_ANIMAL.comprado },
          ]}
        />
        {c.origen === "nacido_en_finca" ? (
          <Campo etiqueta="Peso al nacer" ayuda="Opcional. En kilos, por ejemplo 3,2.">
            {(id) => <input id={id} value={c.peso_nacer_kg} onChange={(e) => poner("peso_nacer_kg", e.target.value)} inputMode="decimal" autoComplete="off" className={CLASE_INPUT} placeholder="Ej. 3,2" />}
          </Campo>
        ) : null}
        {c.sexo === "hembra" ? (
          <>
            <SelectorTarjetas<Vocacion>
              titulo="Aptitud"
              valor={c.vocacion}
              onCambio={(v) => v && poner("vocacion", v)}
              opciones={[
                { valor: "leche", etiqueta: "Leche", escena: ESCENA_VOCACION.leche },
                { valor: "carne", etiqueta: "Carne", escena: ESCENA_VOCACION.carne },
                { valor: "doble", etiqueta: "Ambas", escena: ESCENA_VOCACION.doble },
              ]}
            />
            {c.vocacion !== "carne" ? (
              <Campo etiqueta="Fecha del último parto" ayuda="Si ya está en leche, así se abre su lactancia y aparece en el ordeño.">
                {(id) => <input id={id} type="date" value={c.fecha_ultimo_parto} max={hoy} onChange={(e) => poner("fecha_ultimo_parto", e.target.value)} className={CLASE_INPUT} />}
              </Campo>
            ) : null}
          </>
        ) : (
          <SelectorTarjetas<UsoMacho | "por_definir">
            titulo="¿Para qué es este macho?"
            valor={c.uso_macho}
            onCambio={(v) => v && poner("uso_macho", v)}
            opciones={[
              { valor: "reproductor", etiqueta: "Reproductor", escena: ESCENA_USO_MACHO.reproductor },
              { valor: "carne", etiqueta: "Carne", escena: ESCENA_USO_MACHO.carne },
              { valor: "por_definir", etiqueta: "Por definir", escena: ESCENA_USO_MACHO.por_definir },
            ]}
          />
        )}
        <Campo etiqueta="Padre">
          {(id) => <Selector id={id} titulo="Elegir el padre" valor={c.padre_id} opciones={padres} onCambio={(v) => poner("padre_id", String(v))} placeholder="Sin padre registrado" permitirVacio />}
        </Campo>
        <Campo etiqueta="Madre">
          {(id) => <Selector id={id} titulo="Elegir la madre" valor={c.madre_id} opciones={madres} onCambio={(v) => poner("madre_id", String(v))} placeholder="Sin madre registrada" permitirVacio />}
        </Campo>
      </section>

      <details className="group">
        <summary className="min-h-11 cursor-pointer list-none py-2.5 text-[0.9375rem] font-semibold text-musgo">Más datos (opcional)</summary>
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Campo etiqueta="Color" ayuda="Toca uno o escríbelo.">
              {(id) => <input id={id} value={c.color} onChange={(e) => poner("color", e.target.value)} maxLength={60} autoComplete="off" className={CLASE_INPUT} />}
            </Campo>
            <FilaDesplazable>
              {COLORES.map((col) => (
                <Chip key={col} activo={c.color.trim().toLowerCase() === col.toLowerCase()} onClick={() => poner("color", col)}>{col}</Chip>
              ))}
            </FilaDesplazable>
          </div>
          <Campo etiqueta="Microchip">
            {(id) => <input id={id} value={c.chip} onChange={(e) => poner("chip", e.target.value)} maxLength={40} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Marcas" ayuda="Chapeta, muesca, collar o tatuaje con que lo identificas.">
            {(id) => <input id={id} value={c.marcas} onChange={(e) => poner("marcas", e.target.value)} maxLength={120} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Rasgos" ayuda="Señas particulares que lo distinguen.">
            {(id) => <input id={id} value={c.rasgos} onChange={(e) => poner("rasgos", e.target.value)} maxLength={200} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Padre que no está en mi hato" ayuda="Nombre o código, por ejemplo de una pajilla de semen.">
            {(id) => <input id={id} value={c.padre_externo} onChange={(e) => poner("padre_externo", e.target.value)} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Madre que no está en mi hato">
            {(id) => <input id={id} value={c.madre_externa} onChange={(e) => poner("madre_externa", e.target.value)} maxLength={80} autoComplete="off" className={CLASE_INPUT} />}
          </Campo>
          <Campo etiqueta="Notas">
            {(id) => <textarea id={id} value={c.notas} onChange={(e) => poner("notas", e.target.value)} rows={3} maxLength={1000} className={`${CLASE_INPUT} py-3`} />}
          </Campo>
        </div>
      </details>

      <p className="text-sm text-humo">La foto y el valor de compra se agregan después, desde su ficha, cuando haya señal.</p>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…">{editando ? "Guardar corrección" : "Guardar animal"}</Boton>

      {creados.length > 0 ? (
        <section className="space-y-3" aria-labelledby="titulo-creados">
          <h2 id="titulo-creados" className="font-display text-xl font-semibold">Creados en este celular · {creados.length}</h2>
          <ListaPorTramos
            items={creados}
            clave={(r) => r.id}
            fila={(r) => (
              <div className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 ring-1 ring-arena">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{r.etiqueta}</span>
                  {r.estado === "error" && r.error ? <span className="block text-sm text-rojo [overflow-wrap:anywhere]">{r.error}</span> : null}
                  {r.estado !== "enviado" ? (
                    <button type="button" onClick={() => corregir(r)} className="mt-0.5 inline-flex min-h-11 items-center text-sm font-semibold text-musgo underline-offset-4 hover:underline">Corregir</button>
                  ) : null}
                </span>
                <InsigniaCampo r={r} />
              </div>
            )}
          />
        </section>
      ) : null}
    </div>
  );
}
