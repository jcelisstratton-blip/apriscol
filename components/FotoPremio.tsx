"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { prepararSubidaFoto } from "@/app/(app)/ferias/actions";
import { crearClienteNavegador } from "@/lib/supabase/client";

const LADO_MAX = 1600;

/** Reduce la foto antes de subirla: ahorra datos en el campo y evita el límite de tamaño. */
async function comprimir(archivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext("2d")?.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
    return blob && blob.size < archivo.size ? blob : archivo;
  } catch {
    return archivo;
  }
}

/** Foto del premio: se sube directo a Storage con un permiso de un solo uso que arma el servidor. */
export function FotoPremio({ nombre, onEstado }: { nombre: string; onEstado?: (subiendo: boolean) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ruta, setRuta] = useState("");
  const [vista, setVista] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    onEstado?.(true);
    try {
      const blob = await comprimir(archivo);
      const tipo = blob.type === "image/png" || blob.type === "image/webp" ? blob.type : "image/jpeg";
      const permiso = await prepararSubidaFoto(tipo);
      if ("error" in permiso) throw new Error(permiso.error);
      const { error: e } = await crearClienteNavegador().storage.from("premios").uploadToSignedUrl(permiso.path, permiso.token, blob, { contentType: tipo });
      if (e) throw new Error(e.message);
      setRuta(permiso.path);
      setVista((previa) => {
        if (previa) URL.revokeObjectURL(previa);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
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
        aria-label="Foto del premio"
      />
      {vista ? (
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-arena">
          {/* Vista previa local: no pasa por el optimizador de imágenes */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={vista} alt="Foto del premio" className="aspect-[4/3] w-full object-cover" />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={subiendo}
            className="absolute bottom-2.5 right-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tinta/85 px-4 text-sm font-semibold text-lana backdrop-blur"
          >
            <RefreshCw className="size-4" strokeWidth={2} /> Cambiar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-arena bg-papel px-4 text-humo transition active:scale-[0.99]"
        >
          {subiendo ? (
            <Cargando texto="Subiendo foto…" pequeno />
          ) : (
            <>
              <span className="grid size-12 place-items-center rounded-2xl bg-arena text-musgo">
                <Camera className="size-6" strokeWidth={1.75} />
              </span>
              <span className="font-semibold text-tinta">Agregar la foto del premio</span>
              <span className="flex items-center gap-1 text-sm">
                <ImagePlus className="size-4" strokeWidth={1.75} /> Toma una foto o elige de la galería
              </span>
            </>
          )}
        </button>
      )}
      {vista && subiendo ? <Cargando texto="Subiendo foto…" pequeno /> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
