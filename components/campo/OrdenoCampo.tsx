"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight, Droplets } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Segmentado } from "@/components/Segmentado";
import { Sheet } from "@/components/Sheet";
import { Teclado } from "@/components/Teclado";
import { useToast } from "@/components/Toast";
import { IconoCampo, InsigniaCampo } from "@/components/campo/EstadoCampo";
import { ESCENA_VISTA_CAPTURA } from "@/lib/escenas-listas-leche";
import { textoAnimales } from "@/lib/hato";
import { litros as fmt, sumarDias } from "@/lib/fechas";
import {
  MAX_LITROS, MENSAJE_GUARDADO_LOCAL, aplicarTecla, coincideBusqueda, enRetiroLeche, errorLitros, etiquetaCampo, hembrasDelTurno, numeroDeTexto, registrosDe,
  type HembraCampo, type JornadaCampo, type ReferenciaCampo, type RegistroCampo,
} from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";

const MIN_PARA_BUSCAR = 8;
const NOMBRE_JORNADA: Record<JornadaCampo, string> = { manana: "mañana", tarde: "tarde", noche: "noche" };

/**
 * El ordeño sin señal: la misma captura de leche (jornada, hoy o ayer, una hoja con teclado grande por hembra y salto a la siguiente), pero lo
 * anotado queda en el celular y se envía solo. Muestra lo anotado en ESTE celular (sin señal no se puede saber lo que anotaron otros).
 */
export function OrdenoCampo({ referencia, registros, usuarioId, hoy, jornadaInicial, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  jornadaInicial: JornadaCampo;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const [jornada, setJornada] = useState<JornadaCampo>(jornadaInicial);
  const [dia, setDia] = useState<"hoy" | "ayer">("hoy");
  const [vista, setVista] = useState<"pendientes" | "hechas">("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [activo, setActivo] = useState<HembraCampo | null>(null);
  const [texto, setTexto] = useState("");
  const [descartar, setDescartar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const fecha = dia === "hoy" ? hoy : sumarDias(hoy, -1);
  const fincaId = referencia.finca.id;
  const anotados = useMemo(() => registrosDe(registros, { tipo: "ordeno", fincaId, usuarioId, fecha, jornada }), [registros, fincaId, usuarioId, fecha, jornada]);
  const delTurno = useMemo(() => hembrasDelTurno(referencia.ordeno, jornada, new Set(anotados.keys())), [referencia.ordeno, jornada, anotados]);
  const hechas = delTurno.filter((h) => anotados.has(h.id));
  const pendientes = delTurno.filter((h) => !anotados.has(h.id));
  const buscando = busqueda.trim() !== "";
  const lista = buscando ? referencia.ordeno.filter((h) => coincideBusqueda(h, busqueda)) : vista === "pendientes" ? pendientes : hechas;
  const totalLitros = hechas.reduce((s, h) => {
    const r = anotados.get(h.id)!;
    return s + (r.descartar ? 0 : (r.litros ?? 0));
  }, 0);

  const previo = activo ? anotados.get(activo.id) : undefined;
  const enviado = previo?.estado === "enviado";
  const enRetiro = activo ? enRetiroLeche(activo, fecha) : false;
  const valor = numeroDeTexto(texto);

  const abrir = (h: HembraCampo) => {
    const r = anotados.get(h.id);
    setActivo(h);
    setTexto(r?.litros !== undefined ? String(r.litros) : "");
    setDescartar(r?.descartar ?? false);
    setError(null);
  };

  const guardar = async () => {
    if (!activo || valor === null || enviado) return;
    const problema = errorLitros(valor);
    if (problema) return setError(problema);
    setGuardando(true);
    try {
      // Corregir antes de que se envíe reutiliza el mismo registro (mismo identificador): nunca quedan dos.
      const reusar = previo && previo.estado !== "enviado" ? previo : undefined;
      await guardarEnCelular({
        id: reusar?.id ?? crypto.randomUUID(),
        creadoEn: reusar?.creadoEn,
        tipo: "ordeno",
        usuarioId,
        fincaId,
        animalId: activo.id,
        etiqueta: etiquetaCampo(activo),
        fecha,
        jornada,
        litros: valor,
        descartar: descartar || enRetiro,
      });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? `${activo.arete}: ${fmt(valor)} L` : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    const orden = buscando ? lista : pendientes;
    const siguiente = orden.find((h) => h.id !== activo.id && !anotados.has(h.id) && orden.indexOf(h) > orden.indexOf(activo)) ?? orden.find((h) => h.id !== activo.id && !anotados.has(h.id));
    if (siguiente && !buscando) abrir(siguiente);
    else setActivo(null);
  };

  if (!referencia.puede.leche) return <Aviso>Tu rol no registra ordeños en esta finca.</Aviso>;
  if (referencia.ordeno.length === 0) {
    return <Aviso>No hay hembras en ordeño en la lista guardada. Si acabas de agregar alguna, abre Apriscol con señal para actualizar la lista.</Aviso>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Segmentado<JornadaCampo>
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
            <p className="text-sm font-semibold opacity-85">Anotado en este celular · {NOMBRE_JORNADA[jornada]}</p>
            <p className="font-display text-4xl font-semibold leading-tight tabular-nums">
              {fmt(totalLitros)}
              <span className="ml-1 text-lg font-medium opacity-80">L</span>
            </p>
          </div>
          <p className="shrink-0 pb-1 text-right text-sm font-semibold">
            {hechas.length} de {delTurno.length}
          </p>
        </div>
      </section>

      {referencia.ordeno.length > MIN_PARA_BUSCAR ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}

      {buscando ? null : (
        <FilaTarjetas etiqueta="Pendientes o anotadas">
          <TarjetaOpcion escena={ESCENA_VISTA_CAPTURA.pendientes} titulo="Pendientes" dato={textoAnimales(pendientes.length)} activo={vista === "pendientes"} onClick={() => setVista("pendientes")} />
          <TarjetaOpcion escena={ESCENA_VISTA_CAPTURA.hechas} titulo="Anotadas" dato={textoAnimales(hechas.length)} activo={vista === "hechas"} onClick={() => setVista("hechas")} />
        </FilaTarjetas>
      )}

      {lista.length === 0 ? (
        <p className="py-8 text-center text-[0.9375rem] text-humo">
          {buscando
            ? "Ninguna hembra coincide con tu búsqueda."
            : vista === "pendientes" && delTurno.length === 0
              ? `Ninguna hembra está programada para la ${NOMBRE_JORNADA[jornada]}.`
              : vista === "pendientes"
                ? "No queda ninguna hembra por anotar en esta jornada."
                : "Todavía no has anotado ninguna hembra en esta jornada."}
        </p>
      ) : (
        <ListaPorTramos
          key={`${fecha}|${jornada}|${vista}|${busqueda}`}
          items={lista}
          clave={(h) => h.id}
          fila={(h) => {
            const r = anotados.get(h.id);
            return (
              <button type="button" onClick={() => abrir(h)} className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 text-left ring-1 ring-arena transition active:scale-[0.99]">
                <IconoCampo r={r} vacio={<Droplets className="size-5" strokeWidth={1.75} aria-hidden="true" />} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold [overflow-wrap:anywhere]">{h.arete}</span>
                  <span className="block text-sm text-humo [overflow-wrap:anywhere]">{h.nombre ?? "Sin nombre"}</span>
                  {enRetiroLeche(h, fecha) ? <span className="mt-1 block"><Insignia tono="aviso">En retiro · se descarta</Insignia></span> : null}
                </span>
                {r ? (
                  <span className="shrink-0 space-y-1 text-right">
                    <span className="block text-lg font-bold tabular-nums">{fmt(r.litros ?? 0)} L</span>
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
          <Aviso>Este ordeño ya se envió ({fmt(previo.litros ?? 0)} L). Para corregirlo, hazlo en la captura de leche cuando tengas señal.</Aviso>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl bg-lana py-5 text-center">
              <p className="font-display text-6xl font-semibold tabular-nums leading-none">
                {texto === "" ? <span className="text-humo/50">0</span> : texto.replace(".", ",")}
                <span className="ml-2 text-2xl font-medium text-humo">L</span>
              </p>
              <p className="mt-2 text-sm text-humo">Litros de la {NOMBRE_JORNADA[jornada]}</p>
            </div>
            <Teclado
              onTecla={(t) => {
                setError(null);
                setTexto((v) => aplicarTecla(v, t, MAX_LITROS, 2));
              }}
            />
            {enRetiro ? (
              <Aviso tipo="atencion">Está en periodo de retiro: su leche se registra como descartada y no entra al tanque.</Aviso>
            ) : (
              <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
                <input type="checkbox" checked={descartar} onChange={(e) => setDescartar(e.target.checked)} className="size-5 accent-[var(--musgo)]" />
                Esta leche no va al tanque (mastitis, calostro…)
              </label>
            )}
            {error ? <Aviso tipo="error">{error}</Aviso> : null}
          </div>
        )}
      </Sheet>
    </div>
  );
}
