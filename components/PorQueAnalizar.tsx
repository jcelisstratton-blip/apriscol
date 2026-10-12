import { ShieldCheck } from "lucide-react";

/**
 * Lo que debe quedar claro al propietario: los análisis son decisión suya, conviene hacerlos y, si decide no hacerlos, queda constancia.
 * Es una nota (no una alarma): va junto a donde se registran los análisis o se responden los controles.
 */
export function PorQueAnalizar({ linea, className = "" }: { linea: "leche" | "carne"; className?: string }) {
  const producto = linea === "leche" ? "tu leche" : "tu carne";
  const quien = linea === "leche" ? "Una quesería o una planta" : "Un frigorífico o un comprador";
  return (
    <div className={`flex items-start gap-3 rounded-2xl bg-musgo/8 px-3.5 py-3 text-[0.9375rem] leading-snug ${className}`}>
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-musgo" strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0 space-y-1.5">
        <p className="font-semibold">Conviene hacer estos análisis</p>
        <p className="text-humo">
          Hacerlos es decisión tuya, pero protegen a quien consume {producto} y protegen a tu aprisco. {quien} puede pedirte los resultados, y un lote sin
          análisis es difícil de defender si hay un reclamo. Si decides no hacerlos, el sistema deja constancia de que no se hicieron.
        </p>
      </div>
    </div>
  );
}
