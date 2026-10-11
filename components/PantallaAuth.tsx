import { Isotipo } from "@/components/Marca";

/** Marco de las pantallas de acceso: marca arriba, formulario abajo, todo al alcance del pulgar. */
export function PantallaAuth({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center gap-8 py-6">
        <div className="space-y-4">
          <Isotipo className="size-14" />
          <div className="space-y-2">
            <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight">{titulo}</h1>
            <p className="text-[1.0625rem] text-humo">{subtitulo}</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
