"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight, Stethoscope } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { SelectorTarjetas } from "@/components/SelectorTarjetas";
import { Sheet } from "@/components/Sheet";
import { Teclado } from "@/components/Teclado";
import { useToast } from "@/components/Toast";
import { IconoCampo, InsigniaCampo } from "@/components/campo/EstadoCampo";
import { EstadoRepro } from "@/components/campo/MontaCampo";
import { sumarDias } from "@/lib/fechas";
import { ETIQUETA_FETOS, ETIQUETA_INDICADOR, ETIQUETA_METODO, ETIQUETA_RESULTADO, ETIQUETA_VIABILIDAD, DETALLE_RESULTADO, DETALLE_INDICADOR, DETALLE_VIABILIDAD } from "@/lib/reproduccion";
import { ESCENA_INDICADOR_PALPACION, ESCENA_METODO_DIAGNOSTICO, ESCENA_RESULTADO_DIAGNOSTICO, ESCENA_VIABILIDAD } from "@/lib/escenas-forms-b-reproduccion";
import { reglasDiagnostico } from "@/lib/diagnostico-reglas";
import {
  CONDICIONES, MAX_DIAS_GESTACION, MENSAJE_GUARDADO_LOCAL, aplicarTecla, coincideBusqueda, etiquetaCampo, hembrasParaDiagnostico, numeroDeTexto, registrosDe,
  type DiagnosticoCampo as Datos, type HembraRepro, type ReferenciaCampo, type RegistroCampo,
} from "@/lib/campo";
import type { IndicadorPalpacion, ResultadoDiagnostico, ViabilidadFetal } from "@/lib/tipos";
import { guardarEnCelular } from "@/lib/offline/campo-envio";

type Metodo = Datos["metodo"];
const fmtCondicion = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

/**
 * El diagnóstico de gestación sin señal (ecografía o palpación), con las mismas reglas que la ficha (`reglasDiagnostico`). Primero salen las
 * hembras servidas que esperan diagnóstico. El servicio al que se asocia lo decide el servidor al enviar, como con señal.
 */
export function DiagnosticoCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const [dia, setDia] = useState<"hoy" | "ayer">("hoy");
  const [busqueda, setBusqueda] = useState("");
  const [activa, setActiva] = useState<HembraRepro | null>(null);
  const [metodo, setMetodo] = useState<Metodo | "">("");
  const [resultado, setResultado] = useState<ResultadoDiagnostico | "">("");
  const [dias, setDias] = useState("");
  const [fetos, setFetos] = useState<number | null>(null);
  const [viabilidad, setViabilidad] = useState<ViabilidadFetal | "">("");
  const [indicador, setIndicador] = useState<IndicadorPalpacion | "">("");
  const [condicion, setCondicion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const fecha = dia === "hoy" ? hoy : sumarDias(hoy, -1);
  const fincaId = referencia.finca.id;
  const anotadas = useMemo(() => registrosDe(registros, { tipo: "diagnostico", fincaId, usuarioId, fecha }), [registros, fincaId, usuarioId, fecha]);
  // Una monta anotada en este celular (aún sin enviar) también abre un ciclo: se puede diagnosticar después.
  const conMontaLocal = useMemo(() => new Set(registros.filter((r) => r.tipo === "monta" && r.usuarioId === usuarioId && r.fincaId === fincaId && r.estado !== "error").map((r) => r.animalId)), [registros, usuarioId, fincaId]);
  const ordenadas = useMemo(() => hembrasParaDiagnostico(referencia.hembras), [referencia.hembras]);
  const lista = ordenadas.filter((h) => coincideBusqueda(h, busqueda));
  const servidas = ordenadas.filter((h) => h.estado === "servida").length;

  const abrir = (h: HembraRepro) => {
    const d = anotadas.get(h.id)?.diagnostico;
    setActiva(h);
    setMetodo(d?.metodo ?? "");
    setResultado(d?.resultado ?? "");
    setDias(d?.diasGestacion ? String(d.diasGestacion) : "");
    setFetos(d?.numFetos ?? null);
    setViabilidad(d?.viabilidad ?? "");
    setIndicador(d?.indicador ?? "");
    setCondicion(d?.condicion ?? null);
    setError(null);
  };

  const eco = metodo === "ecografia" && resultado !== "" && resultado !== "vacia";
  const palpacion = metodo === "palpacion";

  const guardar = async () => {
    if (!activa) return;
    const previa = anotadas.get(activa.id);
    if (previa?.estado === "enviado") return setActiva(null);
    if (!metodo) return setError("Elige cómo se hizo: ecografía o palpación.");
    if (!resultado) return setError("Elige el resultado.");
    const datos: Datos = {
      metodo,
      resultado,
      diasGestacion: eco ? numeroDeTexto(dias) : null,
      numFetos: eco ? fetos : null,
      viabilidad: eco ? viabilidad || null : null,
      indicador: palpacion ? indicador || null : null,
      condicion: palpacion ? condicion : null,
    };
    // Las mismas reglas que la ficha; la fecha del servicio exacta la comprueba el servidor.
    const reglas = reglasDiagnostico(
      { fecha, metodo, resultado, dias_gestacion: datos.diasGestacion, num_fetos: datos.numFetos, viabilidad_fetal: datos.viabilidad, indicador_palpacion: datos.indicador, condicion_corporal: datos.condicion },
      activa.estado === "servida" || activa.estado === "gestante" ? activa.ultimoServicio : null,
    );
    if ("error" in reglas) return setError(reglas.error);
    setGuardando(true);
    try {
      await guardarEnCelular({ id: previa?.id ?? crypto.randomUUID(), creadoEn: previa?.creadoEn, tipo: "diagnostico", usuarioId, fincaId, animalId: activa.id, etiqueta: etiquetaCampo(activa), fecha, diagnostico: datos });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? `${activa.arete}: ${ETIQUETA_RESULTADO[resultado]}` : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    setActiva(null);
  };

  if (!referencia.puede.reproduccion) return <Aviso>Tu rol no registra reproducción en esta finca.</Aviso>;
  if (referencia.hembras.length === 0) return <Aviso>No hay hembras en la lista guardada. Abre Apriscol con señal para actualizarla.</Aviso>;

  const enviada = activa ? anotadas.get(activa.id)?.estado === "enviado" : false;
  const sinCiclo = activa ? (activa.estado === "vacia" || activa.estado === "sin_datos") && !conMontaLocal.has(activa.id) : false;

  return (
    <div className="space-y-4">
      <FilaDesplazable>
        <Chip activo={dia === "hoy"} onClick={() => setDia("hoy")}>Hoy</Chip>
        <Chip activo={dia === "ayer"} onClick={() => setDia("ayer")}>Ayer</Chip>
      </FilaDesplazable>
      <p className="px-1 text-sm text-humo">{servidas === 1 ? "1 hembra servida espera diagnóstico: sale primero." : `${servidas} hembras servidas esperan diagnóstico: salen primero.`}</p>
      {ordenadas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}

      {lista.length === 0 ? (
        <p className="py-8 text-center text-[0.9375rem] text-humo">Ninguna hembra coincide con tu búsqueda.</p>
      ) : (
        <ListaPorTramos
          key={`${fecha}|${busqueda}`}
          items={lista}
          clave={(h) => h.id}
          fila={(h) => {
            const r = anotadas.get(h.id);
            return (
              <button type="button" onClick={() => abrir(h)} className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 text-left ring-1 ring-arena transition active:scale-[0.99]">
                <IconoCampo r={r} vacio={<Stethoscope className="size-5" strokeWidth={1.75} aria-hidden="true" />} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{h.arete}</span>
                  <span className="block text-sm text-humo [overflow-wrap:anywhere]">{r?.diagnostico ? `${ETIQUETA_METODO[r.diagnostico.metodo]}: ${ETIQUETA_RESULTADO[r.diagnostico.resultado]}` : (h.nombre ?? "Sin nombre")}</span>
                  <span className="mt-1 flex flex-wrap gap-1"><EstadoRepro h={h} /></span>
                </span>
                {r ? <InsigniaCampo r={r} /> : <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />}
              </button>
            );
          }}
        />
      )}

      <Sheet
        abierta={activa !== null}
        onCerrar={() => setActiva(null)}
        titulo={activa ? etiquetaCampo(activa) : ""}
        pie={enviada ? null : <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…">Guardar diagnóstico</Boton>}
      >
        {enviada ? (
          <Aviso>Este diagnóstico ya se envió. Para corregirlo, hazlo en la ficha de la hembra cuando tengas señal.</Aviso>
        ) : (
          <div className="space-y-5">
            {sinCiclo ? <Aviso tipo="atencion">Según la lista guardada no tiene un servicio en este ciclo. Si no lo tiene, el diagnóstico no se podrá guardar: anota primero la monta.</Aviso> : null}
            <SelectorTarjetas<Metodo>
              titulo="¿Cómo se hizo?"
              valor={metodo}
              onCambio={(v) => { setMetodo(v as Metodo | ""); setError(null); }}
              opciones={(["ecografia", "palpacion"] as const).map((m) => ({ valor: m, etiqueta: ETIQUETA_METODO[m], escena: ESCENA_METODO_DIAGNOSTICO[m] }))}
            />
            <SelectorTarjetas<ResultadoDiagnostico>
              titulo="Resultado"
              valor={resultado}
              onCambio={(v) => { setResultado(v as ResultadoDiagnostico | ""); setError(null); }}
              opciones={(["gestante", "vacia", "dudoso"] as const).map((r) => ({ valor: r, etiqueta: ETIQUETA_RESULTADO[r], detalle: DETALLE_RESULTADO[r], escena: ESCENA_RESULTADO_DIAGNOSTICO[r] }))}
            />

            {eco ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Días de gestación{resultado === "gestante" ? "" : " (si se calcularon)"}</p>
                  <p className="rounded-3xl bg-lana py-3 text-center font-display text-4xl font-semibold tabular-nums">
                    {dias === "" ? <span className="text-humo/50">0</span> : dias}
                    <span className="ml-2 text-lg font-medium text-humo">días</span>
                  </p>
                  <Teclado onTecla={(t) => { if (t === ".") return; setError(null); setDias((v) => aplicarTecla(v, t, MAX_DIAS_GESTACION, 0)); }} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Fetos</p>
                  <FilaDesplazable>
                    {[1, 2, 3, 4].map((n) => (
                      <Chip key={n} activo={fetos === n} onClick={() => { setFetos(fetos === n ? null : n); setError(null); }}>{ETIQUETA_FETOS[n]}</Chip>
                    ))}
                  </FilaDesplazable>
                </div>
                <SelectorTarjetas<ViabilidadFetal>
                  titulo="Viabilidad fetal"
                  valor={viabilidad}
                  onCambio={(v) => { setViabilidad(v as ViabilidadFetal | ""); setError(null); }}
                  opciones={(["latido", "sin_actividad"] as const).map((v) => ({ valor: v, etiqueta: ETIQUETA_VIABILIDAD[v], detalle: DETALLE_VIABILIDAD[v], escena: ESCENA_VIABILIDAD[v] }))}
                />
              </>
            ) : null}

            {palpacion ? (
              <>
                <SelectorTarjetas<IndicadorPalpacion>
                  titulo="Qué indicó"
                  valor={indicador}
                  onCambio={(v) => { setIndicador(v as IndicadorPalpacion | ""); setError(null); }}
                  opciones={(["ausencia_celo", "retorno_celo", "llenado_uterino", "revision_manual"] as const).map((i) => ({ valor: i, etiqueta: ETIQUETA_INDICADOR[i], detalle: DETALLE_INDICADOR[i], escena: ESCENA_INDICADOR_PALPACION[i] }))}
                />
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Condición corporal{resultado === "vacia" ? "" : " (opcional)"}</p>
                  <FilaDesplazable>
                    {CONDICIONES.map((c) => (
                      <Chip key={c} activo={condicion === c} onClick={() => { setCondicion(condicion === c ? null : c); setError(null); }}>{fmtCondicion(c)}</Chip>
                    ))}
                  </FilaDesplazable>
                </div>
              </>
            ) : null}

            {error ? <Aviso tipo="error">{error}</Aviso> : null}
          </div>
        )}
      </Sheet>
    </div>
  );
}
