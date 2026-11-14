"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plug } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo, CLASE_INPUT } from "@/components/Campo";
import { Tarjeta } from "@/components/Tarjeta";
import { useToast } from "@/components/Toast";
import { crearConexionIa, revocarConexionIa } from "@/app/(app)/mas/ia/actions";
import { NOMBRE_SUGERIDO, comandoClaudeCode, configClaudeDesktop, configGenerica } from "@/lib/mcp/conexion";
import { fechaHoraBogota } from "@/lib/fechas";

type Conexion = { id: string; nombre: string; prefijo: string; creado_en: string; ultimo_uso: string | null };
type Nueva = { token: string; url: string; nombre: string };

/** Una pieza de texto para copiar: se ajusta al ancho (sin desplazamiento lateral) y el botón la copia entera. */
function Copiable({ titulo, texto, mono = true }: { titulo: string; texto: string; mono?: boolean }) {
  const toast = useToast();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.exito("Copiado");
    } catch {
      toast.error("No se pudo copiar. Mantén presionado el texto para copiarlo.");
    }
  };
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">{titulo}</p>
      <pre className={`min-w-0 whitespace-pre-wrap rounded-2xl bg-lana p-3 text-[0.8125rem] leading-relaxed [overflow-wrap:anywhere] ${mono ? "font-mono" : ""}`}>{texto}</pre>
      <Boton variante="secundario" onClick={copiar}>
        <Copy className="size-5" strokeWidth={2} aria-hidden="true" /> Copiar
      </Boton>
    </div>
  );
}

/**
 * Conexión con IA: crear una conexión (el código se muestra una sola vez, con lo que hay que pegar en cada asistente) y ver o revocar las propias.
 * El asistente solo lee, y ve lo mismo que la persona vería en la app con su rol.
 */
export function ConexionIa({ finca, conexiones }: { finca: string; conexiones: Conexion[] }) {
  const toast = useToast();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState(NOMBRE_SUGERIDO);
  const [nueva, setNueva] = useState<Nueva | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const crear = () =>
    iniciar(async () => {
      setError(null);
      const r = await crearConexionIa(nombre);
      if (!r.ok) return setError(r.error);
      setNueva({ token: r.token, url: r.url, nombre: nombre.trim() });
      setCreando(false);
    });

  const revocar = (id: string) =>
    iniciar(async () => {
      setError(null);
      const r = await revocarConexionIa(id);
      if (!r.ok) return setError(r.error);
      setRevocando(null);
      toast.exito("Conexión revocada");
    });

  return (
    <div className="space-y-4">
      <Tarjeta>
        <div className="space-y-3">
          <p className="text-[0.9375rem]">
            Conecta tu asistente de IA (por ejemplo Claude) para preguntarle por <strong className="[overflow-wrap:anywhere]">{finca}</strong>: qué hay que atender hoy, cómo va la leche, buscar un animal.
          </p>
          <p className="text-sm text-humo">Solo puede leer: no registra ni cambia nada. Ve únicamente lo que tú ves en la app con tu rol, y la puedes revocar cuando quieras.</p>

          {nueva ? null : creando ? (
            <div className="space-y-3">
              <Campo etiqueta="Nombre de la conexión" ayuda="Para reconocerla en la lista, por ejemplo «Claude en mi computador».">
                {(id) => <input id={id} className={CLASE_INPUT} value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />}
              </Campo>
              <div className="grid grid-cols-2 gap-2">
                <Boton variante="secundario" onClick={() => setCreando(false)} disabled={pendiente}>Cancelar</Boton>
                <Boton onClick={crear} pendiente={pendiente} cargando="Creando…">Crear</Boton>
              </div>
            </div>
          ) : (
            <Boton onClick={() => { setError(null); setCreando(true); }}>
              <Plug className="size-5" strokeWidth={2} aria-hidden="true" /> Crear conexión
            </Boton>
          )}
        </div>
      </Tarjeta>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      {nueva ? (
        <Tarjeta titulo={`Conexión «${nueva.nombre}» creada`}>
          <div className="space-y-4">
            <Aviso tipo="atencion">Copia el código ahora: por seguridad no se vuelve a mostrar. Si lo pierdes, revoca esta conexión y crea otra.</Aviso>
            <Copiable titulo="Tu código" texto={nueva.token} />
            <p className="text-sm text-humo">Pégalo en tu asistente. Elige el que usas:</p>
            <details className="rounded-2xl ring-1 ring-arena">
              <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-[0.9375rem] font-semibold">Claude Code</summary>
              <div className="space-y-3 px-4 pb-4">
                <Copiable titulo="Pega esto en la terminal" texto={comandoClaudeCode(nueva.url, nueva.token)} />
              </div>
            </details>
            <details className="rounded-2xl ring-1 ring-arena">
              <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-[0.9375rem] font-semibold">Claude Desktop</summary>
              <div className="space-y-3 px-4 pb-4">
                <p className="text-sm text-humo">En Claude Desktop abre Ajustes → Desarrollador → Editar configuración y agrega esto (necesita Node.js instalado).</p>
                <Copiable titulo="Configuración" texto={configClaudeDesktop(nueva.url, nueva.token)} />
              </div>
            </details>
            <details className="rounded-2xl ring-1 ring-arena">
              <summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-[0.9375rem] font-semibold">Cursor y otros</summary>
              <div className="space-y-3 px-4 pb-4">
                <Copiable titulo="Configuración" texto={configGenerica(nueva.url, nueva.token)} />
              </div>
            </details>
            <Boton variante="secundario" onClick={() => setNueva(null)}>
              <Check className="size-5" strokeWidth={2} aria-hidden="true" /> Listo, ya lo copié
            </Boton>
          </div>
        </Tarjeta>
      ) : null}

      {conexiones.length > 0 ? (
        <Tarjeta titulo="Tus conexiones">
          <ul className="divide-y divide-arena">
            {conexiones.map((c) => (
              <li key={c.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold [overflow-wrap:anywhere]">{c.nombre}</p>
                  <p className="text-sm text-humo [overflow-wrap:anywhere]">
                    Creada el {fechaHoraBogota(c.creado_en)} · {c.ultimo_uso ? `último uso ${fechaHoraBogota(c.ultimo_uso)}` : "sin usar todavía"}
                  </p>
                  <p className="font-mono text-xs text-humo">{c.prefijo}…</p>
                </div>
                {revocando === c.id ? (
                  <div className="space-y-3 rounded-2xl bg-lana p-3.5">
                    <p className="text-[0.9375rem]">Tu asistente dejará de ver tu finca con esta conexión. Puedes crear otra cuando quieras.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Boton variante="secundario" onClick={() => setRevocando(null)} disabled={pendiente}>Cancelar</Boton>
                      <Boton variante="peligro" onClick={() => revocar(c.id)} pendiente={pendiente} cargando="Revocando…">Revocar</Boton>
                    </div>
                  </div>
                ) : (
                  <Boton variante="secundario" ancho={false} onClick={() => setRevocando(c.id)}>Revocar</Boton>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}
    </div>
  );
}
