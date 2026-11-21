"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, CloudOff, CloudUpload, Fence, Heart, PawPrint, Plus, Receipt, Scale, Banknote, ShieldPlus, ShoppingCart, Stethoscope, Syringe, Wifi, WifiOff } from "lucide-react";
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
import { MontaCampo } from "@/components/campo/MontaCampo";
import { AnimalCampo } from "@/components/campo/AnimalCampo";
import { SanidadCampo } from "@/components/campo/SanidadCampo";
import { MoverCampo } from "@/components/campo/MoverCampo";
import { CompraCampo } from "@/components/campo/CompraCampo";
import { VentaCampo } from "@/components/campo/VentaCampo";
import { ProveedorMoneda } from "@/components/ProveedorMoneda";
import { MONEDA_DEFECTO } from "@/lib/moneda";
import { DiagnosticoCampo } from "@/components/campo/DiagnosticoCampo";
import { AYUDA_CAMPO } from "@/lib/ayuda";
import { ESC, escena } from "@/lib/escenas";
import { textoAnimales } from "@/lib/hato";
import { fechaHoraBogota, hoyBogota } from "@/lib/fechas";
import { horaBogota, jornadaDeHora, RUTA_CAMPO } from "@/lib/campo";
import { useBandejaCampo } from "@/lib/offline/useBandejaCampo";

type Vista = "animal" | "ordeno" | "pesar" | "monta" | "diagnostico" | "sanidad" | "corrales" | "compra" | "venta" | "bandeja";

const ESCENA_PESAR = escena(Scale, "arcilla");
const ESCENA_BANDEJA = escena(CloudUpload, "grafito");
const ESCENA_MONTA = escena(Heart, "ocre");
const ESCENA_ANIMAL = escena(PawPrint, "ambar", Plus);
const ESCENA_SANIDAD = escena(Syringe, "musgo", ShieldPlus);
const ESCENA_DIAGNOSTICO = escena(Stethoscope, "musgo");
const ESCENA_CORRALES = escena(Fence, "oliva", ArrowRightLeft);
const ESCENA_COMPRA = escena(ShoppingCart, "ocre", Receipt);
const ESCENA_VENTA = escena(Banknote, "musgo", Receipt);

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

  // «#bandeja» (la etiqueta «N sin enviar» del panel), «#animal», «#sanidad», «#corrales», «#compra» o «#venta» (los atajos «… sin señal») abren directo esa parte, al
  // abrir la pantalla y si el ancla cambia con la pantalla ya abierta.
  useEffect(() => {
    const leerAncla = () => {
      const ancla = window.location.hash.slice(1);
      if (ancla === "bandeja" || ancla === "animal" || ancla === "sanidad" || ancla === "corrales" || ancla === "compra" || ancla === "venta") setVista(ancla);
    };
    const t = setTimeout(leerAncla, 0);
    window.addEventListener("hashchange", leerAncla);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", leerAncla);
    };
  }, []);

  // Sin elegir: lo primero que la persona puede registrar.
  const primera: Vista = !referencia ? "ordeno" : referencia.puede.hato ? "animal" : referencia.puede.leche ? "ordeno" : referencia.puede.pesos ? "pesar" : referencia.puede.reproduccion ? "monta" : referencia.puede.sanidad ? "sanidad" : referencia.puede.corrales ? "corrales" : referencia.puede.compras ? "compra" : referencia.puede.ventas ? "venta" : "bandeja";
  const elegida: Vista = vista ?? primera;

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
        ) : !referencia.puede.leche && !referencia.puede.pesos && !referencia.puede.reproduccion && !referencia.puede.hato && !referencia.puede.sanidad && !referencia.puede.corrales && !referencia.puede.compras && !referencia.puede.ventas ? (
          <EstadoVacio icono={<CloudOff strokeWidth={1.5} />} titulo="Tu rol no registra en el campo" descripcion="Si necesitas hacerlo, pídele al propietario de la finca que cambie tu rol en Equipo." />
        ) : (
          <>
            {sesionVencida ? (
              <Aviso tipo="atencion">
                Para enviar lo guardado, entra de nuevo a Apriscol.{" "}
                <a href={`/login?next=${encodeURIComponent(RUTA_CAMPO)}`} className="font-semibold text-musgo underline underline-offset-4">Entrar</a>
              </Aviso>
            ) : null}

            <FilaTarjetas etiqueta="Qué registrar">
              {referencia.puede.hato ? (
                <TarjetaOpcion escena={ESCENA_ANIMAL} titulo="Animal nuevo" dato="Cabra, oveja…" activo={elegida === "animal"} onClick={() => setVista("animal")} />
              ) : null}
              {referencia.puede.leche ? (
                <TarjetaOpcion escena={ESC.leche} titulo="Ordeño" dato={textoAnimales(referencia.ordeno.length)} activo={elegida === "ordeno"} onClick={() => setVista("ordeno")} />
              ) : null}
              {referencia.puede.pesos ? (
                <TarjetaOpcion escena={ESCENA_PESAR} titulo="Pesar" dato={textoAnimales(referencia.pesar.length)} activo={elegida === "pesar"} onClick={() => setVista("pesar")} />
              ) : null}
              {referencia.puede.reproduccion ? (
                <TarjetaOpcion escena={ESCENA_MONTA} titulo="Monta" dato={`${referencia.hembras.length} hembras`} activo={elegida === "monta"} onClick={() => setVista("monta")} />
              ) : null}
              {referencia.puede.reproduccion ? (
                <TarjetaOpcion escena={ESCENA_DIAGNOSTICO} titulo="Diagnóstico" dato={`${referencia.hembras.filter((h) => h.estado === "servida").length} servidas`} activo={elegida === "diagnostico"} onClick={() => setVista("diagnostico")} />
              ) : null}
              {referencia.puede.sanidad ? (
                <TarjetaOpcion escena={ESCENA_SANIDAD} titulo="Sanidad" dato="Vacunas, tratamientos…" activo={elegida === "sanidad"} onClick={() => setVista("sanidad")} />
              ) : null}
              {referencia.puede.corrales ? (
                <TarjetaOpcion escena={ESCENA_CORRALES} titulo="Corrales" dato="Mover animales" activo={elegida === "corrales"} onClick={() => setVista("corrales")} />
              ) : null}
              {referencia.puede.compras ? (
                <TarjetaOpcion escena={ESCENA_COMPRA} titulo="Compra" dato="Alimento, droga…" activo={elegida === "compra"} onClick={() => setVista("compra")} />
              ) : null}
              {referencia.puede.ventas ? (
                <TarjetaOpcion escena={ESCENA_VENTA} titulo="Venta" dato="Queso, carne, abono…" activo={elegida === "venta"} onClick={() => setVista("venta")} />
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
              {elegida === "animal" && usuarioId ? (
                <AnimalCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
              ) : elegida === "ordeno" && usuarioId ? (
                <OrdenoCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} jornadaInicial={jornadaInicial} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
              ) : elegida === "monta" && usuarioId ? (
                <MontaCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
              ) : elegida === "diagnostico" && usuarioId ? (
                <DiagnosticoCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
              ) : elegida === "sanidad" && usuarioId ? (
                <SanidadCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
              ) : elegida === "corrales" && usuarioId ? (
                <MoverCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
              ) : elegida === "compra" && usuarioId ? (
                <ProveedorMoneda moneda={referencia.finca.moneda ?? MONEDA_DEFECTO}>
                  <CompraCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
                </ProveedorMoneda>
              ) : elegida === "venta" && usuarioId ? (
                <ProveedorMoneda moneda={referencia.finca.moneda ?? MONEDA_DEFECTO}>
                  <VentaCampo referencia={referencia} registros={registros} usuarioId={usuarioId} hoy={hoy} enLinea={enLinea} alGuardar={() => void enviarAhora()} />
                </ProveedorMoneda>
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
