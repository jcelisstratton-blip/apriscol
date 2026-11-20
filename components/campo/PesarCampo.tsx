"use client";

import { useCallback, useMemo, useState } from "react";
import { Beef, ChevronRight, LayoutDashboard, Scale } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Sheet } from "@/components/Sheet";
import { Teclado } from "@/components/Teclado";
import { useToast } from "@/components/Toast";
import { IconoCampo, InsigniaCampo } from "@/components/campo/EstadoCampo";
import { escena } from "@/lib/escenas";
import { textoAnimales } from "@/lib/hato";
import { formatoFecha, sumarDias } from "@/lib/fechas";
import { kg } from "@/lib/carne";
import {
  MAX_PESO, MENSAJE_GUARDADO_LOCAL, aplicarTecla, coincideBusqueda, errorPeso, etiquetaCampo, numeroDeTexto, redondearPeso, registrosDe,
  type AnimalPesar, type ReferenciaCampo, type RegistroCampo,
} from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";

const ESCENA_CEBA = escena(Beef, "arcilla", Scale);
const ESCENA_TODOS = escena(LayoutDashboard, "musgo", Scale);

/**
 * La pesada sin señal: los animales en ceba primero (y todo el hato con el buscador), una hoja con teclado grande por animal y su último peso
 * para comparar. Un peso por animal y día, como con señal. Lo anotado queda en el celular y se envía solo.
 */
export function PesarCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const enCeba = useMemo(() => referencia.pesar.filter((a) => a.ceba), [referencia.pesar]);
  const [dia, setDia] = useState<"hoy" | "ayer">("hoy");
  const [grupo, setGrupo] = useState<"ceba" | "todos">(enCeba.length > 0 ? "ceba" : "todos");
  const [busqueda, setBusqueda] = useState("");
  const [activo, setActivo] = useState<AnimalPesar | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const fecha = dia === "hoy" ? hoy : sumarDias(hoy, -1);
  const fincaId = referencia.finca.id;
  const anotados = useMemo(() => registrosDe(registros, { tipo: "peso", fincaId, usuarioId, fecha }), [registros, fincaId, usuarioId, fecha]);
  const buscando = busqueda.trim() !== "";
  const lista = buscando ? referencia.pesar.filter((a) => coincideBusqueda(a, busqueda)) : grupo === "ceba" ? enCeba : referencia.pesar;

  const previo = activo ? anotados.get(activo.id) : undefined;
  const enviado = previo?.estado === "enviado";
  const valor = numeroDeTexto(texto);

  const abrir = (a: AnimalPesar) => {
    const r = anotados.get(a.id);
    setActivo(a);
    setTexto(r?.peso !== undefined ? String(r.peso) : "");
    setError(null);
  };

  const guardar = async () => {
    if (!activo || valor === null || enviado) return;
    const problema = errorPeso(valor);
    if (problema) return setError(problema);
    setGuardando(true);
    try {
      const reusar = previo && previo.estado !== "enviado" ? previo : undefined;
      await guardarEnCelular({
        id: reusar?.id ?? crypto.randomUUID(),
        creadoEn: reusar?.creadoEn,
        tipo: "peso",
        usuarioId,
        fincaId,
        animalId: activo.id,
        etiqueta: etiquetaCampo(activo),
        fecha,
        peso: redondearPeso(valor),
      });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? `${activo.arete}: ${kg(redondearPeso(valor))}` : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    const orden = buscando ? [] : lista;
    const siguiente = orden.find((a) => a.id !== activo.id && !anotados.has(a.id) && orden.indexOf(a) > orden.indexOf(activo));
    if (siguiente) abrir(siguiente);
    else setActivo(null);
  };

  if (!referencia.puede.pesos) return <Aviso>Tu rol no registra pesos en esta finca.</Aviso>;
  if (referencia.pesar.length === 0) return <Aviso>No hay animales en la lista guardada. Abre Apriscol con señal para actualizarla.</Aviso>;

  return (
    <div className="space-y-4">
      <FilaDesplazable>
        <Chip activo={dia === "hoy"} onClick={() => setDia("hoy")}>Hoy</Chip>
        <Chip activo={dia === "ayer"} onClick={() => setDia("ayer")}>Ayer</Chip>
      </FilaDesplazable>

      <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" />

      {buscando ? null : (
        <FilaTarjetas etiqueta="Qué animales">
          <TarjetaOpcion escena={ESCENA_CEBA} titulo="En ceba" dato={textoAnimales(enCeba.length)} activo={grupo === "ceba"} onClick={() => setGrupo("ceba")} />
          <TarjetaOpcion escena={ESCENA_TODOS} titulo="Todo el hato" dato={textoAnimales(referencia.pesar.length)} activo={grupo === "todos"} onClick={() => setGrupo("todos")} />
        </FilaTarjetas>
      )}

      {lista.length === 0 ? (
        <p className="py-8 text-center text-[0.9375rem] text-humo">{buscando ? "Ningún animal coincide con tu búsqueda." : "No hay animales en ceba. Busca el animal o mira todo el hato."}</p>
      ) : (
        <ListaPorTramos
          key={`${fecha}|${grupo}|${busqueda}`}
          items={lista}
          clave={(a) => a.id}
          fila={(a) => {
            const r = anotados.get(a.id);
            return (
              <button type="button" onClick={() => abrir(a)} className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 text-left ring-1 ring-arena transition active:scale-[0.99]">
                <IconoCampo r={r} vacio={<Scale className="size-5" strokeWidth={1.75} aria-hidden="true" />} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{a.arete}</span>
                  <span className="block text-sm text-humo [overflow-wrap:anywhere]">
                    {a.nombre ?? "Sin nombre"}
                    {a.ultimoPeso !== null ? ` · último ${kg(a.ultimoPeso)}${a.ultimaFecha ? ` (${formatoFecha(a.ultimaFecha, { day: "numeric", month: "short" })})` : ""}` : ""}
                  </span>
                </span>
                {r ? (
                  <span className="shrink-0 space-y-1 text-right">
                    <span className="block text-lg font-bold tabular-nums">{kg(r.peso ?? 0)}</span>
                    <InsigniaCampo r={r} />
                  </span>
                ) : (
                  <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            );
          }}
        />
      )}

      <Sheet
        abierta={activo !== null}
        onCerrar={() => setActivo(null)}
        titulo={activo ? etiquetaCampo(activo) : ""}
        pie={
          enviado ? null : (
            <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={valor === null}>
              Guardar y siguiente
            </Boton>
          )
        }
      >
        {enviado && previo ? (
          <Aviso>Este peso ya se envió ({kg(previo.peso ?? 0)}). Para corregirlo, hazlo en la ficha del animal cuando tengas señal.</Aviso>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl bg-lana py-5 text-center">
              <p className="font-display text-6xl font-semibold tabular-nums leading-none">
                {texto === "" ? <span className="text-humo/50">0</span> : texto.replace(".", ",")}
                <span className="ml-2 text-2xl font-medium text-humo">kg</span>
              </p>
              <p className="mt-2 text-sm text-humo">
                {activo?.ultimoPeso != null ? `Último peso: ${kg(activo.ultimoPeso)}${activo.ultimaFecha ? `, el ${formatoFecha(activo.ultimaFecha, { day: "numeric", month: "short" })}` : ""}` : "Sin pesos anteriores"}
              </p>
            </div>
            <Teclado
              onTecla={(t) => {
                setError(null);
                setTexto((v) => aplicarTecla(v, t, MAX_PESO, 1));
              }}
            />
            {error ? <Aviso tipo="error">{error}</Aviso> : null}
          </div>
        )}
      </Sheet>
    </div>
  );
}
