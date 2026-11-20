"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CloudOff, CloudUpload, Scale, Wifi, WifiOff } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { AyudaModulo } from "@/components/AyudaModulo";
import { Cargando } from "@/components/Cargando";
import { clasesBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";
import { FilaTarjetas, TarjetaOpcion } from "@/components/TarjetaOpcion";
import { useToast } from "@/components/Toast";
import { OrdenoCampo } from "@/components/campo/OrdenoCampo";
import { PesarCampo } from "@/components/campo/PesarCampo";
import { BandejaCampo } from "@/components/campo/BandejaCampo";
import { AYUDA_CAMPO } from "@/lib/ayuda";
import { ESC, escena } from "@/lib/escenas";
import { textoAnimales } from "@/lib/hato";
import { fechaHoraBogota, hoyBogota } from "@/lib/fechas";
import { horaBogota, jornadaDeHora, RUTA_CAMPO } from "@/lib/campo";
import { useBandejaCampo } from "@/lib/offline/useBandejaCampo";

type Vista = "ordeno" | "pesar" | "bandeja";

const ESCENA_PESAR = escena(Scale, "arcilla");
const ESCENA_BANDEJA = escena(CloudUpload, "grafito");

/**
 * «Registrar sin señal» (`/campo`): una página igual para todas las personas que el service worker deja lista para abrir sin conexión. Todo
 * lo de la finca sale de la copia guardada en el celular, y lo anotado se guarda ahí y se envía solo. Enlaces comunes (`<a>`), no `Link`: sin
 * señal la navegación de la app no funciona, pero la del navegador sí la atiende el service worker (a «/» con señal, `Link`).
 */
export function PantallaCampo() {
  const toast = useToast();
  const { registros, referencia, usuarioId, resumen, enLinea, enviando, sesionVencida, enviarAhora } = useBandejaCampo(null, toast);
  const [vista, setVista] = useState<Vista | null>(null);
  const [hoy] = useState(() => hoyBogota());
  const [jornadaInicial] = useState(() => jornadaDeHora(horaBogota()));

  // «#bandeja» (desde la etiqueta «N sin enviar» del panel) abre directo lo guardado.
  useEffect(() => {
    const t = setTimeout(() => {
      if (window.location.hash === "#bandeja") setVista("bandeja");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const elegida: Vista = vista ?? (referencia && !referencia.puede.leche && referencia.puede.pesos ? "pesar" : "ordeno");

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] lg:max-w-3xl">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-musgo">
          <ArrowLeft className="size-5" strokeWidth={2} aria-hidden="true" /> Apriscol
        </Link>
        <span
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${enLinea ? "bg-musgo/12 text-musgo" : "bg-ambar/15 text-ambar"}`}
          role="status"
          aria-live="polite"
        >
          {enLinea ? <Wifi className="size-4" strokeWidth={2} aria-hidden="true" /> : <WifiOff className="size-4" strokeWidth={2} aria-hidden="true" />}
          {enLinea ? "Con señal" : "Sin señal"}
        </span>
      </header>

      <div className="mt-2 flex items-center gap-3">
        {/* Imagen común (no la optimizada de Next): sin señal la sirve el service worker. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.webp" alt="" width={44} height={44} className="size-11 shrink-0 rounded-full" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight">Registrar sin señal</h1>
          {referencia ? <p className="text-sm text-humo [overflow-wrap:anywhere]">{referencia.finca.nombre}</p> : null}
        </div>
      </div>
      <div className="mt-1">
        <AyudaModulo ayuda={AYUDA_CAMPO} />
      </div>

      <div className="mt-4 space-y-4">
        {referencia === undefined ? (
          <Cargando texto="Abriendo lo guardado en el celular…" />
        ) : referencia === null ? (
          <EstadoVacio
            icono={<CloudOff strokeWidth={1.5} />}
            titulo="Este celular aún no está listo"
            descripcion="Abre Apriscol una vez con señal en este celular: así guarda la lista de tus hembras y animales para anotar donde no entra la señal."
          >
            <Link href="/" className={clasesBoton("primario", true)}>Ir a Apriscol</Link>
          </EstadoVacio>
        ) : !referencia.puede.leche && !referencia.puede.pesos ? (
          <EstadoVacio icono={<CloudOff strokeWidth={1.5} />} titulo="Tu rol no registra ordeños ni pesos" descripcion="Si necesitas hacerlo, pídele al propietario de la finca que cambie tu rol en Equipo." />
        ) : (
          <>
            {sesionVencida ? (
              <Aviso tipo="atencion">
                Para enviar lo guardado, entra de nuevo a Apriscol.{" "}
                <a href={`/login?next=${encodeURIComponent(RUTA_CAMPO)}`} className="font-semibold text-musgo underline underline-offset-4">Entrar</a>
              </Aviso>
            ) : null}

            <FilaTarjetas etiqueta="Qué registrar">
              {referencia.puede.leche ? (
                <TarjetaOpcion escena={ESC.leche} titulo="Ordeño" dato={textoAnimales(referencia.ordeno.length)} activo={elegida === "ordeno"} onClick={() => setVista("ordeno")} />
              ) : null}
              {referencia.puede.pesos ? (
                <TarjetaOpcion escena={ESCENA_PESAR} titulo="Pesar" dato={textoAnimales(referencia.pesar.length)} activo={elegida === "pesar"} onClick={() => setVista("pesar")} />
              ) : null}
              <TarjetaOpcion
                escena={ESCENA_BANDEJA}
                titulo="Guardado"
                dato={resumen.conError > 0 ? `${resumen.conError} con error` : `${resumen.porEnviar} por enviar`}
                activo={elegida === "bandeja"}
                onClick={() => setVista("bandeja")}
              />
            </FilaTarjetas>

            <p className="px-1 text-xs text-humo">Lista de la finca guardada el {fechaHoraBogota(referencia.generadaEn)} · se actualiza sola cada vez que abres Apriscol con señal</p>

            <div id="bandeja" className="scroll-mt-4">
              {elegida === "ordeno" && usuarioId ? (
                <OrdenoCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} jornadaInicial={jornadaInicial} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
              ) : elegida === "pesar" && usuarioId ? (
                <PesarCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
              ) : usuarioId ? (
                <BandejaCampo registros={registros} usuarioId={usuarioId} enLinea={enLinea} enviando={enviando} deOtraCuenta={resumen.deOtraCuenta} alEnviar={() => void enviarAhora()} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
