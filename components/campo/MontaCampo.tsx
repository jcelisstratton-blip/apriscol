"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronRight, Heart } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoBusqueda } from "@/components/CampoBusqueda";
import { CLASE_INPUT } from "@/components/Campo";
import { Chip, FilaDesplazable } from "@/components/FilaDesplazable";
import { Insignia } from "@/components/Insignia";
import { ListaPorTramos } from "@/components/ListaPorTramos";
import { Selector } from "@/components/Selector";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { IconoCampo, InsigniaCampo } from "@/components/campo/EstadoCampo";
import { formatoFecha, sumarDias } from "@/lib/fechas";
import {
  MENSAJE_GUARDADO_LOCAL, coincideBusqueda, etiquetaCampo, etiquetaMacho, nombreMachoExterno, registrosDe,
  type HembraRepro, type ReferenciaCampo, type RegistroCampo,
} from "@/lib/campo";
import { guardarEnCelular } from "@/lib/offline/campo-envio";

const OTRA_FINCA = "otra";

/** El estado reproductivo de la copia, como insignia (sin señal es de la última vez que se abrió la app con señal). */
export function EstadoRepro({ h }: { h: HembraRepro }) {
  const dia = (f: string) => formatoFecha(f, { day: "numeric", month: "short" });
  if (h.estado === "gestante") return <Insignia tono="aviso">Gestante</Insignia>;
  if (h.estado === "servida") return <Insignia tono="musgo">{h.ultimoServicio ? `Servida el ${dia(h.ultimoServicio)}` : "Servida"}</Insignia>;
  if (h.estado === "vacia") return <Insignia>Vacía</Insignia>;
  return null;
}

/**
 * La monta sin señal: se elige el reproductor una vez (del hato o de otra finca) y se tocan las hembras que montó, hoy o ayer. Cada una queda
 * como un servicio por monta natural, igual que desde su ficha. Crear o cerrar una temporada de empadre sigue siendo con señal.
 */
export function MontaCampo({ referencia, registros, usuarioId, hoy, enLinea, alGuardar }: {
  referencia: ReferenciaCampo;
  registros: RegistroCampo[];
  usuarioId: string;
  hoy: string;
  enLinea: boolean;
  alGuardar: () => void;
}) {
  const toast = useToast();
  const [dia, setDia] = useState<"hoy" | "ayer">("hoy");
  const [macho, setMacho] = useState<string>(referencia.machos.length === 1 ? referencia.machos[0].id : "");
  const [externo, setExterno] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [activa, setActiva] = useState<HembraRepro | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alBuscar = useCallback((t: string) => setBusqueda(t), []);

  const fecha = dia === "hoy" ? hoy : sumarDias(hoy, -1);
  const fincaId = referencia.finca.id;
  const anotadas = useMemo(() => registrosDe(registros, { tipo: "monta", fincaId, usuarioId, fecha }), [registros, fincaId, usuarioId, fecha]);
  const elegido = referencia.machos.find((m) => m.id === macho) ?? null;
  const nombreExterno = nombreMachoExterno(externo);
  const reproductorListo = macho === OTRA_FINCA ? nombreExterno !== null : elegido !== null;
  const etiquetaReproductor = elegido ? etiquetaMacho(elegido) : nombreExterno ?? "";
  // Con un reproductor del hato, solo las hembras de su especie (el servidor lo vuelve a exigir).
  const candidatas = elegido ? referencia.hembras.filter((h) => h.especie === elegido.especie) : referencia.hembras;
  const lista = candidatas.filter((h) => coincideBusqueda(h, busqueda));

  const guardar = async () => {
    if (!activa || !reproductorListo) return;
    const previa = anotadas.get(activa.id);
    if (previa?.estado === "enviado") return setActiva(null);
    setGuardando(true);
    try {
      await guardarEnCelular({
        id: previa?.id ?? crypto.randomUUID(),
        creadoEn: previa?.creadoEn,
        tipo: "monta",
        usuarioId,
        fincaId,
        animalId: activa.id,
        etiqueta: etiquetaCampo(activa),
        fecha,
        machoId: elegido?.id ?? null,
        machoExterno: elegido ? null : nombreExterno,
        machoEtiqueta: etiquetaReproductor,
      });
    } catch {
      setGuardando(false);
      return setError("No se pudo guardar en este celular. Revisa que tenga espacio libre.");
    }
    setGuardando(false);
    toast.exito(enLinea ? `Monta de ${activa.arete} guardada` : MENSAJE_GUARDADO_LOCAL);
    alGuardar();
    setActiva(null);
  };

  if (!referencia.puede.reproduccion) return <Aviso>Tu rol no registra reproducción en esta finca.</Aviso>;
  if (referencia.hembras.length === 0) return <Aviso>No hay hembras en la lista guardada. Abre Apriscol con señal para actualizarla.</Aviso>;

  const opciones = [
    ...referencia.machos.map((m) => ({ valor: m.id, etiqueta: etiquetaMacho(m) })),
    { valor: OTRA_FINCA, etiqueta: "De otra finca", detalle: "Prestado o alquilado: escribe su nombre" },
  ];

  return (
    <div className="space-y-4">
      <FilaDesplazable>
        <Chip activo={dia === "hoy"} onClick={() => setDia("hoy")}>Hoy</Chip>
        <Chip activo={dia === "ayer"} onClick={() => setDia("ayer")}>Ayer</Chip>
      </FilaDesplazable>

      <div className="space-y-2 rounded-3xl bg-papel p-4 ring-1 ring-arena">
        <p className="text-sm font-semibold">Reproductor</p>
        <Selector titulo="Reproductor" valor={macho} opciones={opciones} onCambio={(v) => setMacho(String(v))} placeholder="Elige el macho que hizo la monta" />
        {macho === OTRA_FINCA ? (
          <input value={externo} onChange={(e) => setExterno(e.target.value)} maxLength={80} placeholder="Nombre o arete del macho" className={CLASE_INPUT} aria-label="Nombre del macho de otra finca" />
        ) : null}
        <p className="text-sm text-humo">Elígelo una vez y toca cada hembra que montó.</p>
      </div>

      {!reproductorListo ? (
        <Aviso tipo="atencion">Elige primero el reproductor para anotar las montas.</Aviso>
      ) : (
        <>
          {candidatas.length > 8 ? <CampoBusqueda onBuscar={alBuscar} placeholder="Buscar por arete o nombre" /> : null}
          {lista.length === 0 ? (
            <p className="py-8 text-center text-[0.9375rem] text-humo">{busqueda ? "Ninguna hembra coincide con tu búsqueda." : "No hay hembras de la especie de este reproductor."}</p>
          ) : (
            <ListaPorTramos
              key={`${fecha}|${macho}|${busqueda}`}
              items={lista}
              clave={(h) => h.id}
              fila={(h) => {
                const r = anotadas.get(h.id);
                return (
                  <button type="button" onClick={() => { setActiva(h); setError(null); }} className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl bg-papel px-3.5 py-2.5 text-left ring-1 ring-arena transition active:scale-[0.99]">
                    <IconoCampo r={r} vacio={<Heart className="size-5" strokeWidth={1.75} aria-hidden="true" />} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold [overflow-wrap:anywhere]">{h.arete}</span>
                      <span className="block text-sm text-humo [overflow-wrap:anywhere]">{r?.machoEtiqueta ? `Con ${r.machoEtiqueta}` : (h.nombre ?? "Sin nombre")}</span>
                      <span className="mt-1 flex flex-wrap gap-1"><EstadoRepro h={h} /></span>
                    </span>
                    {r ? <InsigniaCampo r={r} /> : <ChevronRight className="size-5 shrink-0 text-humo" strokeWidth={1.75} aria-hidden="true" />}
                  </button>
                );
              }}
            />
          )}
        </>
      )}

      <Sheet
        abierta={activa !== null}
        onCerrar={() => setActiva(null)}
        titulo={activa ? etiquetaCampo(activa) : ""}
        pie={
          activa && anotadas.get(activa.id)?.estado === "enviado" ? null : (
            <Boton onClick={guardar} pendiente={guardando} cargando="Guardando…" disabled={!reproductorListo}>
              Guardar monta
            </Boton>
          )
        }
      >
        {activa ? (
          anotadas.get(activa.id)?.estado === "enviado" ? (
            <Aviso>Esta monta ya se envió. Para corregirla, hazlo en la ficha de la hembra cuando tengas señal.</Aviso>
          ) : (
            <div className="space-y-3">
              <div className="rounded-3xl bg-lana p-4">
                <p className="text-sm text-humo">Monta natural · {dia === "hoy" ? "hoy" : "ayer"}</p>
                <p className="font-display text-xl font-semibold [overflow-wrap:anywhere]">Con {etiquetaReproductor}</p>
              </div>
              {activa.estado === "gestante" ? (
                <Aviso tipo="atencion">Según la lista guardada está gestante. Revisa que sea la hembra correcta antes de guardar.</Aviso>
              ) : activa.estado === "servida" && activa.ultimoServicio && activa.ultimoServicio >= sumarDias(fecha, -21) ? (
                <Aviso tipo="atencion">Ya tiene un servicio reciente ({formatoFecha(activa.ultimoServicio, { day: "numeric", month: "short" })}). Si volvió a celo, guárdala: queda como un nuevo servicio.</Aviso>
              ) : null}
              {error ? <Aviso tipo="error">{error}</Aviso> : null}
            </div>
          )
        ) : null}
      </Sheet>
    </div>
  );
}
