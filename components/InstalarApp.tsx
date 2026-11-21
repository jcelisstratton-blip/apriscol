"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckCircle2, Laptop, MoreVertical, Share, Smartphone } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { Tarjeta } from "@/components/Tarjeta";
import { useToast } from "@/components/Toast";
import { type Aparato, aparatoTexto, instalarDirecto, mostrarAviso, suscribirInstalar } from "@/lib/instalar-navegador";

type Pasos = { id: "ios" | "android" | "computador"; titulo: string; Icono: typeof Smartphone; pasos: React.ReactNode[] };

const PASOS: Pasos[] = [
  {
    id: "ios",
    titulo: "iPhone o iPad",
    Icono: Smartphone,
    pasos: [
      "Abre Apriscol en Safari (desde WhatsApp u otra app no se puede).",
      <>Toca <Share className="inline size-4 -translate-y-0.5 text-musgo" strokeWidth={2} aria-label="Compartir" /> Compartir, abajo en el centro.</>,
      "Baja y elige «Agregar a inicio». Luego toca «Agregar».",
      "Abre Apriscol desde el ícono nuevo de tu pantalla de inicio.",
    ],
  },
  {
    id: "android",
    titulo: "Android",
    Icono: Smartphone,
    pasos: [
      "Abre Apriscol en Chrome.",
      <>Toca el menú <MoreVertical className="inline size-4 -translate-y-0.5 text-musgo" strokeWidth={2} aria-label="de los tres puntos" />, arriba a la derecha.</>,
      "Elige «Instalar aplicación» (o «Agregar a la pantalla principal») y confirma.",
      "Abre Apriscol desde el ícono nuevo de tu pantalla de inicio.",
    ],
  },
  {
    id: "computador",
    titulo: "Computador",
    Icono: Laptop,
    pasos: [
      "Abre Apriscol en Chrome o Edge.",
      "Toca el ícono de instalar, al final de la barra de direcciones (un monitor con una flecha).",
      "Confirma con «Instalar»: queda como un programa más, con su propia ventana.",
    ],
  },
];

const NOMBRE: Record<Aparato["plataforma"], string> = { ios: "iPhone o iPad", android: "Celular Android", otro: "Computador" };

/**
 * Cómo instalar Apriscol en este aparato: lo que se detectó (sistema, navegador y si ya está instalada), el botón «Instalar» cuando el navegador lo
 * permite (Chrome y Edge), un aviso si se abrió dentro de otra app y los pasos de iPhone, Android y computador, con los de este aparato primero.
 * Si la persona ocultó el aviso de Hoy, aquí puede volver a mostrarlo.
 */
export function InstalarApp() {
  const toast = useToast();
  const texto = useSyncExternalStore(suscribirInstalar, aparatoTexto, () => "");
  const [instalando, setInstalando] = useState(false);
  if (!texto) return <Cargando texto="Revisando este aparato…" />;
  const a = JSON.parse(texto) as Aparato;
  const propio = a.plataforma === "otro" ? "computador" : a.plataforma;
  const pasos = [...PASOS].sort((x, y) => Number(y.id === propio) - Number(x.id === propio));

  const instalar = async () => {
    setInstalando(true);
    const ok = await instalarDirecto();
    setInstalando(false);
    if (ok) toast.exito("Apriscol quedó instalada");
  };

  return (
    <div className="space-y-4">
      <Tarjeta>
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-musgo/12 text-musgo" aria-hidden="true">
            {a.plataforma === "otro" ? <Laptop className="size-6" strokeWidth={1.75} /> : <Smartphone className="size-6" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold [overflow-wrap:anywhere]">Este aparato: {NOMBRE[a.plataforma]}</p>
            <p className="text-sm text-humo [overflow-wrap:anywhere]">Abierta en {a.navegador} · {a.instalada ? "abierta desde la app instalada" : "todavía no instalada aquí"}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {a.instalada ? (
            <Aviso tipo="exito">Ya la tienes instalada: ábrela siempre desde el ícono de Apriscol.</Aviso>
          ) : a.dentroDeApp ? (
            <Aviso tipo="atencion">Estás dentro de otra app (WhatsApp, Instagram, Gmail…). Abre esta página en {a.plataforma === "ios" ? "Safari" : "Chrome"} para poder instalarla.</Aviso>
          ) : a.directo ? (
            <Boton onClick={instalar} pendiente={instalando} cargando="Abriendo…">Instalar Apriscol</Boton>
          ) : (
            <p className="text-[0.9375rem]">Sigue los pasos de abajo{a.plataforma === "ios" ? "" : ". Si tu navegador no muestra la opción, ábrela en Chrome"}.</p>
          )}
          {!a.instalada && a.oculto ? (
            <button type="button" onClick={() => { mostrarAviso(); toast.exito("El aviso volverá a salir en Hoy"); }} className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-musgo underline-offset-4 hover:underline">
              Volver a mostrar el aviso en Hoy
            </button>
          ) : null}
        </div>
      </Tarjeta>

      {pasos.map((p) => (
        <Tarjeta key={p.id}>
          <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
            <p.Icono className="size-5 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{p.titulo}</span>
            {p.id === propio ? <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-musgo/12 px-2.5 py-0.5 text-xs font-semibold text-musgo"><CheckCircle2 className="size-3.5" strokeWidth={2} aria-hidden="true" /> Este aparato</span> : null}
          </h2>
          <ol className="mt-3 grid grid-cols-1 gap-2 text-[0.9375rem]">
            {p.pasos.map((paso, i) => (
              <li key={i} className="flex min-w-0 items-start gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-arena text-xs font-semibold">{i + 1}</span>
                <span className="min-w-0 pt-0.5 [overflow-wrap:anywhere]">{paso}</span>
              </li>
            ))}
          </ol>
        </Tarjeta>
      ))}
    </div>
  );
}
