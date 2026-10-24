import { Esqueleto } from "@/components/Cargando";

export default function CargandoProyecciones() {
  return (
    <div className="space-y-4 pt-6" aria-busy="true">
      <Esqueleto className="h-9 w-56" />
      <Esqueleto className="h-24 w-full" />
      <Esqueleto className="h-24 w-full" />
      <Esqueleto className="h-48 w-full" />
    </div>
  );
}
