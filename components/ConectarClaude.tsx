"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Copiable } from "@/components/ConexionIa";
import { Tarjeta } from "@/components/Tarjeta";
import { useToast } from "@/components/Toast";
import { revocarAppIa } from "@/app/(app)/mas/ia/actions";

type App = { clientId: string; nombre: string; desde: string };

const PASOS = [
  <>En Claude ve a <strong>Configuración → Conectores</strong> y toca <strong>Agregar conector personalizado</strong>.</>,
  <>Ponle de nombre <strong>Apriscol</strong> y pega la dirección de abajo.</>,
  <>Toca <strong>Conectar</strong>, entra con tu cuenta de Apriscol y toca <strong>Permitir</strong>. Listo.</>,
];

/** Los tres pasos y la dirección: lo que se hace una sola vez, en Claude. */
function Pasos({ url }: { url: string }) {
  return (
    <div className="space-y-4">
      <ol className="space-y-2.5">
        {PASOS.map((p, i) => (
          <li key={i} className="flex min-w-0 items-start gap-3 text-[0.9375rem]">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-arena text-sm font-bold text-musgo">{i + 1}</span>
            <span className="min-w-0 pt-0.5">{p}</span>
          </li>
        ))}
      </ol>
      <Copiable titulo="Dirección de Apriscol" texto={url} />
      <p className="text-sm text-humo">Funciona en Claude en el computador, en la web y en el celular. Si tu Claude es de un equipo, quien lo administra debe agregar conectores personalizados.</p>
    </div>
  );
}

/**
 * La vía fácil: conectar Claude con su inicio de sesión (sin códigos ni archivos). Si ya hay un permiso dado, lo primero que se ve es que está conectado (y se
 * puede quitar); los pasos quedan a la mano por si hay que conectar otro Claude. Sin permiso, se ven los pasos.
 */
export function ConectarClaude({ finca, url, apps }: { finca: string; url: string; apps: App[] }) {
  const toast = useToast();
  const [quitando, setQuitando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const quitar = (id: string) =>
    iniciar(async () => {
      setError(null);
      const r = await revocarAppIa(id);
      if (!r.ok) return setError(r.error);
      setQuitando(null);
      toast.exito("Permiso quitado");
    });

  if (apps.length === 0) {
    return (
      <Tarjeta titulo="Conecta Claude con tu finca">
        <div className="space-y-4">
          <p className="text-[0.9375rem]">
            Pregúntale a Claude por <strong className="[overflow-wrap:anywhere]">{finca}</strong>: qué hay que atender hoy, cómo va la leche, buscar un animal. Solo lee: no registra ni cambia nada.
          </p>
          <Pasos url={url} />
        </div>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-4">
      <Tarjeta>
        <div className="space-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ok/15 text-ok">
              <CheckCircle2 className="size-6" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold">{apps.length === 1 ? "Claude está conectado" : "Claude está conectado en varios lugares"}</h2>
              <p className="text-sm text-humo [overflow-wrap:anywhere]">Ya puede consultar {finca}. Solo lee: no cambia nada.</p>
            </div>
          </div>
          <p className="rounded-2xl bg-lana p-3.5 text-[0.9375rem]">
            Pruébalo en Claude con: <strong>«¿Qué tengo para atender hoy en mi finca?»</strong>
          </p>
          {error ? <Aviso tipo="error">{error}</Aviso> : null}
          <ul className="divide-y divide-arena">
            {apps.map((a) => (
              <li key={a.clientId} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold [overflow-wrap:anywhere]">{a.nombre}</p>
                  <p className="text-sm text-humo">Permiso dado el {a.desde}</p>
                </div>
                {quitando === a.clientId ? (
                  <div className="space-y-3 rounded-2xl bg-lana p-3.5">
                    <p className="text-[0.9375rem]">{a.nombre} dejará de ver tu finca. Puedes volver a conectarlo cuando quieras.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Boton variante="secundario" onClick={() => setQuitando(null)} disabled={pendiente}>Cancelar</Boton>
                      <Boton variante="peligro" onClick={() => quitar(a.clientId)} pendiente={pendiente} cargando="Quitando…">Quitar permiso</Boton>
                    </div>
                  </div>
                ) : (
                  <Boton variante="secundario" ancho={false} onClick={() => setQuitando(a.clientId)}>Quitar permiso</Boton>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Tarjeta>
      <details className="rounded-3xl bg-papel ring-1 ring-arena">
        <summary className="min-h-12 cursor-pointer list-none px-4 py-3.5 text-[0.9375rem] font-semibold">Conectar otro Claude (otro computador o el celular)</summary>
        <div className="px-4 pb-4">
          <Pasos url={url} />
        </div>
      </details>
    </div>
  );
}
