"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Droplets } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { Segmentado } from "@/components/Segmentado";
import { Sheet } from "@/components/Sheet";
import { Teclado } from "@/components/Teclado";
import { useToast } from "@/components/Toast";
import { guardarOrdeno, sacarDelOrdeno } from "@/app/(app)/leche/actions";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { litros as fmt, sumarDias } from "@/lib/fechas";
import { etiquetaAnimal } from "@/lib/animal";
import type { Jornada } from "@/lib/tipos";

type AnimalLeche = { id: string; numero_arete: string; nombre: string | null };
type Registro = { litros: number; descartada: boolean };
type JornadaSimple = Exclude<Jornada, "unico">;

const MAX_LITROS = 15;

/**
 * Captura rápida de ordeño: una hoja con teclado numérico grande por animal y salto automático al siguiente
 * (patrón de Mobbin: MacroFactor, Yuka, Fi — número grande, un solo botón principal fijo abajo).
 */
export function CapturaLeche({
  fincaId,
  hoy,
  animales,
  retiros,
  jornadaInicial,
  puedeEditar = false,
}: {
  fincaId: string;
  hoy: string;
  animales: AnimalLeche[];
  retiros: Record<string, string>;
  jornadaInicial: JornadaSimple;
  puedeEditar?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [jornada, setJornada] = useState<JornadaSimple>(jornadaInicial);
  const [dia, setDia] = useState<"hoy" | "ayer">("hoy");
  const [vista, setVista] = useState<"pendientes" | "hechas">("pendientes");
  const [carga, setCarga] = useState<{ clave: string; registros: Record<string, Registro>; error: string | null } | null>(null);
  const [activo, setActivo] = useState<AnimalLeche | null>(null);
  const [texto, setTexto] = useState("");
  const [descartar, setDescartar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [guardando, iniciar] = useTransition();

  const fecha = dia === "hoy" ? hoy : sumarDias(hoy, -1);
  const clave = `${fecha}|${jornada}`;
  const cargando = carga?.clave !== clave;
  const registros = useMemo(() => (carga?.clave === clave ? carga.registros : {}), [carga, clave]);
  const errorCarga = carga?.clave === clave ? carga.error : null;
  const setRegistros = (nuevos: Record<string, Registro>) => setCarga({ clave, registros: nuevos, error: null });

  useEffect(() => {
    let vigente = true;
    crearClienteNavegador()
      .from("ordenos")
      .select("animal_id, litros, descartada")
      .eq("finca_id", fincaId)
      .eq("fecha", fecha)
      .eq("jornada", jornada)
      .then(({ data, error: e }) => {
        if (!vigente) return;
        setCarga({
          clave,
          error: e ? e.message : null,
          registros: Object.fromEntries((data ?? []).map((o) => [o.animal_id, { litros: Number(o.litros), descartada: o.descartada }])),
        });
      });
    return () => {
      vigente = false;
    };
  }, [fincaId, fecha, jornada, clave]);

  const hechas = animales.filter((a) => registros[a.id]);
  const pendientes = animales.filter((a) => !registros[a.id]);
  const totalTanque = hechas.reduce((s, a) => s + (registros[a.id].descartada ? 0 : registros[a.id].litros), 0);
  const totalDescartado = hechas.reduce((s, a) => s + (registros[a.id].descartada ? registros[a.id].litros : 0), 0);
  const lista = vista === "pendientes" ? pendientes : hechas;

  const abrir = useCallback(
    (a: AnimalLeche) => {
      const previo = registros[a.id];
      setActivo(a);
      setTexto(previo ? String(previo.litros) : "");
      setDescartar(previo?.descartada ?? false);
      setError(null);
      setConfirmandoSalida(false);
    },
    [registros],
  );

  const tecla = (t: string) => {
    setError(null);
    if (t === "borrar") return setTexto((v) => v.slice(0, -1));
    if (t === ".") return setTexto((v) => (v.includes(".") ? v : v === "" ? "0." : `${v}.`));
    setTexto((v) => {
      const nuevo = v === "0" ? t : v + t;
      if (/\.\d{3,}/.test(nuevo)) return v;
      return Number(nuevo) > MAX_LITROS ? v : nuevo;
    });
  };

  const valor = texto === "" || texto === "." ? null : Number(texto);
  const enRetiro = activo ? Boolean(retiros[activo.id]) : false;

  const guardar = () => {
    if (!activo || valor === null) return;
    const actual = activo;
    iniciar(async () => {
      const r = await guardarOrdeno({
        animalId: actual.id,
        fecha,
        jornada,
        litros: valor,
        descartar: descartar || enRetiro,
        solicitud: crypto.randomUUID(),
      });
      if (!r.ok) return setError(r.error);
      const nuevos = { ...registros, [actual.id]: { litros: r.litros, descartada: r.descartada } };
      setRegistros(nuevos);
      const siguiente = animales.find((a) => a.id !== actual.id && !nuevos[a.id] && animales.indexOf(a) > animales.indexOf(actual)) ??
        animales.find((a) => a.id !== actual.id && !nuevos[a.id]);
      if (siguiente) {
        toast.exito(`${etiquetaAnimal(actual)}: ${fmt(r.litros)} L`);
        setActivo(siguiente);
        setTexto("");
        setDescartar(false);
        setError(null);
      } else {
        setActivo(null);
        toast.exito("Jornada completa. ¡Buen ordeño!");
      }
    });
  };

  const sacar = () => {
    if (!activo) return;
    const actual = activo;
    iniciar(async () => {
      const r = await sacarDelOrdeno(actual.id);
      if (!r.ok) return setError(r.error);
      toast.exito(`${etiquetaAnimal(actual)} salió del ordeño`);
      setActivo(null);
      setConfirmandoSalida(false);
      router.refresh();
    });
  };

  const progreso = animales.length ? Math.round((hechas.length / animales.length) * 100) : 0;
  const etiquetaJornada = useMemo(() => (jornada === "manana" ? "mañana" : jornada === "tarde" ? "tarde" : "noche"), [jornada]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Segmentado<JornadaSimple>
          etiqueta="Jornada"
          valor={jornada}
          onCambio={setJornada}
          opciones={[
            { valor: "manana", etiqueta: "Mañana" },
            { valor: "tarde", etiqueta: "Tarde" },
            { valor: "noche", etiqueta: "Noche" },
          ]}
        />
        <FilaDesplazable>
          <Chip activo={dia === "hoy"} onClick={() => setDia("hoy")}>Hoy</Chip>
          <Chip activo={dia === "ayer"} onClick={() => setDia("ayer")}>Ayer</Chip>
        </FilaDesplazable>
      </div>

      <section className="rounded-3xl bg-musgo p-4 text-sobre-musgo" aria-live="polite">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold opacity-85">Ordeño de la {etiquetaJornada}</p>
            <p className="font-display text-4xl font-semibold leading-tight tabular-nums">
              {fmt(totalTanque)}
              <span className="ml-1 text-lg font-medium opacity-80">L</span>
            </p>
          </div>
          <p className="shrink-0 pb-1 text-right text-sm font-semibold">
            {hechas.length} de {animales.length}
            {totalDescartado > 0 ? <span className="block text-xs font-medium opacity-85">{fmt(totalDescartado)} L descartados</span> : null}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sobre-musgo/20" role="progressbar" aria-valuenow={progreso} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-sobre-musgo transition-all" style={{ width: `${progreso}%` }} />
        </div>
      </section>

      <FilaDesplazable>
        <Chip activo={vista === "pendientes"} onClick={() => setVista("pendientes")}>Pendientes · {pendientes.length}</Chip>
        <Chip activo={vista === "hechas"} onClick={() => setVista("hechas")}>Registradas · {hechas.length}</Chip>
      </FilaDesplazable>

      {errorCarga ? <Aviso tipo="error">{errorCarga}</Aviso> : null}

      {vista === "pendientes" && pendientes.length > 0 ? (
        <p className="-mt-1 px-1 text-sm text-humo">Toca un animal para escribir los litros que dio en esta jornada.</p>
      ) : null}

      {!cargando && lista.length === 0 ? (
        <p className="py-8 text-center text-[0.9375rem] text-humo">
          {vista === "pendientes" ? "No queda ningún animal por ordeñar en esta jornada." : "Todavía no has registrado ningún animal en esta jornada."}
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-2.5">
        {lista.map((a) => {
          const r = registros[a.id];
          return (
            <li key={a.id} className="min-w-0">
              <button
                type="button"
                onClick={() => abrir(a)}
                className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 text-left ring-1 ring-arena transition active:scale-[0.99]"
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-full ${r ? "bg-ok/15 text-ok" : "bg-arena text-humo"}`}>
                  {r ? <Check className="size-5" strokeWidth={2.4} /> : <Droplets className="size-5" strokeWidth={1.75} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{a.numero_arete}</span>
                  <span className="block truncate text-sm text-humo">{a.nombre ?? "Sin nombre"}</span>
                  {retiros[a.id] ? <span className="mt-1 block"><Insignia tono="aviso">En retiro · se descarta</Insignia></span> : null}
                </span>
                {r ? (
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-bold tabular-nums">{fmt(r.litros)} L</span>
                    {r.descartada ? <Insignia tono="aviso">Descartada</Insignia> : null}
                  </span>
                ) : (
                  <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet
        abierta={activo !== null}
        onCerrar={() => setActivo(null)}
        titulo={activo ? etiquetaAnimal(activo) : ""}
        pie={
          <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={valor === null}>
            Guardar y siguiente
          </Boton>
        }
      >
        <div className="space-y-4">
          <div className="rounded-3xl bg-lana py-5 text-center">
            <p className="font-display text-6xl font-semibold tabular-nums leading-none">
              {texto === "" ? <span className="text-humo/50">0</span> : texto.replace(".", ",")}
              <span className="ml-2 text-2xl font-medium text-humo">L</span>
            </p>
            <p className="mt-2 text-sm text-humo">Litros de la {etiquetaJornada}</p>
          </div>
          <Teclado onTecla={tecla} />
          {enRetiro ? (
            <Aviso tipo="atencion">Este animal está en periodo de retiro: su leche se registra como descartada y no entra al tanque.</Aviso>
          ) : (
            <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
              <input type="checkbox" checked={descartar} onChange={(e) => setDescartar(e.target.checked)} className="size-5 accent-[var(--musgo)]" />
              Esta leche no va al tanque (mastitis, calostro…)
            </label>
          )}
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
          {puedeEditar ? (
            confirmandoSalida ? (
              <div className="space-y-2 rounded-2xl bg-lana p-3.5">
                <p className="text-[0.9375rem]">
                  ¿Ya no se ordeña? Sale de esta lista y su lactancia queda cerrada hoy. Sus registros anteriores se conservan.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Boton variante="secundario" onClick={() => setConfirmandoSalida(false)} disabled={guardando}>Cancelar</Boton>
                  <Boton variante="peligro" onClick={sacar} pendiente={guardando} cargando="Sacando…">Sí, sacarla</Boton>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmandoSalida(true)} className="min-h-11 w-full text-center text-[0.9375rem] font-semibold text-humo underline-offset-4 hover:underline">
                Ya no está en ordeño
              </button>
            )
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
