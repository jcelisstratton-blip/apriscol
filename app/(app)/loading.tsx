import { Esqueleto, EsqueletoFilas } from "@/components/Cargando";

export default function CargandoApp() {
  return (
    <div className="space-y-4 pt-6" aria-busy="true">
      <Esqueleto className="h-9 w-40" />
      <Esqueleto className="h-36 w-full" />
      <EsqueletoFilas filas={4} />
    </div>
  );
}
