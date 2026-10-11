import { SearchX } from "lucide-react";
import { EnlaceBoton } from "@/components/Boton";
import { EstadoVacio } from "@/components/EstadoVacio";

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-5">
      <EstadoVacio icono={<SearchX strokeWidth={1.5} />} titulo="No encontramos esa página" descripcion="Puede que el enlace esté incompleto o que el animal ya no exista.">
        <EnlaceBoton href="/">Volver al inicio</EnlaceBoton>
      </EstadoVacio>
    </main>
  );
}
