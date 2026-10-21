"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { comprimirImagen } from "@/lib/imagen-cliente";
import { mensajeAmigable } from "@/lib/mensaje-amigable";
import { crearClienteNavegador } from "@/lib/supabase/client";

export type PrepararSubida = (tipoMime: string) => Promise<{ path: string; token: string } | { error: string }>;

/**
 * Subir una foto: va directo a Storage con un permiso de un solo uso que arma el servidor (`preparar`), en la carpeta de la finca del
 * `bucket`. Reduce la foto antes de subirla. Deja la ruta en un campo oculto `nombre` (vacío si no hay foto).
 * `forma="logo"`: imagen cuadrada que se ve completa (sin recortar), se reduce a 512 px y conserva la transparencia.
 */
export function SubirFoto({
  nombre,
  bucket,
  preparar,
  etiqueta,
  textoAgregar,
  onEstado,
  inicial,
  forma = "foto",
}: {
  nombre: string;
  bucket: "premios" | "fotos-animales" | "logos-fincas";
  preparar: PrepararSubida;
  /** Nombre de la foto para lectores de pantalla y el texto de la vista previa. */
  etiqueta: string;
  textoAgregar: string;
  onEstado?: (subiendo: boolean) => void;
  /** Al editar: la foto que el registro ya tiene (ruta en Storage y URL firmada para verla). */
  inicial?: { path: string; url: string } | null;
  forma?: "foto" | "logo";
}) {
  const esLogo = forma === "logo";
  const entrada = useRef<HTMLInputElement>(null);
  const [ruta, setRuta] = useState(inicial?.path ?? "");
  const [vista, setVista] = useState<string | null>(inicial?.url ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    onEstado?.(true);
    try {
      const blob = await comprimirImagen(archivo, esLogo ? { ladoMax: 512, conservarTransparencia: true } : undefined);
      const tipo = blob.type === "image/png" || blob.type === "image/webp" ? blob.type : "image/jpeg";
      const permiso = await preparar(tipo);
      if ("error" in permiso) throw new Error(permiso.error);
      const { error: e } = await crearClienteNavegador().storage.from(bucket).uploadToSignedUrl(permiso.path, permiso.token, blob, { contentType: tipo });
      if (e) throw new Error(e.message);
      setRuta(permiso.path);
      setVista((previa) => {
        if (previa) URL.revokeObjectURL(previa);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(mensajeAmigable(e instanceof Error ? e.message : `No se pudo subir ${esLogo ? "el logo" : "la foto"}.`));
    } finally {
      setSubiendo(false);
      onEstado?.(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <div className="space-y-2.5">
      <input type="hidden" name={nombre} value={ruta} />
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void elegir(e.target.files?.[0])}
        aria-label={etiqueta}
      />
      {vista ? (
        <div className={`relative overflow-hidden rounded-3xl ring-1 ring-arena ${esLogo ? "bg-papel" : ""}`}>
          {/* Vista previa local: no pasa por el optimizador de imágenes */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={vista} alt={etiqueta} className={esLogo ? "mx-auto aspect-square w-full max-w-56 object-contain p-4 pb-16" : "aspect-[4/3] w-full object-cover"} />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={subiendo}
            className="absolute bottom-2.5 right-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tinta/85 px-4 text-sm font-semibold text-lana backdrop-blur"
          >
            <RefreshCw className="size-4" strokeWidth={2} /> Cambiar
          </button>
          <button
            type="button"
            onClick={() => {
              setRuta("");
              setVista(null);
            }}
            disabled={subiendo}
            className="absolute bottom-2.5 left-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tinta/85 px-4 text-sm font-semibold text-lana backdrop-blur"
          >
            <Trash2 className="size-4" strokeWidth={2} /> Quitar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-arena bg-papel px-4 text-humo transition active:scale-[0.99] ${esLogo ? "min-h-32" : "min-h-36"}`}
        >
          {subiendo ? (
            <Cargando texto={esLogo ? "Subiendo logo…" : "Subiendo foto…"} pequeno />
          ) : (
            <>
              <span className="grid size-12 place-items-center rounded-2xl bg-arena text-musgo">
                {esLogo ? <ImagePlus className="size-6" strokeWidth={1.75} /> : <Camera className="size-6" strokeWidth={1.75} />}
              </span>
              <span className="font-semibold text-tinta">{textoAgregar}</span>
              <span className="flex items-center gap-1 text-sm">
                {esLogo ? "PNG, JPG o WebP" : (<><ImagePlus className="size-4" strokeWidth={1.75} /> Toma una foto o elige de la galería</>)}
              </span>
            </>
          )}
        </button>
      )}
      {vista && subiendo ? <Cargando texto={esLogo ? "Subiendo logo…" : "Subiendo foto…"} pequeno /> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
