"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Send } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton, clasesBoton } from "@/components/Boton";
import { Insignia } from "@/components/Insignia";
import { useToast } from "@/components/Toast";
import { crearCodigoTelegram, desvincularTelegram } from "@/app/(app)/mas/telegram/actions";
import { ETIQUETA_VINCULO, MINUTOS_CODIGO, enlaceBot, type EstadoVinculo } from "@/lib/notificaciones/enlace";

const TONO: Record<EstadoVinculo, "neutro" | "ok" | "aviso" | "alerta"> = { pendiente: "neutro", activo: "ok", pausado: "aviso", bloqueado: "alerta" };

/**
 * Conectar el Telegram de la persona: pide un código, abre el bot con el código puesto y espera a que la conexión se confirme (revisa cada pocos segundos
 * mientras el código está vigente). Sin código no hay nada que escribir: la persona solo toca «Abrir Telegram» y luego «Iniciar».
 */
export function ConectarTelegram({ finca, estado, bot, avisos }: { finca: string; estado: EstadoVinculo; bot: string; avisos: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [codigo, setCodigo] = useState<{ valor: string; vence: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const anterior = useRef(estado);

  const esperando = codigo !== null && estado !== "activo";

  // Mientras el código está vigente, se pregunta cada 4 segundos si la persona ya tocó «Iniciar» en Telegram.
  useEffect(() => {
    if (!esperando || !codigo) return;
    const id = setInterval(() => {
      if (Date.now() > codigo.vence) {
        setCodigo(null);
        return;
      }
      router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [esperando, codigo, router]);

  useEffect(() => {
    if (anterior.current !== "activo" && estado === "activo") toast.exito("Telegram conectado");
    anterior.current = estado;
  }, [estado, toast]);

  const pedirCodigo = () =>
    iniciar(async () => {
      setError(null);
      const r = await crearCodigoTelegram();
      if (!r.ok) return setError(r.error);
      setCodigo({ valor: r.codigo, vence: Date.now() + MINUTOS_CODIGO * 60_000 });
    });

  const desconectar = () =>
    iniciar(async () => {
      setError(null);
      const r = await desvincularTelegram();
      if (!r.ok) return setError(r.error);
      setConfirmando(false);
      setCodigo(null);
      toast.exito("Telegram desconectado");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Insignia tono={TONO[estado]}>{ETIQUETA_VINCULO[estado]}</Insignia>
        <span className="min-w-0 text-[0.9375rem] text-humo [overflow-wrap:anywhere]">{finca}</span>
      </div>

      {estado === "activo" ? (
        <div className="space-y-2">
          <p className="text-[0.9375rem]">Recibes los avisos de esta finca en tu Telegram.</p>
          <p className="text-[0.9375rem] text-humo">{avisos ?? "El equipo de Apriscol todavía no te activó los avisos: cuando lo haga, te llegan aquí."}</p>
          <p className="text-sm text-humo">En el chat con el bot: /hoy para ver tu resumen ahora, /pausar para silenciarlo y /reanudar para volver a recibirlo.</p>
        </div>
      ) : estado === "pausado" ? (
        <Aviso tipo="info">Pausaste los avisos. Escribe /reanudar en el chat con el bot para volver a recibirlos.</Aviso>
      ) : estado === "bloqueado" ? (
        <Aviso tipo="atencion">Bloqueaste el bot en Telegram. Desbloquéalo y escribe /reanudar en el chat, o conecta de nuevo.</Aviso>
      ) : (
        <div className="space-y-1">
          <p className="text-[0.9375rem]">Recibe en Telegram lo que hay que hacer cada día en tu finca. Tarda menos de un minuto.</p>
          <p className="text-sm text-humo">Conéctalo con tu propio Telegram. A qué hora te llega y qué incluye lo fija el equipo de Apriscol.</p>
        </div>
      )}

      {esperando && codigo ? (
        <div className="space-y-3 rounded-2xl bg-lana p-3.5">
          <ol className="list-decimal space-y-1 pl-5 text-[0.9375rem]">
            <li>Toca «Abrir Telegram».</li>
            <li>
              En el chat con <strong>@{bot}</strong> toca <strong>Iniciar</strong> (o <strong>Start</strong>).
            </li>
            <li>Vuelve aquí: esta pantalla se actualiza sola.</li>
          </ol>
          <a href={enlaceBot(bot, codigo.valor)} target="_blank" rel="noopener noreferrer" className={clasesBoton("primario")}>
            <ExternalLink className="size-5" strokeWidth={2} aria-hidden="true" /> Abrir Telegram
          </a>
          <p className="text-sm text-humo">
            ¿No se abre? Escríbele a @{bot} esto: <strong className="break-all font-mono">/start {codigo.valor}</strong>. Vale {MINUTOS_CODIGO} minutos.
          </p>
        </div>
      ) : null}

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      {estado === "activo" ? (
        confirmando ? (
          <div className="space-y-3 rounded-2xl bg-lana p-3.5">
            <p className="text-[0.9375rem]">Dejarás de recibir los avisos de esta finca en este Telegram. Puedes conectarlo de nuevo cuando quieras.</p>
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" onClick={() => setConfirmando(false)} disabled={pendiente}>Cancelar</Boton>
              <Boton variante="peligro" onClick={desconectar} pendiente={pendiente} cargando="Desconectando…">Desconectar</Boton>
            </div>
          </div>
        ) : (
          <Boton variante="secundario" onClick={() => setConfirmando(true)}>Desconectar Telegram</Boton>
        )
      ) : !esperando ? (
        <Boton onClick={pedirCodigo} pendiente={pendiente} cargando="Preparando…">
          <Send className="size-5" strokeWidth={2} aria-hidden="true" /> {estado === "pendiente" ? "Conectar Telegram" : "Conectar de nuevo"}
        </Boton>
      ) : null}
    </div>
  );
}
