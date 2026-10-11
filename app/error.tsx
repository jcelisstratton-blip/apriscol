"use client";

import { useEffect } from "react";
import { CloudOff } from "lucide-react";
import { Boton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";

export default function ErrorApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[apriscol]", error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-5">
      <EstadoVacio icono={<CloudOff strokeWidth={1.5} />} titulo="Algo no salió bien" descripcion="No pudimos cargar esta pantalla. Revisa tu señal e inténtalo de nuevo.">
        <Boton onClick={reset} ancho>
          Reintentar
        </Boton>
      </EstadoVacio>
    </main>
  );
}
