"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, RefreshCw, Trash2 } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { prepararSubidaSoporte } from "@/app/(app)/soportes";
import { comprimirImagen } from "@/lib/imagen-cliente";
import { direccionSoporte, TAMANO_MAXIMO_SOPORTE, TIPOS_SOPORTE, type CarpetaSoporte } from "@/lib/soportes";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Adjuntar el documento que respalda un resultado (informe de laboratorio, foto de la prueba, acta de inspección): un PDF o una foto.
 * Va directo a Storage con un permiso de un solo uso que arma el servidor, en la carpeta de la finca. Deja la ruta en un campo oculto
 * `nombre` (vacío si no hay documento). Las fotos se reducen antes de subirlas.
 */
export function SubirSoporte({
  nombre,
  carpeta,
  etiqueta,
  inicial,
  onEstado,
  onCambio,
}: {
  nombre: string;
  carpeta: CarpetaSoporte;
  /** Qué documento es: «Informe del laboratorio». */
  etiqueta: string;
  /** Al editar: la ruta del documento que el registro ya tiene. */
  inicial?: string | null;
  onEstado?: (subiendo: boolean) => void;
  onCambio?: (ruta: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ruta, setRuta] = useState(inicial ?? "");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poner = (r: string, n: string | null) => {
    setRuta(r);
    setArchivo(n);
    onCambio?.(r);
  };

  const elegir = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (!TIPOS_SOPORTE[f.type]) return setError("Usa un documento en PDF o una foto (JPG, PNG o WebP).");
    if (f.size > TAMANO_MAXIMO_SOPORTE * 3) return setError("El archivo es muy pesado (máximo 10 MB).");
    setSubiendo(true);
    onEstado?.(true);
    try {
      const esFoto = f.type !== "application/pdf";
      const blob: Blob = esFoto ? await comprimirImagen(f) : f;
      const tipo = esFoto ? (blob.type === "image/png" || blob.type === "image/webp" ? blob.type : "image/jpeg") : "application/pdf";
      if (blob.size > TAMANO_MAXIMO_SOPORTE) throw new Error("El archivo es muy pesado (máximo 10 MB).");
      const permiso = await prepararSubidaSoporte(carpeta, tipo);
      if ("error" in permiso) throw new Error(permiso.error);
      const { error: e } = await crearClienteNavegador().storage.from("soportes").uploadToSignedUrl(permiso.path, permiso.token, blob, { contentType: tipo });
      if (e) throw new Error(e.message);
      poner(permiso.path, f.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el documento.");
    } finally {
      setSubiendo(false);
      onEstado?.(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name={nombre} value={ruta} />
      <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void elegir(e.target.files?.[0])} aria-label={etiqueta} />
      {ruta ? (
        <div className="flex items-center gap-3 rounded-2xl bg-papel p-3 ring-1 ring-arena">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-musgo/12 text-musgo">
            <FileText className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{archivo ?? "Documento adjunto"}</span>
            <a href={direccionSoporte(ruta)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-musgo underline-offset-4 hover:underline">
              Ver documento
            </a>
          </span>
          <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo} aria-label="Cambiar el documento" className="grid size-11 shrink-0 place-items-center rounded-full text-humo hover:bg-arena hover:text-tinta disabled:opacity-50">
            {subiendo ? <Cargando pequeno texto="" /> : <RefreshCw className="size-5" strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => poner("", null)} disabled={subiendo} aria-label="Quitar el documento" className="grid size-11 shrink-0 place-items-center rounded-full text-humo hover:bg-arena hover:text-rojo disabled:opacity-50">
            <Trash2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className="flex min-h-20 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-arena bg-papel px-4 text-humo transition active:scale-[0.99]"
        >
          {subiendo ? (
            <Cargando texto="Subiendo documento…" pequeno />
          ) : (
            <>
              <Paperclip className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-left">
                <span className="block font-semibold text-tinta">Adjuntar documento</span>
                <span className="block text-sm">PDF o foto, hasta 10 MB</span>
              </span>
            </>
          )}
        </button>
      )}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
